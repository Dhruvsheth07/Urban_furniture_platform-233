import { Request, Response } from "express";
import prisma from "../../utils/prisma";
import { AccountingService } from "../../services/accounting.service";

function computeLines(lines: any[]) {
  let net = 0, tax = 0;
  const computed = lines.map((l: any) => {
    const qty = Number(l.quantity) || 0;
    const price = Number(l.unitPrice) || 0;
    const rate = Number(l.taxRate) || 0;
    const lineNet = qty * price;
    const lineTax = lineNet * (rate / 100);
    net += lineNet;
    tax += lineTax;
    return { ...l, quantity: qty, unitPrice: price, taxRate: rate, total: lineNet + lineTax };
  });
  return { computed, net: Math.round(net * 100) / 100, tax: Math.round(tax * 100) / 100, gross: Math.round((net + tax) * 100) / 100 };
}

export const getAll = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;

    // --- Pagination & filters ---
    const page   = Math.max(1, parseInt(String(req.query.page  || '1'), 10));
    const limit  = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '15'), 10)));
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim().toUpperCase();

    const where: any = { companyId };
    if (status && status !== 'ALL') where.status = status;
    if (search) {
      where.OR = [
        { billNumber: { contains: search, mode: 'insensitive' } },
        { vendor:     { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, data] = await prisma.$transaction([
      prisma.vendor_bills.count({ where }),
      prisma.vendor_bills.findMany({
        where,
        include: { vendor: true, lines: { include: { product: true } } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.json({ data, total, page, pageCount: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getOne = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const data = await prisma.vendor_bills.findFirst({
      where: { id: req.params.id, companyId },
      include: { vendor: true, lines: { include: { product: true } }, payments: true },
    });
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const companyId = user.companyId;
    const { vendorId, billNumber, date, dueDate, lines, notes, warehouseId, orderId } = req.body;

    if (!vendorId || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ message: "vendorId and at least one line item are required" });
    }

    const { computed, net, tax, gross } = computeLines(lines);

    // Duplicate detection: same vendor + billNumber
    if (billNumber) {
      const dup = await prisma.vendor_bills.findFirst({ where: { companyId, vendorId, billNumber } });
      if (dup) return res.status(409).json({ message: `Duplicate bill: ${billNumber} already exists for this vendor`, duplicateId: dup.id });
    }

    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.vendor_bills.count({ where: { companyId } });
      const finalBillNumber = billNumber || `BILL-${String(count + 1001)}`;

      const bill = await tx.vendor_bills.create({
        data: {
          id: `bill-${Date.now()}`,
          companyId,
          vendorId,
          orderId: orderId || null,
          billNumber: finalBillNumber,
          date: date ? new Date(date) : new Date(),
          dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 86400000),
          status: 'OPEN',
          totalAmount: gross,
          notes,
          updatedAt: new Date(),
          lines: {
            create: computed.map((l: any, i: number) => ({
              id: `bl-${Date.now()}-${i}`,
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              taxRate: l.taxRate,
              total: l.total,
            })),
          },
        },
      });

      const warehouse = warehouseId
        ? await tx.warehouses.findFirst({ where: { id: warehouseId, companyId } })
        : await tx.warehouses.findFirst({ where: { companyId } });

      // Increase inventory + recompute weighted average cost
      for (const l of computed) {
        const product = await tx.products.findFirst({ where: { id: l.productId, companyId } });
        if (!product || !product.trackInventory) continue;
        const oldQty = Number(product.onHandQty);
        const oldCost = Number(product.avgCost) || Number(product.purchasePrice) || 0;
        const newQty = oldQty + l.quantity;
        const newAvg = newQty > 0 ? (oldQty * oldCost + l.quantity * l.unitPrice) / newQty : l.unitPrice;
        await tx.products.update({
          where: { id: product.id },
          data: { onHandQty: newQty, avgCost: Math.round(newAvg * 10000) / 10000, purchasePrice: l.unitPrice },
        });
        if (warehouse) {
          await tx.stock_movements.create({
            data: {
              id: `sm-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
              companyId,
              warehouseId: warehouse.id,
              productId: product.id,
              quantity: l.quantity,
              type: 'IN',
              reference: `BILL:${finalBillNumber}`,
            },
          });
        }
      }

      await AccountingService.recordVendorBill(companyId, bill.id, { net, tax }, tx, user.id);
      return bill;
    });

    const full = await prisma.vendor_bills.findUnique({ where: { id: result.id }, include: { vendor: true, lines: { include: { product: true } } } });
    res.status(201).json(full);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const existing = await prisma.vendor_bills.findFirst({ where: { id: req.params.id, companyId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    const { notes, dueDate } = req.body;
    const data = await prisma.vendor_bills.update({ where: { id: req.params.id }, data: { notes, ...(dueDate ? { dueDate: new Date(dueDate) } : {}), updatedAt: new Date() } });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const remove = async (_req: Request, res: Response) => {
  res.status(400).json({ message: "Vendor bills cannot be deleted. Use a reversal instead." });
};
