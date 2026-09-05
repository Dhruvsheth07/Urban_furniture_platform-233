import { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import api, { apiError } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { inr } from '../lib/format';
import { Card, CardHeader, Loading, ErrorState, EmptyState, Table, Th, Td, Button, Badge, toast } from '../components/ui';

type PL = { revenue: number; cogs: number; grossProfit: number; operatingExpenses: number; netProfit: number; income: any[]; expenses: any[] };
type BS = { assets: number; liabilities: number; equity: number; balanced: boolean; assetAccounts: any[]; liabilityAccounts: any[]; equityAccounts: any[] };
type Aging = { rows: any[]; totalOutstanding: number };

const REPORTS = [
  { key: 'pl', label: 'Profit & Loss' },
  { key: 'balance-sheet', label: 'Balance Sheet' },
  { key: 'ar', label: 'Receivables' },
  { key: 'ap', label: 'Payables' },
];

async function download(report: string, format: string) {
  try {
    const res = await api.get(`/reports/export?report=${report}&format=${format}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = `${report}_${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click(); URL.revokeObjectURL(url);
  } catch (err) {
    toast(apiError(err), 'error');
  }
}

function ExportButtons({ report }: { report: string }) {
  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={() => download(report, 'csv')}><Download size={14} /> CSV</Button>
      <Button variant="secondary" size="sm" onClick={() => download(report, 'xlsx')}><FileSpreadsheet size={14} /> Excel</Button>
    </div>
  );
}

function PLReport() {
  const { data, loading, error, refetch } = useFetch<PL>('/reports/pl');
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error || 'No data'} onRetry={refetch} />;
  return (
    <div>
      <Table>
        <thead><tr><Th>Account</Th><Th className="text-right">Amount</Th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          <tr className="bg-slate-50"><Td className="font-semibold text-slate-700" >Revenue</Td><Td></Td></tr>
          {data.income.map(a => <tr key={a.code}><Td className="pl-8 text-slate-600">{a.name}</Td><Td className="text-right">{inr(a.amount)}</Td></tr>)}
          <tr className="bg-slate-50"><Td className="font-semibold text-slate-700">Expenses</Td><Td></Td></tr>
          {data.expenses.map(a => <tr key={a.code}><Td className="pl-8 text-slate-600">{a.name}</Td><Td className="text-right">{inr(a.amount)}</Td></tr>)}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200"><Td className="font-medium">Gross Profit</Td><Td className="text-right font-medium">{inr(data.grossProfit)}</Td></tr>
          <tr className="font-bold text-base"><Td>Net Profit</Td><Td className={`text-right ${data.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{inr(data.netProfit)}</Td></tr>
        </tfoot>
      </Table>
    </div>
  );
}

function BSReport() {
  const { data, loading, error, refetch } = useFetch<BS>('/reports/balance-sheet');
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error || 'No data'} onRetry={refetch} />;
  const section = (title: string, rows: any[], total: number) => (
    <>
      <tr className="bg-slate-50"><Td className="font-semibold text-slate-700">{title}</Td><Td></Td></tr>
      {rows.map(a => <tr key={a.code}><Td className="pl-8 text-slate-600">{a.name}</Td><Td className="text-right">{inr(a.balance)}</Td></tr>)}
      <tr className="border-t border-slate-100"><Td className="pl-8 font-medium">Total {title}</Td><Td className="text-right font-medium">{inr(total)}</Td></tr>
    </>
  );
  return (
    <div>
      <div className="px-5 pt-4">
        <Badge tone={data.balanced ? 'PAID' : 'OVERDUE'}>{data.balanced ? 'Balanced' : 'Not balanced'}</Badge>
      </div>
      <Table>
        <thead><tr><Th>Account</Th><Th className="text-right">Balance</Th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {section('Assets', data.assetAccounts, data.assets)}
          {section('Liabilities', data.liabilityAccounts, data.liabilities)}
          {section('Equity', data.equityAccounts, data.equity)}
        </tbody>
      </Table>
    </div>
  );
}

function AgingReport({ url, label }: { url: string; label: string }) {
  const { data, loading, error, refetch } = useFetch<Aging>(url);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error || 'No data'} onRetry={refetch} />;
  if (!data.rows.length) return <EmptyState title={`No outstanding ${label.toLowerCase()}`} />;
  return (
    <Table>
      <thead><tr><Th>{label === 'Receivables' ? 'Invoice' : 'Bill'}</Th><Th>{label === 'Receivables' ? 'Customer' : 'Vendor'}</Th><Th className="text-right">Outstanding</Th><Th className="text-right">Days</Th><Th>Bucket</Th></tr></thead>
      <tbody className="divide-y divide-slate-100">
        {data.rows.map((r, i) => (
          <tr key={i} className="hover:bg-slate-50">
            <Td className="font-medium text-slate-800">{r.invoiceNumber || r.billNumber}</Td>
            <Td>{r.customer || r.vendor}</Td>
            <Td className="text-right font-medium">{inr(r.outstanding)}</Td>
            <Td className="text-right">{r.daysOverdue > 0 ? <span className="text-rose-600">{r.daysOverdue}</span> : '—'}</Td>
            <Td><Badge tone={r.bucket === 'Current' ? 'LOW' : r.bucket === '60+' ? 'OVERDUE' : 'MEDIUM'}>{r.bucket}</Badge></Td>
          </tr>
        ))}
      </tbody>
      <tfoot><tr className="font-bold border-t-2 border-slate-200"><Td colSpan={2 as any}>Total outstanding</Td><Td className="text-right">{inr(data.totalOutstanding)}</Td><Td></Td><Td></Td></tr></tfoot>
    </Table>
  );
}

export default function ReportsHub() {
  const [active, setActive] = useState('pl');
  return (
    <div className="space-y-5">
      <div className="flex gap-1.5 flex-wrap">
        {REPORTS.map(r => (
          <button key={r.key} onClick={() => setActive(r.key)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium ${active === r.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {r.label}
          </button>
        ))}
      </div>
      <Card>
        <CardHeader title={REPORTS.find(r => r.key === active)!.label}
          actions={<ExportButtons report={active === 'balance-sheet' ? 'balancesheet' : active} />} />
        {active === 'pl' && <PLReport />}
        {active === 'balance-sheet' && <BSReport />}
        {active === 'ar' && <AgingReport url="/reports/ar" label="Receivables" />}
        {active === 'ap' && <AgingReport url="/reports/ap" label="Payables" />}
      </Card>
    </div>
  );
}
