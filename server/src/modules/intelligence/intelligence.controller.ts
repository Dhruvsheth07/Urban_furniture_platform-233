import { Request, Response } from "express";
import nodemailer from "nodemailer";
import prisma from "../../utils/prisma";

// ---- Helpers ----
const fmt = (n: number) => `\u20B9${Math.round(n).toLocaleString('en-IN')}`;

function emailShell(body: string): string {
  return `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:20px">
  <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
    <div style="background:#0f172a;padding:24px 32px">
      <h2 style="color:white;margin:0;font-size:20px;font-weight:600">Urban Furniture</h2>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">Business Operations</p>
    </div>
    <div style="padding:32px">${body}</div>
    <div style="background:#f1f5f9;padding:16px 32px;text-align:center">
      <p style="color:#94a3b8;margin:0;font-size:12px">Urban Furniture &middot; Automated billing notification.</p>
    </div>
  </div>
</div>`;
}

function buildOverdueEmail(customerName: string, invoiceNo: string, days: number, outstanding: number) {
  return emailShell(`
    <p style="color:#0f172a;font-size:16px;margin-top:0">Dear <strong>${customerName}</strong>,</p>
    <p style="color:#475569">We hope this finds you well. We are writing regarding the following outstanding invoice:</p>
    <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:16px 20px;margin:20px 0">
      <p style="margin:0 0 8px;color:#0f172a"><strong>Invoice:</strong> ${invoiceNo}</p>
      <p style="margin:0 0 8px;color:#0f172a"><strong>Days Overdue:</strong> ${days} day(s)</p>
      <p style="margin:0;color:#ef4444;font-size:18px;font-weight:700">Amount Due: ${fmt(outstanding)}</p>
    </div>
    <p style="color:#475569">We kindly request settlement at the earliest. If payment has already been made, please share the details with us.</p>
    <p style="color:#475569;margin-bottom:0">Warm regards,<br><strong>Finance Team</strong><br>Urban Furniture</p>
  `);
}

function buildUpcomingEmail(customerName: string, invoiceNo: string, daysUntilDue: number, amount: number) {
  return emailShell(`
    <p style="color:#0f172a;font-size:16px;margin-top:0">Dear <strong>${customerName}</strong>,</p>
    <p style="color:#475569">This is a friendly reminder that the following invoice is due soon:</p>
    <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;padding:16px 20px;margin:20px 0">
      <p style="margin:0 0 8px;color:#0f172a"><strong>Invoice:</strong> ${invoiceNo}</p>
      <p style="margin:0 0 8px;color:#0f172a"><strong>Due In:</strong> ${daysUntilDue} day(s)</p>
      <p style="margin:0;color:#f59e0b;font-size:18px;font-weight:700">Amount: ${fmt(amount)}</p>
    </div>
    <p style="color:#475569">Please arrange payment before the due date to avoid any late charges. Contact us if you need assistance.</p>
    <p style="color:#475569;margin-bottom:0">Warm regards,<br><strong>Finance Team</strong><br>Urban Furniture</p>
  `);
}

function buildLowStockEmail(vendorName: string, productName: string, sku: string, currentQty: number, reorderQty: number) {
  return emailShell(`
    <p style="color:#0f172a;font-size:16px;margin-top:0">Dear <strong>${vendorName}</strong>,</p>
    <p style="color:#475569">We hope this finds you well. We are writing to enquire about restocking the following product:</p>
    <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;padding:16px 20px;margin:20px 0">
      <p style="margin:0 0 8px;color:#0f172a"><strong>Product:</strong> ${productName}</p>
      <p style="margin:0 0 8px;color:#0f172a"><strong>SKU:</strong> ${sku}</p>
      <p style="margin:0 0 8px;color:#0f172a"><strong>Current Stock:</strong> ${currentQty} units</p>
      <p style="margin:0;color:#16a34a;font-size:18px;font-weight:700">Quantity Required: ${reorderQty} units</p>
    </div>
    <p style="color:#475569">Kindly confirm availability, pricing, and earliest delivery date at your convenience.</p>
    <p style="color:#475569;margin-bottom:0">Best regards,<br><strong>Procurement Team</strong><br>Urban Furniture</p>
  `);
}

function makeTransporter() {
  if (!(process.env.SMTP_HOST && process.env.SMTP_USER)) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
  });
}

async function buildEmailPayload(companyId: string, type: string, referenceId: string) {
  if (type === 'OVERDUE_INVOICE' || type === 'UPCOMING_DUE') {
    const inv = await prisma.invoices.findFirst({
      where: { id: referenceId, companyId },
      include: { customer: true },
    });
    if (!inv) throw new Error('Invoice not found');
    if (!inv.customer.email) throw new Error(`Customer "${inv.customer.name}" has no email address. Add it in Contacts.`);
    const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
    const now = Date.now();
    if (type === 'OVERDUE_INVOICE') {
      const days = inv.dueDate ? Math.floor((now - new Date(inv.dueDate).getTime()) / 86400000) : 0;
      return {
        to: inv.customer.email,
        toName: inv.customer.name,
        subject: `Payment Reminder: Invoice ${inv.invoiceNumber}`,
        html: buildOverdueEmail(inv.customer.name, inv.invoiceNumber, days, outstanding),
        preview: `Overdue reminder to ${inv.customer.name} for invoice ${inv.invoiceNumber} (${days} day(s) overdue, ${fmt(outstanding)} outstanding).`,
      };
    } else {
      const daysUntilDue = inv.dueDate ? Math.ceil((new Date(inv.dueDate).getTime() - now) / 86400000) : 0;
      return {
        to: inv.customer.email,
        toName: inv.customer.name,
        subject: `Friendly Reminder: Invoice ${inv.invoiceNumber} due in ${daysUntilDue} day(s)`,
        html: buildUpcomingEmail(inv.customer.name, inv.invoiceNumber, daysUntilDue, outstanding),
        preview: `Upcoming reminder to ${inv.customer.name} for invoice ${inv.invoiceNumber} (due in ${daysUntilDue} day(s), ${fmt(outstanding)}).`,
      };
    }
  }

  if (type === 'LOW_STOCK') {
    const product = await prisma.products.findFirst({ where: { id: referenceId, companyId } });
    if (!product) throw new Error('Product not found');
    const poLine = await (prisma as any).purchase_order_lines.findFirst({
      where: { productId: referenceId },
      include: { order: { include: { vendor: true } } },
    });
    const vendor = poLine?.order?.vendor;
    if (!vendor?.email) throw new Error(`No vendor with an email address found for "${product.name}". Link a vendor via a purchase order, or add an email to a vendor contact.`);
    const onHand = Number(product.onHandQty);
    const reorderQty = Math.max(Number(product.reorderLevel) * 2, 10);
    return {
      to: vendor.email,
      toName: vendor.name,
      subject: `Restock Enquiry: ${product.name}`,
      html: buildLowStockEmail(vendor.name, product.name, product.sku, onHand, reorderQty),
      preview: `Restock enquiry to ${vendor.name} for product "${product.name}" (SKU: ${product.sku}, current stock: ${onHand}, requesting: ${reorderQty} units).`,
    };
  }

  throw new Error(`Email not supported for action type: ${type}`);
}

// ---- Smart Reorder: explainable, based on actual sales velocity ----
export const getSmartReorder = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const products = await prisma.products.findMany({ where: { companyId, trackInventory: true, isActive: true } });

    // Sales velocity from stock OUT movements over the last 30 days
    const since = new Date(Date.now() - 30 * 86400000);
    const movements = await prisma.stock_movements.findMany({
      where: { companyId, type: { in: ['OUT'] }, createdAt: { gte: since } },
    });
    const soldByProduct: Record<string, number> = {};
    for (const m of movements) {
      soldByProduct[m.productId] = (soldByProduct[m.productId] || 0) + Math.abs(Number(m.quantity));
    }

    const leadTimeDays = 7;
    const recs = products.map((p) => {
      const sold30 = soldByProduct[p.id] || 0;
      const avgDailySales = Math.round((sold30 / 30) * 100) / 100;
      const safetyStock = Math.ceil(avgDailySales * 3);
      const reorderPoint = Math.ceil(avgDailySales * leadTimeDays + safetyStock);
      const onHand = Number(p.onHandQty);
      const configuredLevel = Number(p.reorderLevel);
      const effectivePoint = Math.max(reorderPoint, configuredLevel);
      const daysToStockout = avgDailySales > 0 ? Math.floor(onHand / avgDailySales) : null;

      let recommendedQty = 0;
      let reason = "Stock is healthy";
      if (onHand <= effectivePoint) {
        recommendedQty = Math.max(effectivePoint - onHand + Math.ceil(avgDailySales * 14), Math.ceil(effectivePoint * 0.5));
        reason = daysToStockout !== null
          ? `On-hand ${onHand} is at/below reorder point ${effectivePoint}. Expected to run out in ~${daysToStockout} day(s) at current sales pace.`
          : `On-hand ${onHand} is at/below the configured reorder level ${effectivePoint}.`;
      }

      return {
        productId: p.id,
        product: { id: p.id, name: p.name, sku: p.sku },
        currentStock: onHand,
        avgDailySales,
        leadTimeDays,
        safetyStock,
        reorderPoint: effectivePoint,
        daysToStockout,
        recommendedQty,
        reason,
        purchasePrice: Number(p.purchasePrice),
      };
    });

    res.json(recs.filter((r) => r.recommendedQty > 0).sort((a, b) => (a.daysToStockout ?? 999) - (b.daysToStockout ?? 999)));
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ---- Customer Risk: from outstanding + overdue + payment history ----
export const getCustomerRisk = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const customers = await prisma.contacts.findMany({
      where: { companyId, type: { in: ['CUSTOMER', 'BOTH'] } },
      include: { invoices: true, payments: true },
    });
    const now = new Date();

    const scores = customers.map((c) => {
      let outstanding = 0;
      let overdueCount = 0;
      let maxDaysOverdue = 0;
      let totalInvoiced = 0;
      c.invoices.forEach((inv) => {
        totalInvoiced += Number(inv.totalAmount);
        if (inv.status !== 'PAID' && inv.status !== 'CANCELLED') {
          outstanding += Number(inv.totalAmount) - Number(inv.paidAmount);
          if (inv.dueDate && new Date(inv.dueDate) < now) {
            overdueCount++;
            const d = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
            maxDaysOverdue = Math.max(maxDaysOverdue, d);
          }
        }
      });

      let risk = "LOW";
      const reasons: string[] = [];
      if (maxDaysOverdue > 60 || outstanding > 200000) {
        risk = "HIGH";
      } else if (overdueCount > 0 || outstanding > 75000) {
        risk = "MEDIUM";
      }
      if (overdueCount > 0) reasons.push(`${overdueCount} overdue invoice(s), up to ${maxDaysOverdue} days late`);
      if (outstanding > 0) reasons.push(`₹${outstanding.toLocaleString('en-IN')} outstanding`);
      if (reasons.length === 0) reasons.push('No overdue invoices; healthy payment behavior');

      return {
        customer: { id: c.id, name: c.name },
        outstanding,
        overdueCount,
        maxDaysOverdue,
        totalInvoiced,
        risk,
        reason: reasons.join('. '),
      };
    });

    res.json(scores.filter((s) => s.totalInvoiced > 0 || s.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding));
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ---- Business Health: composite scores from real data ----
export const getBusinessHealth = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;

    const lines = await prisma.journal_lines.findMany({ where: { companyId, journals: { status: 'POSTED' } }, include: { accounts: true } });
    let revenue = 0, expense = 0, cash = 0, ar = 0, inventory = 0;
    for (const l of lines) {
      const acc = (l as any).accounts;
      const d = Number(l.debit), c = Number(l.credit);
      if (acc.type === 'INCOME') revenue += c - d;
      else if (acc.type === 'EXPENSE') expense += d - c;
      else if (acc.code === '1000' || acc.code === '1010') cash += d - c;
      else if (acc.code === '1200') ar += d - c;
      else if (acc.code === '1300') inventory += d - c;
    }
    const netProfit = revenue - expense;
    const margin = revenue > 0 ? netProfit / revenue : 0;

    const now = new Date();
    const overdue = await prisma.invoices.findMany({ where: { companyId, status: { in: ['OPEN', 'PARTIAL'] }, dueDate: { lt: now } } });
    const overdueAmount = overdue.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0);

    const products = await prisma.products.findMany({ where: { companyId, trackInventory: true } });
    const lowStock = products.filter((p) => Number(p.onHandQty) <= Number(p.reorderLevel) && Number(p.reorderLevel) > 0).length;

    function score(v: number) { return Math.max(0, Math.min(100, Math.round(v))); }

    const profitability = score(margin > 0 ? 50 + margin * 200 : 40 + margin * 100);
    const cashHealth = score(cash > 0 ? 60 + Math.min(40, cash / 5000) : 30);
    const revenueHealth = score(revenue > 0 ? 70 : 20);
    const receivablesHealth = score(ar > 0 ? 100 - Math.min(80, (overdueAmount / (ar || 1)) * 100) : 90);
    const inventoryHealth = score(products.length > 0 ? 100 - (lowStock / products.length) * 100 : 80);
    const customerHealth = score(overdue.length === 0 ? 90 : 90 - overdue.length * 10);

    const metrics = [
      { key: 'Revenue Health', score: revenueHealth, reason: revenue > 0 ? `₹${revenue.toLocaleString('en-IN')} in recognized revenue` : 'No revenue recorded yet' },
      { key: 'Profitability', score: profitability, reason: `Net margin ${(margin * 100).toFixed(1)}% (profit ₹${netProfit.toLocaleString('en-IN')})` },
      { key: 'Cash Health', score: cashHealth, reason: `Cash & bank balance ₹${cash.toLocaleString('en-IN')}` },
      { key: 'Receivables Health', score: receivablesHealth, reason: `₹${overdueAmount.toLocaleString('en-IN')} overdue of ₹${ar.toLocaleString('en-IN')} receivable` },
      { key: 'Inventory Health', score: inventoryHealth, reason: `${lowStock} of ${products.length} products below reorder level` },
      { key: 'Customer Health', score: customerHealth, reason: `${overdue.length} overdue invoice(s) across customers` },
    ];
    const overall = Math.round(metrics.reduce((s, m) => s + m.score, 0) / metrics.length);

    res.json({ overall, metrics, summary: { revenue, expense, netProfit, cash, receivables: ar, overdueAmount } });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ---- Action Center: computed live from real data ----
export const getActionCenter = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const now = new Date();
    const actions: any[] = [];

    // Overdue invoices
    const overdue = await prisma.invoices.findMany({
      where: { companyId, status: { in: ['OPEN', 'PARTIAL'] }, dueDate: { lt: now } },
      include: { customer: true },
      orderBy: { dueDate: 'asc' },
    });
    for (const inv of overdue) {
      const days = Math.floor((now.getTime() - new Date(inv.dueDate!).getTime()) / 86400000);
      actions.push({
        id: `overdue-${inv.id}`,
        type: 'OVERDUE_INVOICE',
        priority: days > 30 ? 'HIGH' : 'MEDIUM',
        title: `Overdue: ${inv.invoiceNumber} — ${inv.customer.name}`,
        amount: Number(inv.totalAmount) - Number(inv.paidAmount),
        detail: `${days} days overdue`,
        referenceId: inv.id,
        action: 'SEND_REMINDER',
      });
    }

    // Upcoming invoices (due in 1–7 days)
    const soonDue = await prisma.invoices.findMany({
      where: { companyId, status: { in: ['OPEN', 'PARTIAL'] }, dueDate: { gte: now, lte: new Date(Date.now() + 7 * 86400000) } },
      include: { customer: true },
      orderBy: { dueDate: 'asc' },
    });
    for (const inv of soonDue) {
      const daysUntil = Math.ceil((new Date(inv.dueDate!).getTime() - now.getTime()) / 86400000);
      const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
      if (outstanding <= 0) continue;
      actions.push({
        id: `upcoming-${inv.id}`,
        type: 'UPCOMING_DUE',
        priority: daysUntil <= 2 ? 'HIGH' : 'MEDIUM',
        title: `Due soon: ${inv.invoiceNumber} — ${inv.customer.name}`,
        amount: outstanding,
        detail: `Due in ${daysUntil} day(s)`,
        referenceId: inv.id,
        action: 'SEND_REMINDER',
        contactEmail: inv.customer.email,
        contactName: inv.customer.name,
      });
    }

    // Low stock
    const products = await prisma.products.findMany({ where: { companyId, trackInventory: true, isActive: true } });
    for (const p of products) {
      if (Number(p.reorderLevel) > 0 && Number(p.onHandQty) <= Number(p.reorderLevel)) {
        actions.push({
          id: `lowstock-${p.id}`,
          type: 'LOW_STOCK',
          priority: 'MEDIUM',
          title: `Low stock: ${p.name}`,
          detail: `${Number(p.onHandQty)} units remaining (reorder at ${Number(p.reorderLevel)})`,
          referenceId: p.id,
          action: 'CREATE_PO',
        });
      }
    }

    // Duplicate bill anomalies
    const anomalies = await prisma.anomalies.findMany({ where: { companyId, status: 'OPEN' }, orderBy: { createdAt: 'desc' } });
    for (const a of anomalies) {
      actions.push({
        id: `anomaly-${a.id}`,
        type: a.type,
        priority: a.severity,
        title: a.description,
        detail: 'Anomaly detected',
        referenceId: a.referenceId,
        action: 'REVIEW',
      });
    }

    const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    actions.sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
    res.json(actions);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ---- Email preview (no send) ----
export const previewEmail = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const { type, referenceId } = req.query as { type: string; referenceId: string };
    if (!type || !referenceId) return res.status(400).json({ message: 'type and referenceId are required' });
    const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER);
    const payload = await buildEmailPayload(companyId, type, referenceId);
    res.json({ ...payload, smtpConfigured });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// ---- Send email for an action ----
export const sendActionEmail = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const { type, referenceId } = req.body;
    if (!type || !referenceId) return res.status(400).json({ message: 'type and referenceId are required' });
    const transporter = makeTransporter();
    if (!transporter) return res.status(400).json({ message: 'SMTP not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM to your server .env file.' });
    const payload = await buildEmailPayload(companyId, type, referenceId);
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Urban Furniture" <finance@urbanfurniture.com>',
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    res.json({ sent: true, to: payload.to, toName: payload.toName, subject: payload.subject });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ---- Anomaly detection: duplicate bills + expense spikes ----
export const getAnomalies = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const anomalies = await prisma.anomalies.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });

    // Live duplicate bill detection (same vendor + amount within 7 days)
    const bills = await prisma.vendor_bills.findMany({ where: { companyId }, include: { vendor: true }, orderBy: { date: 'desc' } });
    const dupes: any[] = [];
    for (let i = 0; i < bills.length; i++) {
      for (let j = i + 1; j < bills.length; j++) {
        if (bills[i].vendorId === bills[j].vendorId &&
            Math.abs(Number(bills[i].totalAmount) - Number(bills[j].totalAmount)) < 0.01 &&
            Math.abs(new Date(bills[i].date).getTime() - new Date(bills[j].date).getTime()) < 7 * 86400000) {
          dupes.push({ type: 'DUPLICATE', severity: 'HIGH', description: `Possible duplicate bill: ${bills[i].billNumber} & ${bills[j].billNumber} (${bills[i].vendor.name}, ₹${Number(bills[i].totalAmount).toLocaleString('en-IN')})`, referenceId: bills[i].id });
        }
      }
    }
    res.json([...dupes, ...anomalies.map((a) => ({ type: a.type, severity: a.severity, description: a.description, referenceId: a.referenceId, status: a.status }))]);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ---- Cash flow forecast: naive projection from AR/AP due dates ----
export const getCashFlowForecast = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const now = new Date();
    const invoices = await prisma.invoices.findMany({ where: { companyId, status: { in: ['OPEN', 'PARTIAL'] } } });
    const bills = await prisma.vendor_bills.findMany({ where: { companyId, status: { in: ['OPEN', 'PARTIAL'] } } });

    const weeks: { week: string; inflow: number; outflow: number; net: number }[] = [];
    for (let w = 0; w < 6; w++) {
      const wStart = new Date(now.getTime() + w * 7 * 86400000);
      const wEnd = new Date(now.getTime() + (w + 1) * 7 * 86400000);
      let inflow = 0, outflow = 0;
      invoices.forEach((i) => { if (i.dueDate && new Date(i.dueDate) >= wStart && new Date(i.dueDate) < wEnd) inflow += Number(i.totalAmount) - Number(i.paidAmount); });
      bills.forEach((b) => { if (b.dueDate && new Date(b.dueDate) >= wStart && new Date(b.dueDate) < wEnd) outflow += Number(b.totalAmount) - Number(b.paidAmount); });
      weeks.push({ week: `Week ${w + 1}`, inflow, outflow, net: inflow - outflow });
    }
    res.json({ weeks });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
