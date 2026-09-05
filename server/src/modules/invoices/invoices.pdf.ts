import { Request, Response } from "express";
import PDFDocument from 'pdfkit';
import prisma from "../../utils/prisma";

const inr = (n: number) => `INR ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const downloadPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const invoice = await prisma.invoices.findFirst({
      where: { id: req.params.id as string, companyId: user.companyId },
      include: { customer: true, lines: { include: { product: true } } },
    });

    if (!invoice) {
      res.status(404).json({ message: "Invoice not found" });
      return;
    }

    // Portal users may only download their own invoices
    if (user.contactId && invoice.customerId !== user.contactId) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const company = await prisma.companies.findUnique({ where: { id: invoice.companyId } });
    const cust = invoice.customer;

    // Derive net/tax from lines (line.total includes tax)
    let subtotal = 0, taxTotal = 0;
    const rows = invoice.lines.map((line: any) => {
      const qty = Number(line.quantity);
      const unit = Number(line.unitPrice);
      const net = qty * unit;
      const total = Number(line.total);
      const tax = Math.max(0, total - net);
      subtotal += net;
      taxTotal += tax;
      return { name: line.product?.name || 'Item', qty, unit, taxRate: Number(line.taxRate), net, tax, total };
    });
    const grandTotal = Number(invoice.totalAmount);
    const paid = Number(invoice.paidAmount);
    const balance = grandTotal - paid;

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const filename = encodeURIComponent(`Invoice_${invoice.invoiceNumber}.pdf`);
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res);

    // Header — company block
    doc.fontSize(20).fillColor('#0f172a').text(company?.name || 'Urban Furniture', 50, 50);
    doc.fontSize(9).fillColor('#475569');
    const addr = [company?.addressLine1, company?.addressLine2, [company?.city, company?.state, company?.pincode].filter(Boolean).join(', ')].filter(Boolean);
    addr.forEach((l) => doc.text(l as string));
    if (company?.gstin) doc.text(`GSTIN: ${company.gstin}`);
    if (company?.email) doc.text(company.email);
    if (company?.phone) doc.text(company.phone);

    // Invoice meta (right aligned)
    doc.fontSize(22).fillColor('#0f172a').text('TAX INVOICE', 300, 50, { align: 'right' });
    doc.fontSize(10).fillColor('#475569');
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, 300, 80, { align: 'right' });
    doc.text(`Date: ${new Date(invoice.date).toLocaleDateString('en-IN')}`, { align: 'right' });
    if (invoice.dueDate) doc.text(`Due: ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}`, { align: 'right' });
    doc.text(`Status: ${invoice.status}`, { align: 'right' });

    // Bill To
    doc.moveDown(2);
    let y = 160;
    doc.fontSize(11).fillColor('#0f172a').text('Bill To', 50, y);
    doc.fontSize(10).fillColor('#334155');
    doc.text(cust.name, 50, y + 16);
    const custAddr = [cust.billingLine1, cust.billingLine2, [cust.billingCity, cust.billingState, cust.billingPincode].filter(Boolean).join(', ')].filter(Boolean);
    custAddr.forEach((l) => doc.text(l as string));
    if (cust.gstin) doc.text(`GSTIN: ${cust.gstin}`);
    if (cust.email) doc.text(cust.email);

    // Line-item table
    y = 280;
    const col = { item: 50, qty: 300, rate: 350, tax: 420, amount: 480 };
    doc.fontSize(9).fillColor('#ffffff');
    doc.rect(50, y, 500, 20).fill('#0f172a');
    doc.fillColor('#ffffff');
    doc.text('Item', col.item + 4, y + 6);
    doc.text('Qty', col.qty, y + 6, { width: 40, align: 'right' });
    doc.text('Rate', col.rate, y + 6, { width: 60, align: 'right' });
    doc.text('Tax', col.tax, y + 6, { width: 50, align: 'right' });
    doc.text('Amount', col.amount, y + 6, { width: 66, align: 'right' });

    y += 24;
    doc.fillColor('#334155').fontSize(9);
    rows.forEach((r) => {
      doc.text(r.name, col.item + 4, y, { width: 240 });
      doc.text(String(r.qty), col.qty, y, { width: 40, align: 'right' });
      doc.text(r.unit.toLocaleString('en-IN', { minimumFractionDigits: 2 }), col.rate, y, { width: 60, align: 'right' });
      doc.text(`${r.taxRate}%`, col.tax, y, { width: 50, align: 'right' });
      doc.text(r.total.toLocaleString('en-IN', { minimumFractionDigits: 2 }), col.amount, y, { width: 66, align: 'right' });
      y += 18;
    });

    // Totals
    doc.moveTo(50, y + 4).lineTo(550, y + 4).strokeColor('#e2e8f0').stroke();
    y += 12;
    const totalRow = (label: string, value: string, bold = false) => {
      doc.fontSize(bold ? 12 : 10).fillColor(bold ? '#0f172a' : '#475569');
      doc.text(label, 350, y, { width: 100, align: 'right' });
      doc.text(value, 460, y, { width: 86, align: 'right' });
      y += bold ? 20 : 16;
    };
    totalRow('Subtotal', inr(subtotal));
    totalRow('GST', inr(taxTotal));
    totalRow('Total', inr(grandTotal), true);
    if (paid > 0) {
      totalRow('Paid', inr(paid));
      totalRow('Balance Due', inr(balance), true);
    }

    if (invoice.notes) {
      doc.moveDown(2).fontSize(9).fillColor('#64748b').text(`Notes: ${invoice.notes}`, 50, y + 20, { width: 500 });
    }

    doc.fontSize(8).fillColor('#94a3b8').text('This is a computer-generated invoice.', 50, 780, { align: 'center', width: 500 });

    doc.end();
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
