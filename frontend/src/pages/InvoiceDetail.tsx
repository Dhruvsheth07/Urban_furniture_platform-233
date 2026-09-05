import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, IndianRupee } from 'lucide-react';
import api, { apiError } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { inr, fmtDate } from '../lib/format';
import { Card, CardHeader, Button, Badge, Loading, ErrorState, Table, Th, Td, toast } from '../components/ui';

type Line = { id: string; quantity: string; unitPrice: string; taxRate: string; total: string; product: { name: string; sku: string } };
type Payment = { id: string; amount: string; method: string; date: string; reference?: string };
type Invoice = {
  id: string; invoiceNumber: string; date: string; dueDate: string; status: string;
  totalAmount: string; paidAmount: string; notes?: string;
  customer: { name: string; gstin?: string; email?: string; billingCity?: string; billingState?: string };
  lines: Line[]; payments: Payment[];
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const { data, loading, error, refetch } = useFetch<Invoice>(`/invoices/${id}`, [id]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [saving, setSaving] = useState(false);

  if (loading) return <Loading label="Loading invoice…" />;
  if (error || !data) return <ErrorState message={error || 'Not found'} onRetry={refetch} />;

  const balance = Number(data.totalAmount) - Number(data.paidAmount);
  const subtotal = data.lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0);
  const tax = data.lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice) * (Number(l.taxRate) / 100), 0);

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast('Enter a valid amount', 'error');
    if (amt > balance + 0.01) return toast('Amount exceeds outstanding balance', 'error');
    setSaving(true);
    try {
      await api.post('/payments', { invoiceId: data.id, amount: amt, method });
      toast('Payment recorded');
      setAmount('');
      refetch();
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <Link to="/sales" className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1.5"><ArrowLeft size={16} /> Back to invoices</Link>
        <Button variant="secondary" size="sm" onClick={() => window.open(`/api/invoices/${data.id}/pdf`)}><Download size={15} /> PDF</Button>
      </div>

       <Card> 
        <div className="p-6 flex items-start justify-between border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">{data.invoiceNumber}</h2>
              <Badge tone={data.status}>{data.status}</Badge>
            </div>
            <p className="text-sm text-slate-500 mt-1">Issued {fmtDate(data.date)} · Due {fmtDate(data.dueDate)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Balance due</p>
            <p className="text-2xl font-bold text-slate-900">{inr(balance)}</p>
          </div>
        </div>

        <div className="p-6 border-b border-slate-100">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Bill to</p>
          <p className="font-semibold text-slate-800">{data.customer.name}</p>
          {data.customer.gstin && <p className="text-sm text-slate-500">GSTIN: {data.customer.gstin}</p>}
          {(data.customer.billingCity || data.customer.billingState) && (
            <p className="text-sm text-slate-500">{[data.customer.billingCity, data.customer.billingState].filter(Boolean).join(', ')}</p>
          )}
        </div>

        <Table>
          <thead>
            <tr><Th>Product</Th><Th className="text-right">Qty</Th><Th className="text-right">Price</Th><Th className="text-right">GST</Th><Th className="text-right">Total</Th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.lines.map(l => (
              <tr key={l.id}>
                <Td><div className="font-medium text-slate-800">{l.product?.name}</div><div className="text-xs text-slate-400">{l.product?.sku}</div></Td>
                <Td className="text-right">{Number(l.quantity)}</Td>
                <Td className="text-right">{inr(l.unitPrice)}</Td>
                <Td className="text-right text-slate-500">{Number(l.taxRate)}%</Td>
                <Td className="text-right font-medium">{inr(l.total)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>

        <div className="p-6 flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="text-slate-800">{inr(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">GST</span><span className="text-slate-800">{inr(tax)}</span></div>
            <div className="flex justify-between font-semibold text-base pt-2 border-t border-slate-100"><span>Total</span><span>{inr(data.totalAmount)}</span></div>
            <div className="flex justify-between text-emerald-600"><span>Paid</span><span>{inr(data.paidAmount)}</span></div>
            <div className="flex justify-between font-semibold"><span>Balance</span><span>{inr(balance)}</span></div>
          </div>
        </div>
      </Card> 

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader title="Payments" subtitle={`${data.payments?.length || 0} recorded`} />
          {data.payments?.length ? (
            <Table>
              <thead><tr><Th>Date</Th><Th>Method</Th><Th className="text-right">Amount</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.payments.map(p => (
                  <tr key={p.id}><Td className="text-slate-500">{fmtDate(p.date)}</Td><Td>{p.method}</Td><Td className="text-right font-medium">{inr(p.amount)}</Td></tr>
                ))}
              </tbody>
            </Table>
          ) : <p className="px-5 py-8 text-center text-sm text-slate-400">No payments yet</p>}
        </Card>

        {balance > 0 && data.status !== 'CANCELLED' && (
          <Card>
            <CardHeader title="Record payment" subtitle="Posts to Cash/Bank and reduces receivables" />
            <form onSubmit={recordPayment} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount</label>
                <div className="relative">
                  <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder={String(balance)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Method</label>
                <select value={method} onChange={e => setMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 bg-white">
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CARD">Card</option>
                </select>
              </div>
              <Button type="submit" disabled={saving} className="w-full justify-center">{saving ? 'Recording…' : 'Record payment'}</Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
