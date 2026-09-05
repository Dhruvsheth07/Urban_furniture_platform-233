import { useState } from 'react';
import { Building2, LogOut, Download, FileText } from 'lucide-react';
import api, { apiError } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { inr, fmtDate } from '../lib/format';
import { Card, Button, Badge, Loading, ErrorState, EmptyState, Table, Th, Td, toast } from '../components/ui';

type Invoice = {
  id: string; invoiceNumber: string; date: string; dueDate: string; status: string;
  totalAmount: string; paidAmount: string;
};

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}

function PayModal({ inv, onClose, onDone }: { inv: Invoice; onClose: () => void; onDone: () => void }) {
  const balance = Number(inv.totalAmount) - Number(inv.paidAmount);
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState('UPI');
  const [saving, setSaving] = useState(false);

  const pay = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0 || amt > balance + 0.01) return toast('Enter a valid amount within the balance', 'error');
    setSaving(true);
    try {
      await api.post('/payments', { invoiceId: inv.id, amount: amt, method });
      toast('Payment submitted. Thank you.');
      onDone();
    } catch (err) {
      toast(apiError(err), 'error');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-sm" >
        <div onClick={e => e.stopPropagation()} className="p-6">
          <h3 className="text-lg font-semibold text-slate-800">Pay {inv.invoiceNumber}</h3>
          <p className="text-sm text-slate-500 mb-4">{inr(balance)} outstanding</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount</label>
              <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Method</label>
              <select value={method} onChange={e => setMethod(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 bg-white">
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button onClick={pay} disabled={saving}>{saving ? 'Submitting…' : 'Pay now'}</Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function CustomerPortal() {
  const user = getUser();
  const { data, loading, error, refetch } = useFetch<Invoice[]>('/invoices');
  const [payInv, setPayInv] = useState<Invoice | null>(null);

  const invoices = data || [];
  const totalOutstanding = invoices
    .filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED')
    .reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0);

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-slate-900 text-white h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center"><Building2 size={20} /></div>
          <div>
            <div className="font-semibold leading-tight">Urban Furniture</div>
            <div className="text-[11px] text-slate-400">Customer Portal</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-300">{user?.name || 'Customer'}</span>
          <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
            className="text-sm text-slate-300 hover:text-white flex items-center gap-1.5"><LogOut size={16} /> Logout</button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6 space-y-5">
        <Card className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
          <p className="text-slate-300 text-sm">Total outstanding balance</p>
          <p className="text-4xl font-bold mt-1">{inr(totalOutstanding)}</p>
        </Card>

        <Card>
          <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <FileText size={18} className="text-brand-600" />
            <h2 className="font-semibold text-slate-800">My Invoices</h2>
          </div>
          {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={refetch} /> :
            !invoices.length ? <EmptyState title="No invoices" hint="You have no invoices on file." /> : (
              <Table>
                <thead>
                  <tr><Th>Invoice #</Th><Th>Date</Th><Th>Due</Th><Th className="text-right">Total</Th><Th className="text-right">Balance</Th><Th>Status</Th><Th></Th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map(inv => {
                    const balance = Number(inv.totalAmount) - Number(inv.paidAmount);
                    const overdue = inv.status !== 'PAID' && inv.status !== 'CANCELLED' && new Date(inv.dueDate).getTime() < Date.now();
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <Td className="font-medium text-slate-800">{inv.invoiceNumber}</Td>
                        <Td className="text-slate-500">{fmtDate(inv.date)}</Td>
                        <Td className={overdue ? 'text-rose-600 font-medium' : 'text-slate-500'}>{fmtDate(inv.dueDate)}</Td>
                        <Td className="text-right font-medium">{inr(inv.totalAmount)}</Td>
                        <Td className="text-right">{balance > 0 ? inr(balance) : '—'}</Td>
                        <Td><Badge tone={overdue ? 'OVERDUE' : inv.status}>{overdue ? 'Overdue' : inv.status}</Badge></Td>
                        <Td className="text-right">
                          <div className="flex items-center justify-end gap-3">
                            {balance > 0 && <button onClick={() => setPayInv(inv)} className="text-brand-600 hover:underline text-sm font-medium">Pay now</button>}
                            <button onClick={() => window.open(`/api/invoices/${inv.id}/pdf`)} className="text-slate-400 hover:text-slate-700" title="Download PDF"><Download size={16} /></button>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
        </Card>
      </div>

      {payInv && <PayModal inv={payInv} onClose={() => setPayInv(null)} onDone={() => { setPayInv(null); refetch(); }} />}
    </div>
  );
}
