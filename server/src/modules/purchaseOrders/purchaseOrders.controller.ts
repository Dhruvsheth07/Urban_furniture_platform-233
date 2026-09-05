import { Request, Response } from "express";
import prisma from "../../utils/prisma";

function computeLines(lines: any[]) {
  let total = 0;
  const computed = (lines || []).map((l: any) => {
    const qty = Number(l.quantity) || 0;
    const price = Number(l.unitPrice) || 0;
    const rate = Number(l.taxRate) || 0;
    const lineTotal = qty * price * (1 + rate / 100);
    total += lineTotal;
    return { ...l, quantity: qty, unitPrice: price, taxRate: rate, total: lineTotal };
  });
  return { computed, total: Math.round(total * 100) / 100 };
}

export const getAll = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const data = await prisma.purchase_orders.findMany({
      where: { companyId },
      include: { vendor: true, lines: { include: { product: true } }, bills: true },
      orderBy: { date: 'desc' },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getOne = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const data = await prisma.purchase_orders.findFirst({
      where: { id: req.params.id, companyId },
      include: { vendor: true, lines: { include: { product: true } }, bills: true },
    });
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const { vendorId, date, lines, notes, status } = req.body;
    if (!vendorId || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ message: "vendorId and at least one line item are required" });
    }
    const { computed, total } = computeLines(lines);
    const count = await prisma.purchase_orders.count({ where: { companyId } });
    const data = await prisma.purchase_orders.create({
      data: {
        id: `po-${Date.now()}`,
        companyId,
        vendorId,
        orderNumber: `PO-${String(count + 1001)}`,
        date: date ? new Date(date) : new Date(),
        status: status || 'CONFIRMED',
        totalAmount: total,
        notes,
        updatedAt: new Date(),
        lines: {
          create: computed.map((l: any, i: number) => ({
            id: `pol-${Date.now()}-${i}`,
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxRate: l.taxRate,
            total: l.total,
          })),
        },
      },
      include: { vendor: true, lines: true },
    });
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Convert PO into a vendor bill (receives goods, posts AP + inventory).
export const convertToBill = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const companyId = user.companyId;
    const po = await prisma.purchase_orders.findFirst({ where: { id: req.params.id, companyId }, include: { lines: true, bills: true } });
    if (!po) return res.status(404).json({ message: "Purchase order not found" });
    if (po.bills.length > 0) return res.status(400).json({ message: "PO already billed", billId: po.bills[0].id });

    const { AccountingService } = await import("../../services/accounting.service");
    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.vendor_bills.count({ where: { companyId } });
      let net = 0, tax = 0;
      const linesData = po.lines.map((l: any, i: number) => {
        const lineNet = Number(l.quantity) * Number(l.unitPrice);
        const lineTax = lineNet * (Number(l.taxRate) / 100);
        net += lineNet; tax += lineTax;
        return { id: `bl-${Date.now()}-${i}`, productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate, total: lineNet + lineTax };
      });
      net = Math.round(net * 100) / 100; tax = Math.round(tax * 100) / 100;
      const bill = await tx.vendor_bills.create({
        data: {
          id: `bill-${Date.now()}`, companyId, vendorId: po.vendorId, orderId: po.id,
          billNumber: `BILL-${String(count + 1001)}`, date: new Date(), dueDate: new Date(Date.now() + 30 * 86400000),
          status: 'OPEN', totalAmount: Math.round((net + tax) * 100) / 100, updatedAt: new Date(),
          lines: { create: linesData },
        },
      });
      const warehouse = await tx.warehouses.findFirst({ where: { companyId } });
      for (const l of po.lines) {
        const product = await tx.products.findFirst({ where: { id: l.productId, companyId } });
        if (!product || !product.trackInventory) continue;
        const oldQty = Number(product.onHandQty);
        const oldCost = Number(product.avgCost) || Number(product.purchasePrice) || 0;
        const newQty = oldQty + Number(l.quantity);
        const newAvg = newQty > 0 ? (oldQty * oldCost + Number(l.quantity) * Number(l.unitPrice)) / newQty : Number(l.unitPrice);
        await tx.products.update({ where: { id: product.id }, data: { onHandQty: newQty, avgCost: Math.round(newAvg * 10000) / 10000, purchasePrice: Number(l.unitPrice) } });
        if (warehouse) {
          await tx.stock_movements.create({ data: { id: `sm-${Date.now()}-${Math.floor(Math.random() * 100000)}`, companyId, warehouseId: warehouse.id, productId: product.id, quantity: Number(l.quantity), type: 'IN', reference: `BILL:${bill.billNumber}` } });
        }
      }
      await AccountingService.recordVendorBill(companyId, bill.id, { net, tax }, tx, user.id);
      await tx.purchase_orders.update({ where: { id: po.id }, data: { status: 'COMPLETED', updatedAt: new Date() } });
      return bill;
    });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const existing = await prisma.purchase_orders.findFirst({ where: { id: req.params.id, companyId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    const { status, notes } = req.body;
    const data = await prisma.purchase_orders.update({ where: { id: req.params.id }, data: { status, notes, updatedAt: new Date() } });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const existing = await prisma.purchase_orders.findFirst({ where: { id: req.params.id, companyId }, include: { bills: true } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (existing.bills.length > 0) return res.status(400).json({ message: "Cannot delete a billed purchase order" });
    await prisma.purchase_orders.delete({ where: { id: req.params.id } });
    res.json({ message: "Deleted" });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
