import { Request, Response } from "express";
import prisma from "../../utils/prisma";

export const getAll = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const productId = req.query.productId ? String(req.query.productId) : undefined;
    const where: any = { companyId };
    if (productId) where.productId = productId;
    const data = await prisma.stock_movements.findMany({
      where,
      include: { products: true, warehouses: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getOne = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const data = await prisma.stock_movements.findFirst({ where: { id: req.params.id, companyId }, include: { products: true, warehouses: true } });
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Manual stock adjustment: sets a delta and updates product on-hand.
export const create = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const { productId, warehouseId, quantity, type, reference } = req.body;
    const qty = Number(quantity);
    if (!productId || !qty) return res.status(400).json({ message: "productId and non-zero quantity are required" });

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.products.findFirst({ where: { id: productId, companyId } });
      if (!product) throw new Error("Product not found");
      const wh = warehouseId ? await tx.warehouses.findFirst({ where: { id: warehouseId, companyId } }) : await tx.warehouses.findFirst({ where: { companyId } });
      if (!wh) throw new Error("No warehouse available");

      const newQty = Number(product.onHandQty) + qty;
      if (newQty < 0) throw new Error("Adjustment would result in negative stock");

      await tx.products.update({ where: { id: productId }, data: { onHandQty: newQty, updatedAt: new Date() } });
      return tx.stock_movements.create({
        data: {
          id: `sm-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          companyId,
          warehouseId: wh.id,
          productId,
          quantity: qty,
          type: type || 'ADJUSTMENT',
          reference: reference || 'Manual adjustment',
        },
      });
    });
    res.status(201).json(result);
  } catch (error: any) {
    const status = /not found|negative|available/i.test(error.message) ? 400 : 500;
    res.status(status).json({ message: error.message });
  }
};

// Transfer stock between warehouses (records OUT + IN; net product qty unchanged).
export const transfer = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const { productId, fromWarehouseId, toWarehouseId, quantity } = req.body;
    const qty = Number(quantity);
    if (!productId || !fromWarehouseId || !toWarehouseId || !qty || qty <= 0) {
      return res.status(400).json({ message: "productId, fromWarehouseId, toWarehouseId and positive quantity are required" });
    }
    if (fromWarehouseId === toWarehouseId) return res.status(400).json({ message: "Source and destination must differ" });

    const result = await prisma.$transaction(async (tx) => {
      const now = Date.now();
      const out = await tx.stock_movements.create({ data: { id: `sm-${now}-out`, companyId, warehouseId: fromWarehouseId, productId, quantity: -qty, type: 'TRANSFER_OUT', reference: `Transfer to ${toWarehouseId}` } });
      const inm = await tx.stock_movements.create({ data: { id: `sm-${now}-in`, companyId, warehouseId: toWarehouseId, productId, quantity: qty, type: 'TRANSFER_IN', reference: `Transfer from ${fromWarehouseId}` } });
      return { out, in: inm };
    });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const update = async (_req: Request, res: Response) => res.status(400).json({ message: "Stock movements are immutable. Create an adjustment instead." });
export const remove = async (_req: Request, res: Response) => res.status(400).json({ message: "Stock movements are immutable." });
