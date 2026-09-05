import { useState, useMemo } from 'react';
import { Search, AlertTriangle, Download } from 'lucide-react';
import { useFetch } from '../lib/useFetch';
import { inr, fmtNum } from '../lib/format';
import { exportData, type ExportFormat } from '../lib/export';
import { Card, CardHeader, Badge, Loading, ErrorState, EmptyState, Table, Th, Td } from '../components/ui';

type Product = {
  id: string; sku: string; name: string; material?: string; color?: string;
  salePrice: string; purchasePrice: string; avgCost: string;
  onHandQty: string; reorderLevel: string; trackInventory: boolean;
};

export default function Inventory() {
  const { data, loading, error, refetch } = useFetch<Product[]>('/products');
  const [q, setQ] = useState('');
  const [lowOnly, setLowOnly] = useState(false);

  const rows = useMemo(() => {
    let list = data || [];
    if (q) { const t = q.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)); }
    if (lowOnly) list = list.filter(p => Number(p.reorderLevel) > 0 && Number(p.onHandQty) <= Number(p.reorderLevel));
    return list;
  }, [data, q, lowOnly]);

  const totalValue = (data || []).reduce((s, p) => s + Number(p.onHandQty) * Number(p.avgCost || p.purchasePrice), 0);
  const lowCount = (data || []).filter(p => Number(p.reorderLevel) > 0 && Number(p.onHandQty) <= Number(p.reorderLevel)).length;

  const handleExport = (fmt: ExportFormat) => {
    const exportRows = rows.map(p => ({
      'Product': p.name,
      'SKU': p.sku,
      'Material': p.material || '',
      'Color': p.color || '',
      'On Hand Qty': Number(p.onHandQty),
      'Reorder Level': Number(p.reorderLevel),
      'Avg Cost (INR)': Number(p.avgCost || p.purchasePrice),
      'Sale Price (INR)': Number(p.salePrice),
      'Stock Value (INR)': Number(p.onHandQty) * Number(p.avgCost || p.purchasePrice),
      'Low Stock': Number(p.reorderLevel) > 0 && Number(p.onHandQty) <= Number(p.reorderLevel) ? 'Yes' : 'No',
    }));
    exportData(exportRows, `inventory-${new Date().toISOString().slice(0, 10)}`, fmt);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="p-5"><p className="text-sm text-slate-500">Products</p><p className="text-2xl font-bold text-slate-800 mt-1">{data?.length || 0}</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-500">Inventory value</p><p className="text-2xl font-bold text-slate-800 mt-1">{inr(totalValue)}</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-500">Below reorder level</p><p className={`text-2xl font-bold mt-1 ${lowCount ? 'text-rose-600' : 'text-slate-800'}`}>{lowCount}</p></Card>
      </div>

      <Card>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
          <div className="relative flex-1 max-w-sm min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search product or SKU…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLowOnly(v => !v)}
              className={`px-3 py-2 text-sm rounded-lg font-medium ${lowOnly ? 'bg-rose-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              Low stock only
            </button>
            <div className="relative group">
              <button disabled={rows.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40">
                <Download size={14} /> Export
              </button>
              <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg z-10 hidden group-hover:block">
                <button onClick={() => handleExport('xlsx')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-t-lg">Download XLSX</button>
                <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-b-lg">Download CSV</button>
              </div>
            </div>
          </div>
        </div>

        {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={refetch} /> :
          rows.length === 0 ? <EmptyState title="No products" /> : (
            <Table>
              <thead>
                <tr><Th>Product</Th><Th>SKU</Th><Th className="text-right">On hand</Th><Th className="text-right">Reorder at</Th><Th className="text-right">Avg cost</Th><Th className="text-right">Sale price</Th><Th className="text-right">Stock value</Th><Th></Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(p => {
                  const onHand = Number(p.onHandQty), reorder = Number(p.reorderLevel);
                  const low = reorder > 0 && onHand <= reorder;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <Td><div className="font-medium text-slate-800">{p.name}</div><div className="text-xs text-slate-400">{[p.material, p.color].filter(Boolean).join(' · ')}</div></Td>
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
      </Card>
    </div>
  );
}
