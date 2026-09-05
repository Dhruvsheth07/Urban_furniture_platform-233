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
    const data = await prisma.sales_orders.findMany({
      where: { companyId },
      include: { customer: true, lines: { include: { product: true } }, invoices: true },
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
    const data = await prisma.sales_orders.findFirst({
      where: { id: req.params.id, companyId },
      include: { customer: true, lines: { include: { product: true } }, invoices: true },
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
    const { customerId, date, lines, notes, status } = req.body;
    if (!customerId || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ message: "customerId and at least one line item are required" });
    }
    const { computed, total } = computeLines(lines);
    const count = await prisma.sales_orders.count({ where: { companyId } });
    const data = await prisma.sales_orders.create({
      data: {
        id: `so-${Date.now()}`,
        companyId,
        customerId,
        orderNumber: `SO-${String(count + 1001)}`,
        date: date ? new Date(date) : new Date(),
        status: status || 'CONFIRMED',
        totalAmount: total,
        notes,
        updatedAt: new Date(),
        lines: {
          create: computed.map((l: any, i: number) => ({
            id: `sol-${Date.now()}-${i}`,
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxRate: l.taxRate,
            total: l.total,
          })),
        },
      },
      include: { customer: true, lines: true },
    });
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Convert a sales order into an invoice
export const convertToInvoice = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const companyId = user.companyId;
    const so = await prisma.sales_orders.findFirst({
      where: { id: req.params.id, companyId },
      include: { lines: true, invoices: true },
    });
    if (!so) return res.status(404).json({ message: "Sales order not found" });
    if (so.invoices.length > 0) return res.status(400).json({ message: "Sales order already invoiced", invoiceId: so.invoices[0].id });

    // Reuse invoice creation logic via direct call semantics
    const { AccountingService } = await import("../../services/accounting.service");
    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.invoices.count({ where: { companyId } });
      let net = 0, tax = 0;
      const linesData = so.lines.map((l: any, i: number) => {
        const lineNet = Number(l.quantity) * Number(l.unitPrice);
        const lineTax = lineNet * (Number(l.taxRate) / 100);
        net += lineNet; tax += lineTax;
        return { id: `invl-${Date.now()}-${i}`, productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate, total: lineNet + lineTax };
      });
      net = Math.round(net * 100) / 100; tax = Math.round(tax * 100) / 100;
      const inv = await tx.invoices.create({
        data: {
          id: `inv-${Date.now()}`, companyId, customerId: so.customerId, orderId: so.id,
          invoiceNumber: `INV-${String(count + 1001)}`, date: new Date(), dueDate: new Date(Date.now() + 15 * 86400000),
          status: 'OPEN', totalAmount: Math.round((net + tax) * 100) / 100, updatedAt: new Date(),
          lines: { create: linesData },
        },
      });
      let cogs = 0;
      const warehouse = await tx.warehouses.findFirst({ where: { companyId } });
      for (const l of so.lines) {
        const product = await tx.products.findFirst({ where: { id: l.productId, companyId } });
        if (!product || !product.trackInventory) continue;
        const unitCost = Number(product.avgCost) || Number(product.purchasePrice) || 0;
        cogs += unitCost * Number(l.quantity);
        await tx.products.update({ where: { id: product.id }, data: { onHandQty: { decrement: Number(l.quantity) } } });
        if (warehouse) {
          await tx.stock_movements.create({ data: { id: `sm-${Date.now()}-${Math.floor(Math.random() * 100000)}`, companyId, warehouseId: warehouse.id, productId: product.id, quantity: -Number(l.quantity), type: 'OUT', reference: `INV:${inv.invoiceNumber}` } });
        }
      }
      cogs = Math.round(cogs * 100) / 100;
      await AccountingService.recordSaleInvoice(companyId, inv.id, { net, tax, cogs }, tx, user.id);
      await tx.sales_orders.update({ where: { id: so.id }, data: { status: 'COMPLETED', updatedAt: new Date() } });
      return inv;
    });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const existing = await prisma.sales_orders.findFirst({ where: { id: req.params.id, companyId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    const { status, notes } = req.body;
    const data = await prisma.sales_orders.update({ where: { id: req.params.id }, data: { status, notes, updatedAt: new Date() } });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const existing = await prisma.sales_orders.findFirst({ where: { id: req.params.id, companyId }, include: { invoices: true } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (existing.invoices.length > 0) return res.status(400).json({ message: "Cannot delete an invoiced sales order" });
    await prisma.sales_orders.delete({ where: { id: req.params.id } });
    res.json({ message: "Deleted" });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
