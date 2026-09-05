import { Request, Response } from "express";
import prisma from "../../utils/prisma";
import { AccountingService } from "../../services/accounting.service";

// Sum debit/credit per account from posted journals, optionally date-bounded.
async function accountBalances(companyId: string, opts?: { start?: Date; end?: Date }) {
  const where: any = { companyId, journals: { status: 'POSTED' } };
  if (opts?.start || opts?.end) {
    where.journals.date = {};
    if (opts.start) where.journals.date.gte = opts.start;
    if (opts.end) where.journals.date.lte = opts.end;
  }
  const lines = await prisma.journal_lines.findMany({
    where,
    include: { accounts: true },
  });
  const map: Record<string, { account: any; debit: number; credit: number }> = {};
  for (const l of lines) {
    const acc = (l as any).accounts;
    if (!map[acc.id]) map[acc.id] = { account: acc, debit: 0, credit: 0 };
    map[acc.id].debit += Number(l.debit);
    map[acc.id].credit += Number(l.credit);
  }
  return map;
}

function signedBalance(type: string, debit: number, credit: number) {
  // Natural balance sign: assets/expenses positive on debit; others positive on credit
  if (type === 'ASSET' || type === 'EXPENSE') return debit - credit;
  return credit - debit;
}

function parseRange(req: Request) {
  const q = req.query;
  const start = q.startDate ? new Date(String(q.startDate)) : undefined;
  const end = q.endDate ? new Date(String(q.endDate)) : undefined;
  return { start, end };
}

export const getProfitAndLoss = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const { start, end } = parseRange(req);
    const balances = await accountBalances(companyId, { start, end });

    const income: any[] = [];
    const expense: any[] = [];
    let revenue = 0;
    let cogs = 0;
    let opex = 0;

    for (const { account, debit, credit } of Object.values(balances)) {
      const bal = signedBalance(account.type, debit, credit);
      if (account.type === 'INCOME') {
        revenue += bal;
        income.push({ code: account.code, name: account.name, amount: bal });
      } else if (account.type === 'EXPENSE') {
        if (account.code === '5000') cogs += bal;
        else opex += bal;
        expense.push({ code: account.code, name: account.name, amount: bal });
      }
    }

    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - opex;

    res.json({
      revenue,
      cogs,
      grossProfit,
      operatingExpenses: opex,
      expense: cogs + opex,
      netProfit,
      income: income.sort((a, b) => a.code.localeCompare(b.code)),
      expenses: expense.sort((a, b) => a.code.localeCompare(b.code)),
    });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getBalanceSheet = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const { end } = parseRange(req);
    const balances = await accountBalances(companyId, { end });

    const assets: any[] = [];
    const liabilities: any[] = [];
    const equity: any[] = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let income = 0;
    let expense = 0;

    for (const { account, debit, credit } of Object.values(balances)) {
      const bal = signedBalance(account.type, debit, credit);
      if (account.type === 'ASSET') {
        totalAssets += bal;
        assets.push({ code: account.code, name: account.name, balance: bal });
      } else if (account.type === 'LIABILITY') {
        totalLiabilities += bal;
        liabilities.push({ code: account.code, name: account.name, balance: bal });
      } else if (account.type === 'EQUITY') {
        totalEquity += bal;
        equity.push({ code: account.code, name: account.name, balance: bal });
      } else if (account.type === 'INCOME') {
        income += bal;
      } else if (account.type === 'EXPENSE') {
        expense += bal;
      }
    }

    // Current-period net income rolls into equity so the sheet balances.
    const netIncome = income - expense;
    if (Math.abs(netIncome) > 0.001) {
      equity.push({ code: '3950', name: 'Current Earnings', balance: netIncome });
      totalEquity += netIncome;
    }

    res.json({
      assets: totalAssets,
      liabilities: totalLiabilities,
      equity: totalEquity,
      balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
      assetAccounts: assets.sort((a, b) => a.code.localeCompare(b.code)),
      liabilityAccounts: liabilities.sort((a, b) => a.code.localeCompare(b.code)),
      equityAccounts: equity.sort((a, b) => a.code.localeCompare(b.code)),
    });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getTrialBalance = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const { start, end } = parseRange(req);
    const balances = await accountBalances(companyId, { start, end });
    const rows = Object.values(balances).map(({ account, debit, credit }) => ({
      code: account.code,
      name: account.name,
      type: account.type,
      debit,
      credit,
    }));
    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
    res.json({ rows: rows.sort((a, b) => a.code.localeCompare(b.code)), totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getGeneralLedger = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const { start, end } = parseRange(req);
    const accountId = req.query.accountId ? String(req.query.accountId) : undefined;
    const where: any = { companyId, journals: { status: 'POSTED' } };
    if (accountId) where.accountId = accountId;
    if (start || end) {
      where.journals.date = {};
      if (start) where.journals.date.gte = start;
      if (end) where.journals.date.lte = end;
    }
    const lines = await prisma.journal_lines.findMany({
      where,
      include: { accounts: true, journals: true },
      orderBy: [{ journals: { date: 'asc' } }],
    });
    const rows = lines.map((l: any) => ({
      date: l.journals.date,
      journalNumber: l.journals.number,
      accountCode: l.accounts.code,
      accountName: l.accounts.name,
      memo: l.description,
      debit: Number(l.debit),
      credit: Number(l.credit),
    }));
    res.json({ rows });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getAccountsReceivable = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const invoices = await prisma.invoices.findMany({
      where: { companyId, status: { in: ['OPEN', 'PARTIAL'] } },
      include: { customer: true },
      orderBy: { dueDate: 'asc' },
    });
    const now = new Date();
    const rows = invoices.map((inv) => {
      const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
      const daysOverdue = inv.dueDate ? Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000) : 0;
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customer: inv.customer.name,
        customerId: inv.customerId,
        date: inv.date,
        dueDate: inv.dueDate,
        total: Number(inv.totalAmount),
        paid: Number(inv.paidAmount),
        outstanding,
        daysOverdue: daysOverdue > 0 ? daysOverdue : 0,
        bucket: daysOverdue <= 0 ? 'Current' : daysOverdue <= 30 ? '1-30' : daysOverdue <= 60 ? '31-60' : '60+',
      };
    });
    const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);
    res.json({ rows, totalOutstanding });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getAccountsPayable = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const bills = await prisma.vendor_bills.findMany({
      where: { companyId, status: { in: ['OPEN', 'PARTIAL'] } },
      include: { vendor: true },
      orderBy: { dueDate: 'asc' },
    });
    const now = new Date();
    const rows = bills.map((b) => {
      const outstanding = Number(b.totalAmount) - Number(b.paidAmount);
      const daysOverdue = b.dueDate ? Math.floor((now.getTime() - new Date(b.dueDate).getTime()) / 86400000) : 0;
      return {
        id: b.id,
        billNumber: b.billNumber,
        vendor: b.vendor.name,
        vendorId: b.vendorId,
        date: b.date,
        dueDate: b.dueDate,
        total: Number(b.totalAmount),
        paid: Number(b.paidAmount),
        outstanding,
        daysOverdue: daysOverdue > 0 ? daysOverdue : 0,
        bucket: daysOverdue <= 0 ? 'Current' : daysOverdue <= 30 ? '1-30' : daysOverdue <= 60 ? '31-60' : '60+',
      };
    });
    const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);
    res.json({ rows, totalOutstanding });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getCashFlow = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const { start, end } = parseRange(req);
    const a = await AccountingService.ensureSystemAccounts(companyId);
    const cashIds = [a.cash.id, a.bank.id];
    const where: any = { companyId, accountId: { in: cashIds }, journals: { status: 'POSTED' } };
    if (start || end) {
      where.journals.date = {};
      if (start) where.journals.date.gte = start;
      if (end) where.journals.date.lte = end;
    }
    const lines = await prisma.journal_lines.findMany({ where, include: { journals: true } });
    let inflow = 0;
    let outflow = 0;
    for (const l of lines) {
      inflow += Number(l.debit);
      outflow += Number(l.credit);
    }
    res.json({ inflow, outflow, net: inflow - outflow });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Aggregated dashboard metrics computed from real data.
export const getDashboard = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const balances = await accountBalances(companyId);

    let revenue = 0, expense = 0, cash = 0, ar = 0, ap = 0, inventory = 0;
    for (const { account, debit, credit } of Object.values(balances)) {
      const bal = signedBalance(account.type, debit, credit);
      if (account.type === 'INCOME') revenue += bal;
      else if (account.type === 'EXPENSE') expense += bal;
      else if (account.code === '1000' || account.code === '1010') cash += bal;
      else if (account.code === '1200') ar += bal;
      else if (account.code === '2000') ap += bal;
      else if (account.code === '1300') inventory += bal;
    }

    const netProfit = revenue - expense;

    // Monthly revenue vs expense for the last 6 months
    const now = new Date();
    const months: { name: string; revenue: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const mBal = await accountBalances(companyId, { start: mStart, end: mEnd });
      let mRev = 0, mExp = 0;
      for (const { account, debit, credit } of Object.values(mBal)) {
        const bal = signedBalance(account.type, debit, credit);
        if (account.type === 'INCOME') mRev += bal;
        else if (account.type === 'EXPENSE') mExp += bal;
      }
      months.push({ name: mStart.toLocaleString('en-US', { month: 'short' }), revenue: mRev, expense: mExp });
    }

    // Overdue count
    const overdueInvoices = await prisma.invoices.count({
      where: { companyId, status: { in: ['OPEN', 'PARTIAL'] }, dueDate: { lt: now } },
    });

    // Inventory valuation from products (avgCost * onHand) as a cross-check
    const products = await prisma.products.findMany({ where: { companyId, trackInventory: true } });
    const inventoryValue = products.reduce((s, p) => s + Number(p.onHandQty) * Number(p.avgCost || p.purchasePrice), 0);

    res.json({
      revenue,
      expense,
      netProfit,
      cash,
      receivables: ar,
      payables: ap,
      inventoryValue: inventoryValue || inventory,
      overdueInvoices,
      monthly: months,
    });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
