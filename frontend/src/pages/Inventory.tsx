import { useState, useEffect, useCallback } from 'react';
import { Search, AlertTriangle, Download, ChevronLeft, ChevronRight, X } from 'lucide-react';
import api, { apiError } from '../lib/api';
import { inr, fmtNum } from '../lib/format';
import { exportData, type ExportFormat } from '../lib/export';
import { Card, Badge, Loading, ErrorState, EmptyState, Table, Th, Td, toast } from '../components/ui';

type Product = {
  id: string; sku: string; name: string; material?: string; color?: string;
  salePrice: string; purchasePrice: string; avgCost: string;
  onHandQty: string; reorderLevel: string; trackInventory: boolean;
};
type Stats = { totalProducts: number; totalValue: number; lowCount: number };
type PagedResponse = { data: Product[]; total: number; page: number; pageCount: number; stats: Stats };

const PAGE_SIZE = 20;

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
    <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between gap-4">
      <span className="text-slate-500 text-xs">
        Showing <span className="font-medium text-slate-700">{from}–{to}</span> of{' '}
        <span className="font-medium text-slate-700">{total}</span> products
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

export default function Inventory() {
  const [result, setResult]           = useState<PagedResponse | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [lowOnly, setLowOnly]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search)  params.set('search', search);
      if (lowOnly) params.set('lowStock', 'true');
      const res = await api.get<PagedResponse>(`/products?${params}`);
      setResult(res.data);
    } catch (err) { setError(apiError(err)); }
    finally { setLoading(false); }
  }, [page, search, lowOnly]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async (fmt: ExportFormat) => {
    try {
      const params = new URLSearchParams({ page: '1', limit: '1000' });
      if (search)  params.set('search', search);
      if (lowOnly) params.set('lowStock', 'true');
      const res = await api.get<PagedResponse>(`/products?${params}`);
      const rows = res.data.data.map(p => ({
        'Product':          p.name,
        'SKU':              p.sku,
        'Material':         p.material || '',
        'Color':            p.color || '',
        'On Hand Qty':      Number(p.onHandQty),
        'Reorder Level':    Number(p.reorderLevel),
        'Avg Cost (INR)':   Number(p.avgCost || p.purchasePrice),
        'Sale Price (INR)': Number(p.salePrice),
        'Stock Value (INR)':Number(p.onHandQty) * Number(p.avgCost || p.purchasePrice),
        'Low Stock':        Number(p.reorderLevel) > 0 && Number(p.onHandQty) <= Number(p.reorderLevel) ? 'Yes' : 'No',
      }));
      exportData(rows, `inventory-${new Date().toISOString().slice(0, 10)}`, fmt);
    } catch (err) { toast(apiError(err), 'error'); }
  };

  const stats = result?.stats;
  const products = result?.data || [];

  return (
    <div className="space-y-5">
      {/* Summary cards — always show global stats from backend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="p-5">
          <p className="text-sm text-slate-500">Total Products</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats?.totalProducts ?? '—'}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Inventory Value</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats ? inr(stats.totalValue) : '—'}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Below Reorder Level</p>
          <p className={`text-2xl font-bold mt-1 ${stats?.lowCount ? 'text-rose-600' : 'text-slate-800'}`}>
            {stats?.lowCount ?? '—'}
          </p>
        </Card>
      </div>

      <Card>
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
          <div className="relative flex-1 max-w-sm min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Search product or SKU…"
              className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500" />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setLowOnly(v => !v); setPage(1); }}
              className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                lowOnly ? 'bg-rose-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}>
              Low stock only
            </button>
            <div className="relative group">
              <button disabled={products.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40">
                <Download size={14} /> Export
              </button>
              <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg z-10 hidden group-hover:block">
                <button onClick={() => handleExport('xlsx')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-t-lg">Download XLSX</button>
                <button onClick={() => handleExport('csv')}  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-b-lg">Download CSV</button>
              </div>
            </div>
          </div>
        </div>

        {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={load} /> :
          products.length === 0 ? (
            <EmptyState title={search || lowOnly ? 'No results' : 'No products'} hint={search || lowOnly ? 'Try clearing your search or filter.' : undefined} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th><Th>SKU</Th>
                  <Th className="text-right">On hand</Th><Th className="text-right">Reorder at</Th>
                  <Th className="text-right">Avg cost</Th><Th className="text-right">Sale price</Th>
                  <Th className="text-right">Stock value</Th><Th></Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map(p => {
                  const onHand = Number(p.onHandQty), reorder = Number(p.reorderLevel);
                  const low = reorder > 0 && onHand <= reorder;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <Td>
                        <div className="font-medium text-slate-800">{p.name}</div>
                        <div className="text-xs text-slate-400">{[p.material, p.color].filter(Boolean).join(' · ')}</div>
                      </Td>
                      <Td className="text-slate-500">{p.sku}</Td>
                      <Td className={`text-right font-medium ${low ? 'text-rose-600' : 'text-slate-800'}`}>{fmtNum(onHand)}</Td>
                      <Td className="text-right text-slate-500">{reorder > 0 ? fmtNum(reorder) : '—'}</Td>
                      <Td className="text-right text-slate-500">{inr(p.avgCost || p.purchasePrice)}</Td>
                      <Td className="text-right">{inr(p.salePrice)}</Td>
                      <Td className="text-right font-medium">{inr(onHand * Number(p.avgCost || p.purchasePrice))}</Td>
                      <Td>{low && <Badge tone="OVERDUE"><span className="flex items-center gap-1"><AlertTriangle size={12} /> Low</span></Badge>}</Td>
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
