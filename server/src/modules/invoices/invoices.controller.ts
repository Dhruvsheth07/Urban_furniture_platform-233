import { Request, Response } from "express";
import prisma from "../../utils/prisma";
import { AccountingService } from "../../services/accounting.service";

// Compute per-line net/tax/total consistently
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
    const user = (req as any).user;
    const companyId = user.companyId;

    const page   = Math.max(1, parseInt(String(req.query.page  || '1'), 10));
    const limit  = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '15'), 10)));
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim().toUpperCase();

    const where: any = { companyId };
    if (user.contactId) where.customerId = user.contactId; // portal isolation
    if (status && status !== 'ALL') where.status = status;
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customer:      { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, data] = await prisma.$transaction([
      prisma.invoices.count({ where }),
      prisma.invoices.findMany({
        where,
        include: { customer: true, lines: { include: { product: true } } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { invoiceNumber: 'desc' }],
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
    const user = (req as any).user;
    const data = await prisma.invoices.findFirst({
      where: { id: req.params.id, companyId: user.companyId },
      include: { customer: true, lines: { include: { product: true } }, payments: true },
    });
    if (!data) return res.status(404).json({ message: "Not found" });
    if (user.contactId && data.customerId !== user.contactId) return res.status(403).json({ message: "Forbidden" });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const companyId = user.companyId;
    const { customerId, date, dueDate, lines, notes, warehouseId } = req.body;

    if (!customerId || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ message: "customerId and at least one line item are required" });
    }

    const { computed, net, tax, gross } = computeLines(lines);

    // ── Credit limit enforcement ──────────────────────────────────────────────
    const customer = await prisma.contacts.findFirst({ where: { id: customerId, companyId } });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const limit = Number(customer.creditLimit || 0);
    if (limit > 0) {
      // Sum all open/partial invoice balances for this customer
      const openInvoices = await prisma.invoices.findMany({
        where: { companyId, customerId, status: { in: ['OPEN', 'PARTIAL'] } },
        select: { totalAmount: true, paidAmount: true },
      });
      const outstanding = openInvoices.reduce(
        (sum, inv) => sum + (Number(inv.totalAmount) - Number(inv.paidAmount)), 0,
      );
      const projectedBalance = Math.round((outstanding + gross) * 100) / 100;
      if (projectedBalance > limit) {
        return res.status(422).json({
          message: `Credit limit exceeded`,
          detail: `${customer.name} has a credit limit of ₹${limit.toLocaleString('en-IN')}. ` +
                  `Current outstanding: ₹${Math.round(outstanding).toLocaleString('en-IN')}, ` +
                  `new invoice: ₹${Math.round(gross).toLocaleString('en-IN')}, ` +
                  `projected total: ₹${Math.round(projectedBalance).toLocaleString('en-IN')}.`,
          creditLimit: limit,
          outstanding: Math.round(outstanding),
          newInvoiceAmount: Math.round(gross),
          projectedBalance: Math.round(projectedBalance),
        });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const result = await prisma.$transaction(async (tx) => {
      // Sequential invoice number
      const count = await tx.invoices.count({ where: { companyId } });
      const invoiceNumber = `INV-${String(count + 1001)}`;

      const inv = await tx.invoices.create({
        data: {
          id: `inv-${Date.now()}`,
          companyId,
          customerId,
          invoiceNumber,
          date: date ? new Date(date) : new Date(),
          dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 15 * 86400000),
          status: 'OPEN',
          totalAmount: gross,
          notes,
          updatedAt: new Date(),
          lines: {
            create: computed.map((l: any, i: number) => ({
              id: `invl-${Date.now()}-${i}`,
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              taxRate: l.taxRate,
              total: l.total,
            })),
          },
        },
      });

      // Inventory decrement + COGS at average cost + stock movements
      let cogs = 0;
      const warehouse = warehouseId
        ? await tx.warehouses.findFirst({ where: { id: warehouseId, companyId } })
        : await tx.warehouses.findFirst({ where: { companyId } });

      for (const l of computed) {
        const product = await tx.products.findFirst({ where: { id: l.productId, companyId } });
        if (!product || !product.trackInventory) continue;
        const unitCost = Number(product.avgCost) || Number(product.purchasePrice) || 0;
        cogs += unitCost * l.quantity;
        await tx.products.update({
          where: { id: product.id },
          data: { onHandQty: { decrement: l.quantity } },
        });
        if (warehouse) {
          await tx.stock_movements.create({
            data: {
              id: `sm-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
              companyId,
              warehouseId: warehouse.id,
              productId: product.id,
              quantity: -l.quantity,
              type: 'OUT',
              reference: `INV:${inv.invoiceNumber}`,
            },
          });
        }
      }
      cogs = Math.round(cogs * 100) / 100;

      await AccountingService.recordSaleInvoice(companyId, inv.id, { net, tax, cogs }, tx, user.id);
      return inv;
    });

    const full = await prisma.invoices.findUnique({ where: { id: result.id }, include: { customer: true, lines: { include: { product: true } } } });
    res.status(201).json(full);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const existing = await prisma.invoices.findFirst({ where: { id: req.params.id, companyId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    const { notes, dueDate } = req.body;
    const data = await prisma.invoices.update({
      where: { id: req.params.id },
      data: { notes, ...(dueDate ? { dueDate: new Date(dueDate) } : {}), updatedAt: new Date() },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Cancel (with journal reversal) instead of hard delete to preserve integrity.
export const remove = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const companyId = user.companyId;
    const existing = await prisma.invoices.findFirst({ where: { id: req.params.id, companyId }, include: { lines: true } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (Number(existing.paidAmount) > 0) return res.status(400).json({ message: "Cannot cancel an invoice with payments. Reverse payments first." });

    await prisma.$transaction(async (tx) => {
      // Reverse the sale journal
      const journal = await tx.journals.findFirst({ where: { companyId, source: `INVOICE:${existing.id}`, type: { not: 'REVERSAL' } } });
      // Restore inventory
      for (const l of existing.lines) {
        const product = await tx.products.findFirst({ where: { id: l.productId, companyId } });
        if (product?.trackInventory) {
          await tx.products.update({ where: { id: product.id }, data: { onHandQty: { increment: Number(l.quantity) } } });
        }
      }
      await tx.invoices.update({ where: { id: existing.id }, data: { status: 'CANCELLED', updatedAt: new Date() } });
      if (journal) {
        // reverse outside-of-helper to reuse tx
        const revNo = `JNL-${String((await tx.journals.count({ where: { companyId } })) + 1).padStart(5, '0')}`;
        const withLines = await tx.journals.findUnique({ where: { id: journal.id }, include: { journal_lines: true } });
        const rev = await tx.journals.create({
          data: { id: `jnl-rev-${Date.now()}`, companyId, number: revNo, date: new Date(), memo: `Reversal of ${journal.number}`, type: 'REVERSAL', status: 'POSTED', reversalOfId: journal.id, updatedAt: new Date() },
        });
        let n = 1;
        for (const jl of withLines!.journal_lines) {
          await tx.journal_lines.create({ data: { id: `jl-${rev.id}-${n}`, companyId, journalId: rev.id, accountId: jl.accountId, debit: jl.credit, credit: jl.debit, description: `Reversal: ${jl.description || ''}`, lineNo: n++ } });
        }
      }
    });
    res.json({ message: "Invoice cancelled and reversed" });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
