import { Request, Response } from "express";
import prisma from "../../utils/prisma";
import { AccountingService } from "../../services/accounting.service";

// Chart of accounts (with running balances)
export const getAll = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    await AccountingService.ensureSystemAccounts(companyId);
    const accounts = await prisma.accounts.findMany({ where: { companyId }, orderBy: { code: 'asc' } });

    const lines = await prisma.journal_lines.findMany({ where: { companyId, journals: { status: 'POSTED' } } });
    const bal: Record<string, number> = {};
    for (const l of lines) {
      const d = Number(l.debit) - Number(l.credit);
      bal[l.accountId] = (bal[l.accountId] || 0) + d;
    }
    res.json(accounts.map((a) => {
      const raw = bal[a.id] || 0;
      const balance = a.type === 'ASSET' || a.type === 'EXPENSE' ? raw : -raw;
      return { ...a, balance };
    }));
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getOne = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const data = await prisma.accounts.findFirst({ where: { id: req.params.id, companyId } });
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const { code, name, type, normalBalance, description } = req.body;
    if (!code || !name || !type || !normalBalance) return res.status(400).json({ message: "code, name, type and normalBalance are required" });
    const data = await prisma.accounts.create({
      data: { id: `acc-${companyId}-${code}`, companyId, code, name, type, normalBalance, description, isSystem: false, updatedAt: new Date() },
    });
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const existing = await prisma.accounts.findFirst({ where: { id: req.params.id, companyId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    const { name, description, isActive } = req.body;
    const data = await prisma.accounts.update({ where: { id: req.params.id }, data: { name, description, isActive, updatedAt: new Date() } });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const existing = await prisma.accounts.findFirst({ where: { id: req.params.id, companyId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (existing.isSystem) return res.status(400).json({ message: "Cannot delete a system account" });
    const used = await prisma.journal_lines.count({ where: { accountId: req.params.id } });
    if (used > 0) return res.status(400).json({ message: "Cannot delete an account with journal entries" });
    await prisma.accounts.delete({ where: { id: req.params.id } });
    res.json({ message: "Deleted" });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ---- Journals ----
export const listJournals = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const data = await prisma.journals.findMany({
      where: { companyId },
      include: { journal_lines: { include: { accounts: true } } },
      orderBy: { date: 'desc' },
      take: 200,
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getJournal = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const data = await prisma.journals.findFirst({ where: { id: req.params.id, companyId }, include: { journal_lines: { include: { accounts: true } } } });
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Manual journal entry (validated: debit == credit server-side)
export const createJournal = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const companyId = user.companyId;
    const { date, memo, lines } = req.body;
    if (!Array.isArray(lines) || lines.length < 2) return res.status(400).json({ message: "At least two journal lines are required" });
    const entries = lines.map((l: any) => ({ accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description }));
    const journal = await AccountingService.postJournal(
      companyId,
      { date: date ? new Date(date) : new Date(), memo: memo || 'Manual entry', source: 'MANUAL', createdById: user.id },
      entries
    );
    res.status(201).json(journal);
  } catch (error: any) {
    const status = /Unbalanced|zero total/i.test(error.message) ? 400 : 500;
    res.status(status).json({ message: error.message });
  }
};

export const reverseJournal = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const rev = await AccountingService.reverseJournal(user.companyId, req.params.id, user.id);
    res.status(201).json(rev);
  } catch (error: any) {
    const status = /not found|reversal/i.test(error.message) ? 400 : 500;
    res.status(status).json({ message: error.message });
  }
};
