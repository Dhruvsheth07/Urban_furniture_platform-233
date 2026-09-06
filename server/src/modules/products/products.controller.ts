import { Request, Response } from "express";
import prisma from "../../utils/prisma";

export const getAll = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;

    const page     = Math.max(1, parseInt(String(req.query.page     || '1'), 10));
    const limit    = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const search   = String(req.query.search   || '').trim();
    const lowStock = req.query.lowStock === 'true';

    // Summary stats always run on the FULL dataset (unpaginated)
    const allActive = await prisma.products.findMany({ where: { companyId, isActive: true } });
    const totalValue = allActive.reduce((s, p) => s + Number(p.onHandQty) * Number(p.avgCost || p.purchasePrice), 0);
    const lowCount   = allActive.filter(p => Number(p.reorderLevel) > 0 && Number(p.onHandQty) <= Number(p.reorderLevel)).length;

    const where: any = { companyId, isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku:  { contains: search, mode: 'insensitive' } },
      ];
    }
    // lowStock filter: onHandQty <= reorderLevel AND reorderLevel > 0
    // Prisma doesn't support column-to-column comparison directly, handled post-query if needed
    // but we can filter on reorderLevel > 0 at DB and onHandQty at DB with raw
    // Simplest approach: add a post-filter flag handled in the query below
    const items = await prisma.products.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    const filtered = lowStock
      ? items.filter(p => Number(p.reorderLevel) > 0 && Number(p.onHandQty) <= Number(p.reorderLevel))
      : items;

    const total     = filtered.length;
    const pageCount = Math.ceil(total / limit);
    const data      = filtered.slice((page - 1) * limit, page * limit);

    res.json({ data, total, page, pageCount, stats: { totalProducts: allActive.length, totalValue, lowCount } });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getOne = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const data = await prisma.products.findFirst({ where: { id: req.params.id, companyId } });
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const b = req.body;
    if (!b.name || !b.sku) return res.status(400).json({ message: "name and sku are required" });
    const data = await prisma.products.create({
      data: {
        id: `prod-${Date.now()}`,
        companyId,
        sku: b.sku,
        name: b.name,
        description: b.description,
        type: b.type || 'GOODS',
        salePrice: Number(b.salePrice) || 0,
        purchasePrice: Number(b.purchasePrice) || 0,
        avgCost: Number(b.purchasePrice) || 0,
        onHandQty: Number(b.openingQty) || 0,
        openingQty: Number(b.openingQty) || 0,
        reorderLevel: Number(b.reorderLevel) || 0,
        material: b.material,
        color: b.color,
        finish: b.finish,
        dimensions: b.dimensions,
        hsnCode: b.hsnCode,
        trackInventory: b.trackInventory !== false,
        updatedAt: new Date(),
      },
    });
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const existing = await prisma.products.findFirst({ where: { id: req.params.id, companyId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    const b = req.body;
    const patch: any = { updatedAt: new Date() };
    for (const f of ['name', 'description', 'material', 'color', 'finish', 'dimensions', 'hsnCode', 'isActive']) {
      if (b[f] !== undefined) patch[f] = b[f];
    }
    for (const f of ['salePrice', 'purchasePrice', 'reorderLevel']) {
      if (b[f] !== undefined) patch[f] = Number(b[f]);
    }
    const data = await prisma.products.update({ where: { id: req.params.id }, data: patch });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const existing = await prisma.products.findFirst({ where: { id: req.params.id, companyId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    await prisma.products.update({ where: { id: req.params.id }, data: { isActive: false, updatedAt: new Date() } });
    res.json({ message: "Deactivated" });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
