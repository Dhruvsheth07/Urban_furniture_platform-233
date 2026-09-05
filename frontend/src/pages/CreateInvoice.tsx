import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import api, { apiError } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { inr } from '../lib/format';
import { Card, Button, Loading, ErrorState, toast } from '../components/ui';

type Contact = { id: string; name: string };
type Product = { id: string; name: string; sku: string; salePrice: string; taxRateId?: string };
type LineRow = { productId: string; quantity: number; unitPrice: number; taxRate: number };

export default function CreateInvoice() {
  const navigate = useNavigate();
  const { data: customers, loading: lc, error: ec } = useFetch<Contact[]>('/contacts?type=CUSTOMER');
  const { data: products, loading: lp, error: ep } = useFetch<Product[]>('/products');

  const today = new Date().toISOString().slice(0, 10);
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(today);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineRow[]>([{ productId: '', quantity: 1, unitPrice: 0, taxRate: 18 }]);
  const [saving, setSaving] = useState(false);

  if (lc || lp) return <Loading label="Loading form…" />;
  if (ec || ep) return <ErrorState message={ec || ep || 'Failed to load'} />;

  const setLine = (i: number, patch: Partial<LineRow>) => {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  };
  const onProduct = (i: number, productId: string) => {
    const p = products!.find(x => x.id === productId);
    setLine(i, { productId, unitPrice: p ? Number(p.salePrice) : 0 });
  };
  const addLine = () => setLines(ls => [...ls, { productId: '', quantity: 1, unitPrice: 0, taxRate: 18 }]);
  const removeLine = (i: number) => setLines(ls => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls);

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const taxTotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice * (l.taxRate / 100), 0);
  const grand = subtotal + taxTotal;

  const save = async () => {
    if (!customerId) return toast('Select a customer', 'error');
    const valid = lines.filter(l => l.productId && l.quantity > 0);
    if (valid.length === 0) return toast('Add at least one line item', 'error');
    setSaving(true);
    try {
      const res = await api.post('/invoices', {
        customerId, date, dueDate, notes,
        lines: valid.map(l => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate })),
      });
      toast('Invoice created');
      navigate(`/sales/${res.data.id}`);
    } catch (err) {
      toast(apiError(err), 'error');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-5">
      <button onClick={() => navigate('/sales')} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1.5"><ArrowLeft size={16} /> Back to invoices</button>

      <Card className="p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Create Invoice</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer</label>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 bg-white">
              <option value="">Select customer…</option>
              {customers!.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Invoice date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Due date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500" />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Line items</h3>
            <Button variant="secondary" size="sm" onClick={addLine}><Plus size={15} /> Add line</Button>
          </div>

          <div className="hidden md:grid grid-cols-12 gap-3 px-1 mb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
            <div className="col-span-5">Product</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-1 text-right">GST%</div>
            <div className="col-span-2 text-right">Total</div>
          </div>

          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-12 md:col-span-5">
                  <select value={l.productId} onChange={e => onProduct(i, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 bg-white text-sm">
                    <option value="">Select product…</option>
                    {products!.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                </div>
                <div className="col-span-4 md:col-span-2">
                  <input type="number" min="1" value={l.quantity} onChange={e => setLine(i, { quantity: Number(e.target.value) })}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-right text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500" />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <input type="number" step="0.01" value={l.unitPrice} onChange={e => setLine(i, { unitPrice: Number(e.target.value) })}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-right text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500" />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <input type="number" value={l.taxRate} onChange={e => setLine(i, { taxRate: Number(e.target.value) })}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-right text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500" />
                </div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <span className="text-sm font-medium text-slate-700">{inr(l.quantity * l.unitPrice * (1 + l.taxRate / 100))}</span>
                  <button onClick={() => removeLine(i)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 mt-6 pt-5 flex flex-col md:flex-row justify-between gap-4">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" rows={3}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 resize-none" />
          <div className="w-full md:w-64 space-y-2 text-sm shrink-0">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="text-slate-800">{inr(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">GST</span><span className="text-slate-800">{inr(taxTotal)}</span></div>
            <div className="flex justify-between font-semibold text-base pt-2 border-t border-slate-100"><span>Total</span><span>{inr(grand)}</span></div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => navigate('/sales')}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save & Post'}</Button>
        </div>
      </Card>
    </div>
  );
}
