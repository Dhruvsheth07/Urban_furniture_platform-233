import { Request, Response } from "express";
import prisma from "../../utils/prisma";
import { AccountingService } from "../../services/accounting.service";

export const getAll = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const where: any = { companyId: user.companyId };
    if (user.contactId) where.contactId = user.contactId; // portal isolation
    const data = await prisma.payments.findMany({
      where,
      include: { contact: true, invoice: true, bill: true },
      orderBy: { date: 'desc' },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getOne = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const data = await prisma.payments.findFirst({
      where: { id: req.params.id, companyId: user.companyId },
      include: { contact: true, invoice: true, bill: true },
    });
    if (!data) return res.status(404).json({ message: "Not found" });
    if (user.contactId && data.contactId !== user.contactId) return res.status(403).json({ message: "Forbidden" });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const companyId = user.companyId;
    const { contactId, invoiceId, billId, amount, method, date, reference, notes } = req.body;

    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ message: "A positive amount is required" });
    if (!invoiceId && !billId) return res.status(400).json({ message: "invoiceId or billId is required" });
    if (!method) return res.status(400).json({ message: "Payment method is required" });

    const payment = await prisma.$transaction(async (tx) => {
      let resolvedContactId = contactId;

      if (invoiceId) {
        const inv = await tx.invoices.findFirst({ where: { id: invoiceId, companyId } });
        if (!inv) throw new Error("Invoice not found");
        const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
        if (amt > outstanding + 0.01) throw new Error(`Payment ${amt} exceeds outstanding ${outstanding.toFixed(2)}`);
        resolvedContactId = inv.customerId;
        const newPaid = Number(inv.paidAmount) + amt;
        const status = newPaid >= Number(inv.totalAmount) - 0.01 ? 'PAID' : 'PARTIAL';
        await tx.invoices.update({ where: { id: invoiceId }, data: { paidAmount: newPaid, status } });
      }

      if (billId) {
        const bill = await tx.vendor_bills.findFirst({ where: { id: billId, companyId } });
        if (!bill) throw new Error("Bill not found");
        const outstanding = Number(bill.totalAmount) - Number(bill.paidAmount);
        if (amt > outstanding + 0.01) throw new Error(`Payment ${amt} exceeds outstanding ${outstanding.toFixed(2)}`);
        resolvedContactId = bill.vendorId;
        const newPaid = Number(bill.paidAmount) + amt;
        const status = newPaid >= Number(bill.totalAmount) - 0.01 ? 'PAID' : 'PARTIAL';
        await tx.vendor_bills.update({ where: { id: billId }, data: { paidAmount: newPaid, status } });
      }

      const p = await tx.payments.create({
        data: {
          id: `pay-${Date.now()}`,
          companyId,
          contactId: resolvedContactId,
          invoiceId: invoiceId || null,
          billId: billId || null,
          amount: amt,
          method,
          date: date ? new Date(date) : new Date(),
          reference,
          notes,
          updatedAt: new Date(),
        },
      });

      if (invoiceId) await AccountingService.recordCustomerPayment(companyId, p.id, amt, tx, user.id);
      if (billId) await AccountingService.recordVendorPayment(companyId, p.id, amt, tx, user.id);

      return p;
    });

    res.status(201).json(payment);
  } catch (error: any) {
    const msg = error.message || "Server Error";
    const status = /exceeds|not found|required/i.test(msg) ? 400 : 500;
    res.status(status).json({ message: msg });
  }
};

export const update = async (_req: Request, res: Response) => res.status(400).json({ message: "Payments are immutable" });
export const remove = async (_req: Request, res: Response) => res.status(400).json({ message: "Payments cannot be deleted" });
