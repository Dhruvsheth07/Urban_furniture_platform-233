import { Request, Response } from "express";
import prisma from "../../utils/prisma";

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
