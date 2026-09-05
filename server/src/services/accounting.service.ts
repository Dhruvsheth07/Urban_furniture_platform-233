import prisma from '../utils/prisma';
import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

// Standard chart of accounts for Urban Furniture (INR).
const SYSTEM_ACCOUNTS = [
  { code: '1000', name: 'Cash', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1010', name: 'Bank', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1200', name: 'Accounts Receivable', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1300', name: 'Inventory', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '2000', name: 'Accounts Payable', type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: '2100', name: 'GST Payable', type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: '2110', name: 'GST Input Credit', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '3000', name: 'Owner Equity', type: 'EQUITY', normalBalance: 'CREDIT' },
  { code: '3900', name: 'Retained Earnings', type: 'EQUITY', normalBalance: 'CREDIT' },
  { code: '4000', name: 'Sales Revenue', type: 'INCOME', normalBalance: 'CREDIT' },
  { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '6000', name: 'Operating Expenses', type: 'EXPENSE', normalBalance: 'DEBIT' },
] as const;

export interface JournalEntry {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export const AccountingService = {
  systemAccountDefs: SYSTEM_ACCOUNTS,

  async ensureSystemAccounts(companyId: string, client: Tx | typeof prisma = prisma) {
    const db = client as any;
    const map: Record<string, any> = {};
    for (const acc of SYSTEM_ACCOUNTS) {
      const id = `acc-${companyId}-${acc.code}`;
      const existing = await db.accounts.findUnique({
        where: { companyId_code: { companyId, code: acc.code } },
      });
      map[acc.code] = existing
        ? existing
        : await db.accounts.create({
            data: {
              id,
              companyId,
              code: acc.code,
              name: acc.name,
              type: acc.type as any,
              normalBalance: acc.normalBalance as any,
              isSystem: true,
              updatedAt: new Date(),
            },
          });
    }
    return {
      cash: map['1000'],
      bank: map['1010'],
      ar: map['1200'],
      inventory: map['1300'],
      ap: map['2000'],
      gstPayable: map['2100'],
      gstInput: map['2110'],
      equity: map['3000'],
      retained: map['3900'],
      revenue: map['4000'],
      cogs: map['5000'],
      opex: map['6000'],
      byCode: map,
    };
  },

  async nextJournalNumber(companyId: string, client: Tx): Promise<string> {
    const count = await (client as any).journals.count({ where: { companyId } });
    const seq = count + 1;
    return `JNL-${String(seq).padStart(5, '0')}`;
  },

  /**
   * Post a balanced journal. Runs inside caller's transaction if provided.
   * Throws if debits != credits. idempotencyKey prevents duplicate posting.
   */
  async postJournal(
    companyId: string,
    opts: {
      date: Date;
      memo: string;
      source?: string;
      type?: 'MANUAL' | 'OPENING' | 'REVERSAL';
      idempotencyKey?: string;
      createdById?: string;
    },
    entries: JournalEntry[],
    client?: Tx
  ) {
    const run = async (tx: Tx) => {
      const totalDebit = round2(entries.reduce((s, e) => s + e.debit, 0));
      const totalCredit = round2(entries.reduce((s, e) => s + e.credit, 0));
      if (Math.abs(totalDebit - totalCredit) > 0.001) {
        throw new Error(`Unbalanced journal. Debit ${totalDebit} != Credit ${totalCredit}`);
      }
      if (totalDebit === 0) {
        throw new Error('Journal has zero total');
      }

      if (opts.idempotencyKey) {
        const dup = await (tx as any).journals.findUnique({
          where: { companyId_idempotencyKey: { companyId, idempotencyKey: opts.idempotencyKey } },
        });
        if (dup) return dup;
      }

      const number = await this.nextJournalNumber(companyId, tx);
      const journal = await (tx as any).journals.create({
        data: {
          id: `jnl-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          companyId,
          number,
          date: opts.date,
          memo: opts.memo,
          source: opts.source,
          type: opts.type || 'MANUAL',
          status: 'POSTED',
          idempotencyKey: opts.idempotencyKey,
          createdById: opts.createdById,
          postedById: opts.createdById,
          postedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      let lineNo = 1;
      for (const e of entries) {
        if (e.debit === 0 && e.credit === 0) continue;
        await (tx as any).journal_lines.create({
          data: {
            id: `jl-${journal.id}-${lineNo}`,
            companyId,
            journalId: journal.id,
            accountId: e.accountId,
            debit: round2(e.debit),
            credit: round2(e.credit),
            description: e.description || opts.memo,
            lineNo: lineNo++,
          },
        });
      }
      return journal;
    };

    if (client) return run(client);
    return prisma.$transaction(run);
  },

  /** Reverse a posted journal by creating a mirror entry. */
  async reverseJournal(companyId: string, journalId: string, createdById?: string) {
    return prisma.$transaction(async (tx) => {
      const original = await (tx as any).journals.findFirst({
        where: { id: journalId, companyId },
        include: { journal_lines: true },
      });
      if (!original) throw new Error('Journal not found');
      if (original.reversalOfId) throw new Error('Cannot reverse a reversal');

      const number = await this.nextJournalNumber(companyId, tx);
      const rev = await (tx as any).journals.create({
        data: {
          id: `jnl-rev-${Date.now()}`,
          companyId,
          number,
          date: new Date(),
          memo: `Reversal of ${original.number}`,
          type: 'REVERSAL',
          status: 'POSTED',
          reversalOfId: original.id,
          source: original.source,
          createdById,
          postedById: createdById,
          postedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      let lineNo = 1;
      for (const l of original.journal_lines) {
        await (tx as any).journal_lines.create({
          data: {
            id: `jl-${rev.id}-${lineNo}`,
            companyId,
            journalId: rev.id,
            accountId: l.accountId,
            debit: l.credit,
            credit: l.debit,
            description: `Reversal: ${l.description || ''}`,
            lineNo: lineNo++,
          },
        });
      }
      return rev;
    });
  },

  /**
   * Sale invoice posting: AR (gross) = Revenue (net) + GST Payable (tax),
   * plus COGS = Inventory at average cost.
   */
  async recordSaleInvoice(
    companyId: string,
    invoiceId: string,
    amounts: { net: number; tax: number; cogs: number },
    client: Tx,
    createdById?: string
  ) {
    const a = await this.ensureSystemAccounts(companyId, client);
    const gross = round2(amounts.net + amounts.tax);
    const entries: JournalEntry[] = [
      { accountId: a.ar.id, debit: gross, credit: 0, description: 'Accounts Receivable' },
      { accountId: a.revenue.id, debit: 0, credit: round2(amounts.net), description: 'Sales Revenue' },
    ];
    if (amounts.tax > 0) {
      entries.push({ accountId: a.gstPayable.id, debit: 0, credit: round2(amounts.tax), description: 'GST Payable' });
    }
    if (amounts.cogs > 0) {
      entries.push({ accountId: a.cogs.id, debit: round2(amounts.cogs), credit: 0, description: 'Cost of Goods Sold' });
      entries.push({ accountId: a.inventory.id, debit: 0, credit: round2(amounts.cogs), description: 'Inventory' });
    }
    return this.postJournal(
      companyId,
      { date: new Date(), memo: `Invoice ${invoiceId}`, source: `INVOICE:${invoiceId}`, idempotencyKey: `INVOICE:${invoiceId}`, createdById },
      entries,
      client
    );
  },

  /** Vendor bill: Inventory + GST Input (dr) = AP (cr). */
  async recordVendorBill(
    companyId: string,
    billId: string,
    amounts: { net: number; tax: number },
    client: Tx,
    createdById?: string
  ) {
    const a = await this.ensureSystemAccounts(companyId, client);
    const gross = round2(amounts.net + amounts.tax);
    const entries: JournalEntry[] = [
      { accountId: a.inventory.id, debit: round2(amounts.net), credit: 0, description: 'Inventory' },
    ];
    if (amounts.tax > 0) {
      entries.push({ accountId: a.gstInput.id, debit: round2(amounts.tax), credit: 0, description: 'GST Input Credit' });
    }
    entries.push({ accountId: a.ap.id, debit: 0, credit: gross, description: 'Accounts Payable' });
    return this.postJournal(
      companyId,
      { date: new Date(), memo: `Vendor Bill ${billId}`, source: `BILL:${billId}`, idempotencyKey: `BILL:${billId}`, createdById },
      entries,
      client
    );
  },

  /** Customer payment: Bank (dr) = AR (cr). */
  async recordCustomerPayment(companyId: string, paymentId: string, amount: number, client: Tx, createdById?: string) {
    const a = await this.ensureSystemAccounts(companyId, client);
    return this.postJournal(
      companyId,
      { date: new Date(), memo: `Customer Payment ${paymentId}`, source: `PAYMENT:${paymentId}`, idempotencyKey: `PAYMENT:${paymentId}`, createdById },
      [
        { accountId: a.bank.id, debit: round2(amount), credit: 0, description: 'Bank' },
        { accountId: a.ar.id, debit: 0, credit: round2(amount), description: 'Accounts Receivable' },
      ],
      client
    );
  },

  /** Vendor payment: AP (dr) = Bank (cr). */
  async recordVendorPayment(companyId: string, paymentId: string, amount: number, client: Tx, createdById?: string) {
    const a = await this.ensureSystemAccounts(companyId, client);
    return this.postJournal(
      companyId,
      { date: new Date(), memo: `Vendor Payment ${paymentId}`, source: `PAYMENT:${paymentId}`, idempotencyKey: `PAYMENT:${paymentId}`, createdById },
      [
        { accountId: a.ap.id, debit: round2(amount), credit: 0, description: 'Accounts Payable' },
        { accountId: a.bank.id, debit: 0, credit: round2(amount), description: 'Bank' },
      ],
      client
    );
  },
};
