import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Download, ChevronLeft, ChevronRight, X } from 'lucide-react';
import api, { apiError } from '../lib/api';
import { inr, fmtDate } from '../lib/format';
import { exportData, type ExportFormat } from '../lib/export';
import { Card, Button, Badge, Loading, ErrorState, EmptyState, Table, Th, Td, toast } from '../components/ui';

type Invoice = {
  id: string; invoiceNumber: string; date: string; dueDate: string;
  status: string; totalAmount: string; paidAmount: string;
  customer: { name: string };
};
type PagedResponse = { data: Invoice[]; total: number; page: number; pageCount: number };

const STATUSES = ['ALL', 'OPEN', 'PARTIAL', 'PAID', 'OVERDUE'];
const PAGE_SIZE = 15;

/* ── Shared Pagination component ── */
function Pagination({ page, pageCount, total, limit, onPage }: {
  page: number; pageCount: number; total: number; limit: number; onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);
  const pages: (number | '…')[] = [];
  const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };
  add(1);
  if (page > 3) pages.push('…');
  if (page > 2) add(page - 1);
  add(page);
  if (page < pageCount - 1) add(page + 1);
  if (page < pageCount - 2) pages.push('…');
  add(pageCount);

  return (
    <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-500 text-xs">
        Showing <span className="font-medium text-slate-700">{from}–{to}</span> of{' '}
        <span className="font-medium text-slate-700">{total}</span> invoices
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 1}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronLeft size={15} />
        </button>
        {pages.map((p, i) =>
          p === '…'
            ? <span key={`e-${i}`} className="px-1 text-slate-400">…</span>
            : <button key={p} onClick={() => onPage(Number(p))}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                  p === page ? 'bg-brand-600 text-white' : 'hover:bg-slate-100 text-slate-600'
                }`}>{p}</button>
        )}
        <button onClick={() => onPage(page + 1)} disabled={page === pageCount}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

export default function SalesList() {
  const [result, setResult]         = useState<PagedResponse | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filter, setFilter]         = useState('ALL');
  const now = Date.now();

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search)           params.set('search', search);
      if (filter !== 'ALL') params.set('status', filter === 'OVERDUE' ? 'OPEN' : filter);
      const res = await api.get<PagedResponse>(`/invoices?${params}`);
      setResult(res.data);
    } catch (err) { setError(apiError(err)); }
    finally { setLoading(false); }
  }, [page, search, filter]);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async (fmt: ExportFormat) => {
    try {
      const params = new URLSearchParams({ page: '1', limit: '1000' });
      if (search)           params.set('search', search);
      if (filter !== 'ALL') params.set('status', filter === 'OVERDUE' ? 'OPEN' : filter);
      const res = await api.get<PagedResponse>(`/invoices?${params}`);
      const rows = res.data.data.map(inv => ({
        'Invoice #':     inv.invoiceNumber,
        'Customer':      inv.customer?.name || '',
        'Date':          fmtDate(inv.date),
        'Due Date':      fmtDate(inv.dueDate),
        'Status':        inv.status,
        'Total (INR)':   Number(inv.totalAmount),
        'Paid (INR)':    Number(inv.paidAmount),
        'Balance (INR)': Number(inv.totalAmount) - Number(inv.paidAmount),
      }));
      exportData(rows, `invoices-${new Date().toISOString().slice(0, 10)}`, fmt);
    } catch (err) { toast(apiError(err), 'error'); }
  };

  // Client-side secondary sort: same date → highest balance first
  const invoices = [...(result?.data || [])].sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    const balA = Number(a.totalAmount) - Number(a.paidAmount);
    const balB = Number(b.totalAmount) - Number(b.paidAmount);
    return balB - balA;
  });

  // Further client-side filter for OVERDUE (backend sent OPEN; we mark overdue on client)
  const rows = filter === 'OVERDUE'
    ? invoices.filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED' && new Date(i.dueDate).getTime() < now)
    : invoices;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Search invoice or customer…"
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 bg-white" />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative group">
            <Button variant="secondary" size="sm" disabled={rows.length === 0}>
              <Download size={14} /> Export
            </Button>
            <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg z-10 hidden group-hover:block">
              <button onClick={() => handleExport('xlsx')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-t-lg">Download XLSX</button>
              <button onClick={() => handleExport('csv')}  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-b-lg">Download CSV</button>
            </div>
          </div>
          <Link to="/sales/new"><Button><Plus size={16} /> Create Invoice</Button></Link>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUSES.map(s => (
          <button key={s} onClick={() => { setFilter(s); setPage(1); }}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              filter === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}>
            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
        {result && <span className="ml-auto self-center text-xs text-slate-400">{result.total} total</span>}
      </div>

      <Card>
        {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={load} /> :
          rows.length === 0 ? (
            <EmptyState title="No invoices" hint={search || filter !== 'ALL' ? 'Try clearing your search or filter.' : 'Create your first invoice to get started.'} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Invoice #</Th><Th>Customer</Th><Th>Date</Th><Th>Due</Th>
                  <Th className="text-right">Total</Th><Th className="text-right">Balance</Th>
                  <Th>Status</Th><Th></Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(inv => {
                  const balance = Number(inv.totalAmount) - Number(inv.paidAmount);
                  const overdue = inv.status !== 'PAID' && inv.status !== 'CANCELLED' && new Date(inv.dueDate).getTime() < now;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <Td className="font-medium text-slate-800">{inv.invoiceNumber}</Td>
                      <Td>{inv.customer?.name}</Td>
                      <Td className="text-slate-500">{fmtDate(inv.date)}</Td>
                      <Td className={overdue ? 'text-rose-600 font-medium' : 'text-slate-500'}>{fmtDate(inv.dueDate)}</Td>
                      <Td className="text-right font-medium">{inr(inv.totalAmount)}</Td>
                      <Td className="text-right">{balance > 0 ? inr(balance) : '—'}</Td>
                      <Td><Badge tone={overdue ? 'OVERDUE' : inv.status}>{overdue ? 'Overdue' : inv.status}</Badge></Td>
                      <Td className="text-right"><Link to={`/sales/${inv.id}`} className="text-brand-600 hover:underline text-sm font-medium">View</Link></Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        {result && (
          <Pagination page={result.page} pageCount={result.pageCount} total={result.total} limit={PAGE_SIZE} onPage={setPage} />
        )}
      </Card>
    </div>
  );
}
