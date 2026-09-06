import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Download, Plus, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import api, { apiError } from '../lib/api';
import { inr, fmtDate } from '../lib/format';
import { exportData, type ExportFormat } from '../lib/export';
import { Card, Button, Badge, Loading, ErrorState, EmptyState, Table, Th, Td, toast } from '../components/ui';

type Bill = {
  id: string; billNumber: string; date: string; dueDate: string; status: string;
  totalAmount: string; paidAmount: string; vendor: { name: string };
};
type PagedResponse = { data: Bill[]; total: number; page: number; pageCount: number };

const STATUSES = ['ALL', 'OPEN', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'];
const PAGE_SIZE = 15;

/* ── Payment Modal ── */
function PayModal({ bill, onClose, onDone }: { bill: Bill; onClose: () => void; onDone: () => void }) {
  const balance = Number(bill.totalAmount) - Number(bill.paidAmount);
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [saving, setSaving] = useState(false);

  const pay = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0 || amt > balance + 0.01) return toast('Enter a valid amount within balance', 'error');
    setSaving(true);
    try {
      await api.post('/payments', { billId: bill.id, amount: amt, method });
      toast('Payment recorded');
      onDone();
    } catch (err) {
      toast(apiError(err), 'error');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-sm">
        <div onClick={e => e.stopPropagation()}>
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Pay {bill.billNumber}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{bill.vendor.name} · {inr(balance)} outstanding</p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount</label>
              <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Method</label>
              <select value={method} onChange={e => setMethod(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 bg-white">
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button onClick={pay} disabled={saving}>{saving ? 'Recording…' : 'Record'}</Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ── Pagination Controls ── */
function Pagination({ page, pageCount, total, limit, onPage }: {
  page: number; pageCount: number; total: number; limit: number; onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  // Build page numbers: always show first, last, current ±1, with ellipsis
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
        <span className="font-medium text-slate-700">{total}</span> bills
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 1}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronLeft size={15} />
        </button>
        {pages.map((p, i) =>
          p === '…'
            ? <span key={`ellipsis-${i}`} className="px-1 text-slate-400">…</span>
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

/* ── Main Page ── */
export default function PurchaseList() {
  const [result, setResult]     = useState<PagedResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState('ALL');
  const [payBill, setPayBill]   = useState<Bill | null>(null);
  const [searchInput, setSearchInput] = useState(''); // debounced separately

  const now = Date.now();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search)            params.set('search', search);
      if (status !== 'ALL') params.set('status', status);
      const res = await api.get<PagedResponse>(`/vendor-bills?${params}`);
      setResult(res.data);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  // Debounce search input → search state
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reload whenever filters/page change
  useEffect(() => { load(); }, [load]);

  const handleExport = async (fmt: ExportFormat) => {
    try {
      const params = new URLSearchParams({ page: '1', limit: '1000' });
      if (search)            params.set('search', search);
      if (status !== 'ALL') params.set('status', status);
      const res = await api.get<PagedResponse>(`/vendor-bills?${params}`);
      const rows = res.data.data.map(b => ({
        'Bill #':        b.billNumber,
        'Vendor':        b.vendor?.name || '',
        'Date':          fmtDate(b.date),
        'Due Date':      fmtDate(b.dueDate),
        'Status':        b.status,
        'Total (INR)':   Number(b.totalAmount),
        'Paid (INR)':    Number(b.paidAmount),
        'Balance (INR)': Number(b.totalAmount) - Number(b.paidAmount),
      }));
      exportData(rows, `vendor-bills-${new Date().toISOString().slice(0, 10)}`, fmt);
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };

  const bills = result?.data || [];

  return (
    <div className="space-y-5">
      <Card>
        {/* ── Header ── */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Vendor Bills</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Purchases and payables
              {result && <span className="ml-1.5 text-slate-400">· {result.total} total</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative group">
              <button disabled={!bills.length}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40">
                <Download size={14} /> Export
              </button>
              <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg z-10 hidden group-hover:block">
                <button onClick={() => handleExport('xlsx')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-t-lg">Download XLSX</button>
                <button onClick={() => handleExport('csv')}  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-b-lg">Download CSV</button>
              </div>
            </div>
            <Link to="/purchases/new">
              <Button size="sm"><Plus size={14} /> Create Bill</Button>
            </Link>
          </div>
        </div>

        {/* ── Search + Filter bar ── */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search bill # or vendor…"
              className="w-full pl-8 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Status pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUSES.map(s => (
              <button key={s} onClick={() => { setStatus(s); setPage(1); }}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  status === s
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>{s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}</button>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={load} /> :
          bills.length === 0 ? (
            <EmptyState
              title={search || status !== 'ALL' ? 'No results found' : 'No bills yet'}
              hint={search || status !== 'ALL' ? 'Try clearing your search or filter' : 'Vendor bills will appear here.'}
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Bill #</Th><Th>Vendor</Th><Th>Date</Th><Th>Due</Th>
                  <Th className="text-right">Total</Th><Th className="text-right">Balance</Th>
                  <Th>Status</Th><Th></Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map(b => {
                  const balance = Number(b.totalAmount) - Number(b.paidAmount);
                  const overdue = b.status !== 'PAID' && b.status !== 'CANCELLED' && new Date(b.dueDate).getTime() < now;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <Td className="font-medium text-slate-800">{b.billNumber}</Td>
                      <Td>{b.vendor?.name}</Td>
                      <Td className="text-slate-500">{fmtDate(b.date)}</Td>
                      <Td className={overdue ? 'text-rose-600 font-medium' : 'text-slate-500'}>{fmtDate(b.dueDate)}</Td>
                      <Td className="text-right font-medium">{inr(b.totalAmount)}</Td>
                      <Td className="text-right">{balance > 0 ? inr(balance) : '—'}</Td>
                      <Td><Badge tone={overdue ? 'OVERDUE' : b.status}>{overdue ? 'Overdue' : b.status}</Badge></Td>
                      <Td className="text-right">
                        {balance > 0 && (
                          <button onClick={() => setPayBill(b)} className="text-brand-600 hover:underline text-sm font-medium">
                            Record payment
                          </button>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )
        }

        {/* ── Pagination ── */}
        {result && (
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            limit={PAGE_SIZE}
            onPage={setPage}
          />
        )}
      </Card>

      {payBill && (
        <PayModal bill={payBill} onClose={() => setPayBill(null)} onDone={() => { setPayBill(null); load(); }} />
      )}
    </div>
  );
}
