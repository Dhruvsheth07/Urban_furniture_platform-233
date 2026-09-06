import { Request, Response } from "express";
import { GoogleGenAI } from '@google/genai';
import prisma from "../../utils/prisma";
import { extractTextFromPdfBuffer, parseInvoiceText } from "../../services/ocr.service";

// ---- Supplier bill extraction (OCR; human confirms before posting) ----
export const parseSupplierBill = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No PDF uploaded' });
      return;
    }

    const companyId = (req as any).user.companyId;

    // Step 1 — extract raw text via pdfjs-dist + Tesseract.js
    let rawText = '';
    try {
      rawText = await extractTextFromPdfBuffer(req.file.buffer);
    } catch (ocrErr: any) {
      console.error('[OCR] Extraction error:', ocrErr.message);
      rawText = '';
    }

    // Step 2 — parse structured fields from raw text
    const { extracted, confidence } = rawText.trim().length > 20
      ? parseInvoiceText(rawText)
      : {
          extracted: {
            vendorName: '', invoiceNumber: '',
            date: new Date().toISOString().slice(0, 10),
            dueDate: null, items: [], subtotal: 0, taxAmount: 0, totalAmount: 0,
          },
          confidence: 'LOW' as const,
        };

    // Step 3 — duplicate detection
    let duplicate = null;
    if (extracted.invoiceNumber) {
      const existing = await prisma.vendor_bills.findFirst({
        where: { companyId, billNumber: extracted.invoiceNumber },
      });
      if (existing) duplicate = { id: existing.id, billNumber: existing.billNumber };
    }

    // Step 4 — vendor name fuzzy match
    let matchedVendorId = null;
    if (extracted.vendorName) {
      const vendor = await prisma.contacts.findFirst({
        where: {
          companyId,
          type: { in: ['VENDOR', 'BOTH'] },
          name: { contains: extracted.vendorName, mode: 'insensitive' },
        },
      });
      if (vendor) matchedVendorId = vendor.id;
    }

    // Step 5 — warnings for missing/low-confidence fields
    const warnings: string[] = [];
    if (duplicate) warnings.push(`An existing bill ${duplicate.billNumber} matches this invoice number.`);
    if (!extracted.vendorName) warnings.push('Vendor name could not be extracted — please select manually.');
    if (!extracted.totalAmount) warnings.push('Total amount could not be determined — please verify.');
    if (!matchedVendorId && extracted.vendorName) warnings.push(`No existing vendor matches "${extracted.vendorName}".`);
    if (extracted.items.length === 0) warnings.push('No line items were detected — you may need to add them manually.');

    res.json({ extracted, confidence, duplicate, matchedVendorId, warnings, requiresConfirmation: true, source: 'tesseract-ocr' });
  } catch (error: any) {
    res.status(500).json({ message: "OCR Parsing Error", error: error.message });
  }
};

// ---- Ask Your Business: controlled tool queries, grounded in real data ----
async function gatherContext(companyId: string) {
  const lines = await prisma.journal_lines.findMany({ where: { companyId, journals: { status: 'POSTED' } }, include: { accounts: true } });
  let revenue = 0, expense = 0, cash = 0, ar = 0, ap = 0;
  for (const l of lines) {
    const acc = (l as any).accounts;
    const d = Number(l.debit), c = Number(l.credit);
    if (acc.type === 'INCOME') revenue += c - d;
    else if (acc.type === 'EXPENSE') expense += d - c;
    else if (acc.code === '1000' || acc.code === '1010') cash += d - c;
    else if (acc.code === '1200') ar += d - c;
    else if (acc.code === '2000') ap += d - c;
  }
  const now = new Date();
  const overdue = await prisma.invoices.findMany({ where: { companyId, status: { in: ['OPEN', 'PARTIAL'] }, dueDate: { lt: now } }, include: { customer: true }, orderBy: { dueDate: 'asc' }, take: 10 });
  const topDebtors = await prisma.contacts.findMany({ where: { companyId, type: { in: ['CUSTOMER', 'BOTH'] } }, include: { invoices: { where: { status: { in: ['OPEN', 'PARTIAL'] } } } } });
  const debtors = topDebtors
    .map((c) => ({ name: c.name, owed: c.invoices.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0) }))
    .filter((d) => d.owed > 0)
    .sort((a, b) => b.owed - a.owed)
    .slice(0, 5);
  const lowStock = (await prisma.products.findMany({ where: { companyId, trackInventory: true } }))
    .filter((p) => Number(p.reorderLevel) > 0 && Number(p.onHandQty) <= Number(p.reorderLevel))
    .map((p) => ({ name: p.name, onHand: Number(p.onHandQty), reorderLevel: Number(p.reorderLevel) }));

  return {
    revenue, expense, netProfit: revenue - expense, cash, receivables: ar, payables: ap,
    overdueInvoices: overdue.map((i) => ({ invoiceNumber: i.invoiceNumber, customer: i.customer.name, outstanding: Number(i.totalAmount) - Number(i.paidAmount), dueDate: i.dueDate })),
    topDebtors: debtors,
    lowStock,
  };
}

function fmt(n: number) { return `₹${Math.round(n).toLocaleString('en-IN')}`; }

// Deterministic answers for common questions (works without an API key)
function localAnswer(question: string, ctx: any): string | null {
  const q = question.toLowerCase();
  if (/(profit|net income|earnings)/.test(q)) {
    return `Net profit is ${fmt(ctx.netProfit)} — revenue ${fmt(ctx.revenue)} minus expenses ${fmt(ctx.expense)}.`;
  }
  if (/(owe|owes|debtor|receivable|who.*most)/.test(q)) {
    if (ctx.topDebtors.length === 0) return 'No customers currently have an outstanding balance.';
    return 'Top customers by outstanding balance:\n' + ctx.topDebtors.map((d: any, i: number) => `${i + 1}. ${d.name} — ${fmt(d.owed)}`).join('\n');
  }
  if (/overdue/.test(q)) {
    if (ctx.overdueInvoices.length === 0) return 'There are no overdue invoices right now.';
    return `${ctx.overdueInvoices.length} overdue invoice(s):\n` + ctx.overdueInvoices.map((i: any) => `• ${i.invoiceNumber} — ${i.customer} — ${fmt(i.outstanding)}`).join('\n');
  }
  if (/(low stock|reorder|inventory|out of stock)/.test(q)) {
    if (ctx.lowStock.length === 0) return 'No products are below their reorder level.';
    return 'Products below reorder level:\n' + ctx.lowStock.map((p: any) => `• ${p.name} — ${p.onHand} on hand (reorder at ${p.reorderLevel})`).join('\n');
  }
  if (/(revenue|sales|income)/.test(q)) {
    return `Total recognized revenue is ${fmt(ctx.revenue)}.`;
  }
  if (/(cash|bank|liquidity)/.test(q)) {
    return `Current cash & bank balance is ${fmt(ctx.cash)}.`;
  }
  return null;
}

export const askBusiness = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = (req as any).user.companyId;
    const { question } = req.body;
    if (!question) { res.status(400).json({ message: 'A question is required' }); return; }

    const ctx = await gatherContext(companyId);
    const local = localAnswer(question, ctx);

    if (!process.env.GEMINI_API_KEY) {
      res.json({ answer: local || "I can answer questions about profit, revenue, cash, overdue invoices, top debtors and low stock. Try one of those.", grounded: ctx, source: 'local' });
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          `You are the financial assistant for Urban Furniture. Answer ONLY from the JSON business data provided. All amounts are INR (₹). If the data does not contain the answer, say so. Be concise.\n\nBUSINESS DATA:\n${JSON.stringify(ctx)}`,
          question,
        ],
      });
      res.json({ answer: response.text || local || 'No answer available.', grounded: ctx, source: 'ai' });
    } catch {
      res.json({ answer: local || 'AI service is unavailable right now.', grounded: ctx, source: 'local-fallback' });
    }
  } catch (error: any) {
    res.status(500).json({ message: "AI Error", error: error.message });
  }
};
