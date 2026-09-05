import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import api, { apiError } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { inr, fmtDate } from '../lib/format';
import { Card, Badge, Loading, ErrorState, EmptyState, Table, Th, Td, toast } from '../components/ui';

type Account = { id: string; code: string; name: string; type: string; balance: number; isSystem: boolean };
type JournalLine = { id: string; debit: string; credit: string; description?: string; accounts: { code: string; name: string } };
type Journal = { id: string; number: string; date: string; memo: string; type: string; status: string; journal_lines: JournalLine[] };

const TYPE_TONE: Record<string, string> = { ASSET: 'CONFIRMED', LIABILITY: 'MEDIUM', EQUITY: 'LOW', INCOME: 'PAID', EXPENSE: 'OVERDUE' };

function ChartOfAccounts() {
  const { data, loading, error, refetch } = useFetch<Account[]>('/accounting');
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data?.length) return <EmptyState title="No accounts" />;
  return (
    <Table>
      <thead><tr><Th>Code</Th><Th>Account</Th><Th>Type</Th><Th className="text-right">Balance</Th></tr></thead>
      <tbody className="divide-y divide-slate-100">
        {data.map(a => (
          <tr key={a.id} className="hover:bg-slate-50">
            <Td className="text-slate-500 font-mono text-xs">{a.code}</Td>
            <Td className="font-medium text-slate-800">{a.name}</Td>
            <Td><Badge tone={TYPE_TONE[a.type] || 'LOW'}>{a.type}</Badge></Td>
            <Td className="text-right font-medium">{inr(a.balance)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function Journals() {
  const { data, loading, error, refetch } = useFetch<Journal[]>('/accounting/journals');
  const [busy, setBusy] = useState('');

  const reverse = async (j: Journal) => {
    if (j.type === 'REVERSAL') return;
    if (!confirm(`Reverse journal ${j.number}? This posts a balancing counter-entry.`)) return;
    setBusy(j.id);
    try {
      await api.post(`/accounting/journals/${j.id}/reverse`);
      toast('Journal reversed');
      refetch();
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy('');
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data?.length) return <EmptyState title="No journal entries" />;

  return (
    <div className="divide-y divide-slate-100">
      {data.map(j => {
        const totalDebit = j.journal_lines.reduce((s, l) => s + Number(l.debit), 0);
        return (
          <div key={j.id} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-slate-800">{j.number}</span>
                  <Badge tone={j.status === 'POSTED' ? 'POSTED' : 'DRAFT'}>{j.status}</Badge>
                  {j.type === 'REVERSAL' && <Badge tone="CANCELLED">REVERSAL</Badge>}
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{fmtDate(j.date)} · {j.memo}</p>
              </div>
              {j.type !== 'REVERSAL' && j.status === 'POSTED' && (
                <button onClick={() => reverse(j)} disabled={busy === j.id}
                  className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1 disabled:opacity-50">
                  <RotateCcw size={13} /> Reverse
                </button>
              )}
            </div>
            <div className="bg-slate-50 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {j.journal_lines.map(l => (
                    <tr key={l.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-1.5 text-slate-600">{l.accounts.code} · {l.accounts.name}</td>
                      <td className="px-3 py-1.5 text-right text-slate-700 w-32">{Number(l.debit) > 0 ? inr(l.debit) : ''}</td>
                      <td className="px-3 py-1.5 text-right text-slate-700 w-32">{Number(l.credit) > 0 ? inr(l.credit) : ''}</td>
                    </tr>
                  ))}
                  <tr className="font-medium text-slate-800">
                    <td className="px-3 py-1.5 text-right">Totals</td>
                    <td className="px-3 py-1.5 text-right w-32">{inr(totalDebit)}</td>
                    <td className="px-3 py-1.5 text-right w-32">{inr(totalDebit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Accounting() {
  const [tab, setTab] = useState<'accounts' | 'journals'>('accounts');
  return (
    <div className="space-y-5">
      <div className="flex gap-1.5">
        <button onClick={() => setTab('accounts')}
          className={`px-3 py-1.5 text-sm rounded-lg font-medium ${tab === 'accounts' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>Chart of Accounts</button>
        <button onClick={() => setTab('journals')}
          className={`px-3 py-1.5 text-sm rounded-lg font-medium ${tab === 'journals' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>Journal Entries</button>
      </div>
      <Card>{tab === 'accounts' ? <ChartOfAccounts /> : <Journals />}</Card>
    </div>
  );
}
