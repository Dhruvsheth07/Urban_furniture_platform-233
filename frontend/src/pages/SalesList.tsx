import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Download } from 'lucide-react';
import { useFetch } from '../lib/useFetch';
import { inr, fmtDate } from '../lib/format';
import { exportData, type ExportFormat } from '../lib/export';
import { Card, Button, Badge, Loading, ErrorState, EmptyState, Table, Th, Td } from '../components/ui';

type Invoice = {
  id: string; invoiceNumber: string; date: string; dueDate: string;
  status: string; totalAmount: string; paidAmount: string;
  customer: { name: string };
};

const STATUSES = ['ALL', 'OPEN', 'PARTIAL', 'PAID', 'OVERDUE'];

export default function SalesList() {
  const { data, loading, error, refetch } = useFetch<Invoice[]>('/invoices');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('ALL');

  const now = Date.now();
  const rows = useMemo(() => {
    let list = data || [];
    if (q) {
      const t = q.toLowerCase();
      list = list.filter(i => i.invoiceNumber.toLowerCase().includes(t) || i.customer?.name.toLowerCase().includes(t));
    }
    if (filter !== 'ALL') {
      list = list.filter(i => {
        const overdue = i.status !== 'PAID' && i.status !== 'CANCELLED' && new Date(i.dueDate).getTime() < now;
        if (filter === 'OVERDUE') return overdue;
        return i.status === filter;
      });
    }
    return list;
  }, [data, q, filter, now]);

  const handleExport = (fmt: ExportFormat) => {
    const exportRows = rows.map(inv => ({
      'Invoice #': inv.invoiceNumber,
      'Customer': inv.customer?.name || '',
      'Date': fmtDate(inv.date),
      'Due Date': fmtDate(inv.dueDate),
      'Status': inv.status,
      'Total (INR)': Number(inv.totalAmount),
      'Paid (INR)': Number(inv.paidAmount),
      'Balance (INR)': Number(inv.totalAmount) - Number(inv.paidAmount),
    }));
    exportData(exportRows, `invoices-${new Date().toISOString().slice(0, 10)}`, fmt);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search invoice or customer…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 bg-white" />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative group">
            <Button variant="secondary" size="sm" disabled={rows.length === 0}>
              <Download size={14} /> Export
            </Button>
            <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg z-10 hidden group-hover:block">
              <button onClick={() => handleExport('xlsx')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-t-lg">Download XLSX</button>
              <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-b-lg">Download CSV</button>
            </div>
          </div>
          <Link to="/sales/new"><Button><Plus size={16} /> Create Invoice</Button></Link>
        </div>
      </div>

      <div className="flex gap-1.5">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${filter === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <Card>
        {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={refetch} /> :
          rows.length === 0 ? <EmptyState title="No invoices" hint="Create your first invoice to get started." /> : (
            <Table>
              <thead>
                <tr>
                  <Th>Invoice #</Th><Th>Customer</Th><Th>Date</Th><Th>Due</Th>
                  <Th className="text-right">Total</Th><Th className="text-right">Balance</Th><Th>Status</Th><Th></Th>
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
      </Card>
    </div>
  );
}
