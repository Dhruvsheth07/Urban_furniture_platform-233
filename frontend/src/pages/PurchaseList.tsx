import { useState } from 'react';
import { Download } from 'lucide-react';
import api, { apiError } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { inr, fmtDate } from '../lib/format';
import { exportData, type ExportFormat } from '../lib/export';
import { Card, CardHeader, Button, Badge, Loading, ErrorState, EmptyState, Table, Th, Td, toast } from '../components/ui';

type Bill = {
  id: string; billNumber: string; date: string; dueDate: string; status: string;
  totalAmount: string; paidAmount: string; vendor: { name: string };
};

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
      <Card className="w-full max-w-sm" >
        <div onClick={e => e.stopPropagation()}>
          <CardHeader title={`Pay ${bill.billNumber}`} subtitle={`${bill.vendor.name} · ${inr(balance)} outstanding`} />
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

export default function PurchaseList() {
  const { data, loading, error, refetch } = useFetch<Bill[]>('/vendor-bills');
  const [payBill, setPayBill] = useState<Bill | null>(null);
  const now = Date.now();

  const handleExport = (fmt: ExportFormat) => {
    const bills = data || [];
    const exportRows = bills.map(b => ({
      'Bill #': b.billNumber,
      'Vendor': b.vendor?.name || '',
      'Date': fmtDate(b.date),
      'Due Date': fmtDate(b.dueDate),
      'Status': b.status,
      'Total (INR)': Number(b.totalAmount),
      'Paid (INR)': Number(b.paidAmount),
      'Balance (INR)': Number(b.totalAmount) - Number(b.paidAmount),
    }));
    exportData(exportRows, `vendor-bills-${new Date().toISOString().slice(0, 10)}`, fmt);
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Vendor Bills</h3>
            <p className="text-sm text-slate-500 mt-0.5">Purchases and payables</p>
          </div>
          <div className="relative group">
            <button disabled={!data?.length}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40">
              <Download size={14} /> Export
            </button>
            <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg z-10 hidden group-hover:block">
              <button onClick={() => handleExport('xlsx')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-t-lg">Download XLSX</button>
              <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-b-lg">Download CSV</button>
            </div>
          </div>
        </div>
        {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={refetch} /> :
          !data?.length ? <EmptyState title="No bills" hint="Vendor bills will appear here." /> : (
            <Table>
              <thead>
                <tr><Th>Bill #</Th><Th>Vendor</Th><Th>Date</Th><Th>Due</Th><Th className="text-right">Total</Th><Th className="text-right">Balance</Th><Th>Status</Th><Th></Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map(b => {
                  const balance = Number(b.totalAmount) - Number(b.paidAmount);
                  const overdue = b.status !== 'PAID' && new Date(b.dueDate).getTime() < now;
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
                        {balance > 0 && <button onClick={() => setPayBill(b)} className="text-brand-600 hover:underline text-sm font-medium">Record payment</button>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
      </Card>
      {payBill && <PayModal bill={payBill} onClose={() => setPayBill(null)} onDone={() => { setPayBill(null); refetch(); }} />}
    </div>
  );
}
