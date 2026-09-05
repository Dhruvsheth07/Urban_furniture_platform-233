import { Request, Response } from "express";
import ExcelJS from "exceljs";
import { parse } from "json2csv";
import prisma from "../../utils/prisma";
import { AccountingService } from "../../services/accounting.service";

async function accountBalances(companyId: string) {
  const lines = await prisma.journal_lines.findMany({
    where: { companyId, journals: { status: 'POSTED' } },
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
function signed(type: string, d: number, c: number) {
  return type === 'ASSET' || type === 'EXPENSE' ? d - c : c - d;
}

async function buildReportData(companyId: string, report: string): Promise<any[]> {
  const balances = await accountBalances(companyId);
  if (report === 'pl') {
    const rows: any[] = [];
    let rev = 0, exp = 0;
    for (const { account, debit, credit } of Object.values(balances)) {
      const bal = signed(account.type, debit, credit);
      if (account.type === 'INCOME') { rev += bal; rows.push({ Section: 'Revenue', Account: account.name, Amount: bal }); }
    }
    for (const { account, debit, credit } of Object.values(balances)) {
      const bal = signed(account.type, debit, credit);
      if (account.type === 'EXPENSE') { exp += bal; rows.push({ Section: 'Expense', Account: account.name, Amount: bal }); }
    }
    rows.push({ Section: 'Total', Account: 'Net Profit', Amount: rev - exp });
    return rows;
  }
  if (report === 'balancesheet') {
    const rows: any[] = [];
    let income = 0, expense = 0;
    for (const { account, debit, credit } of Object.values(balances)) {
      const bal = signed(account.type, debit, credit);
      if (['ASSET', 'LIABILITY', 'EQUITY'].includes(account.type)) {
        rows.push({ Section: account.type, Account: account.name, Balance: bal });
      } else if (account.type === 'INCOME') income += bal;
      else if (account.type === 'EXPENSE') expense += bal;
    }
    if (Math.abs(income - expense) > 0.001) rows.push({ Section: 'EQUITY', Account: 'Current Earnings', Balance: income - expense });
    return rows;
  }
  if (report === 'ar') {
    const invoices = await prisma.invoices.findMany({ where: { companyId, status: { in: ['OPEN', 'PARTIAL'] } }, include: { customer: true } });
    return invoices.map((i) => ({ Invoice: i.invoiceNumber, Customer: i.customer.name, Total: Number(i.totalAmount), Paid: Number(i.paidAmount), Outstanding: Number(i.totalAmount) - Number(i.paidAmount), DueDate: i.dueDate?.toISOString().slice(0, 10) }));
  }
  if (report === 'ap') {
    const bills = await prisma.vendor_bills.findMany({ where: { companyId, status: { in: ['OPEN', 'PARTIAL'] } }, include: { vendor: true } });
    return bills.map((b) => ({ Bill: b.billNumber, Vendor: b.vendor.name, Total: Number(b.totalAmount), Paid: Number(b.paidAmount), Outstanding: Number(b.totalAmount) - Number(b.paidAmount), DueDate: b.dueDate?.toISOString().slice(0, 10) }));
  }
  if (report === 'inventory') {
    const products = await prisma.products.findMany({ where: { companyId } });
    return products.map((p) => ({ SKU: p.sku, Product: p.name, OnHand: Number(p.onHandQty), AvgCost: Number(p.avgCost), Value: Number(p.onHandQty) * Number(p.avgCost), ReorderLevel: Number(p.reorderLevel) }));
  }
  return [];
}

export const exportReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = (req as any).user.companyId;
    const format = String(req.query.format || 'csv');
    const report = String(req.query.report || 'pl');

    const data = await buildReportData(companyId, report);
    if (data.length === 0) {
      // Provide an informative empty file rather than crashing
      data.push({ Note: 'No data available for this report' });
    }

    const fname = `${report}_${new Date().toISOString().slice(0, 10)}`;

    if (format === 'csv') {
      const csv = parse(data);
      res.header('Content-Type', 'text/csv');
      res.attachment(`${fname}.csv`);
      res.send(csv);
      return;
    }

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Report');
      sheet.columns = Object.keys(data[0]).map((key) => ({ header: key, key, width: 22 }));
      sheet.getRow(1).font = { bold: true };
      data.forEach((row) => sheet.addRow(row));
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment(`${fname}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
      return;
    }

    res.status(400).json({ message: "Invalid format. Use csv or xlsx." });
  } catch (error: any) {
    res.status(500).json({ message: "Export Error", error: error.message });
  }
};
