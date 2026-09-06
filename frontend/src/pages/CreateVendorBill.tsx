import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Loader2, Upload, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import api, { apiError } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { inr } from '../lib/format';
import { Card, Button, Loading, ErrorState, toast } from '../components/ui';

type Vendor = { id: string; name: string; gstin?: string };
type Product = { id: string; name: string; sku: string; purchasePrice: string };
type LineRow = { productId: string; quantity: number; unitPrice: number; taxRate: number };

const inp = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:border-slate-500 bg-white';
const lbl = 'block text-xs font-medium text-slate-600 mb-1';

export default function CreateVendorBill() {
  const navigate = useNavigate();
  const { data: vendorRes, loading: lv, error: ev } = useFetch<any>('/contacts?type=VENDOR&limit=1000');
  const { data: productRes, loading: lp, error: ep } = useFetch<any>('/products?limit=1000');
  const vendors = vendorRes?.data as Vendor[] | undefined;
  const products = productRes?.data as Product[] | undefined;

  const today = new Date().toISOString().slice(0, 10);
  const [vendorId, setVendorId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [date, setDate] = useState(today);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineRow[]>([{ productId: '', quantity: 1, unitPrice: 0, taxRate: 18 }]);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning]   = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setOcrResult(null);
    try {
      const fd = new FormData();
      fd.append('bill', file);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/ai/parse-bill', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'OCR failed');

      const ex = json.extracted;
      // Auto-fill form fields
      if (ex.invoiceNumber) setBillNumber(ex.invoiceNumber);
      if (ex.date) setDate(ex.date);
      if (ex.dueDate) setDueDate(ex.dueDate);
      // Auto-select vendor if matched
      if (json.matchedVendorId) setVendorId(json.matchedVendorId);
      // Auto-fill line items if detected
      if (ex.items && ex.items.length > 0) {
        setLines(ex.items.map((item: any) => ({
          productId: '',
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          taxRate: item.taxRate || 18,
        })));
      }
      setOcrResult(json);
    } catch (err: any) {
      toast(err.message || 'OCR scan failed', 'error');
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (lv || lp) return <Loading label="Loading form…" />;
  if (ev || ep) return <ErrorState message={ev || ep || 'Failed to load'} />;

  const setLine = (i: number, patch: Partial<LineRow>) =>
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  const onProduct = (i: number, productId: string) => {
    const p = products!.find(x => x.id === productId);
    setLine(i, { productId, unitPrice: p ? Number(p.purchasePrice) : 0 });
  };

  const addLine = () => setLines(ls => [...ls, { productId: '', quantity: 1, unitPrice: 0, taxRate: 18 }]);
  const removeLine = (i: number) => setLines(ls => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls);

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const taxTotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice * (l.taxRate / 100), 0);
  const grand = subtotal + taxTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) { toast('Please select a vendor', 'error'); return; }
    if (lines.some(l => !l.productId)) { toast('Please select a product for all line items', 'error'); return; }

    setSaving(true);
    try {
      await api.post('/vendor-bills', {
        vendorId,
        billNumber: billNumber.trim() || undefined,
        date,
        dueDate,
        notes,
        lines: lines.map(l => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
        })),
      });
      toast('Vendor bill created — inventory updated');
      navigate('/purchases');
    } catch (err: any) {
      toast(apiError(err), 'error');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/purchases')}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">New Vendor Bill</h1>
            <p className="text-sm text-slate-500 mt-0.5">Items purchased are added to inventory automatically</p>
          </div>
        </div>
        {/* OCR Upload Button */}
        <div>
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleOcrUpload} />
          <button type="button" disabled={scanning}
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border-2 border-dashed border-brand-400 text-brand-600 hover:bg-brand-50 disabled:opacity-50 transition-colors">
            {scanning
              ? <><Loader2 size={16} className="animate-spin" /> Scanning PDF…</>
              : <><Upload size={16} /> Scan Invoice PDF with OCR</>}
          </button>
        </div>
      </div>

      {/* OCR Result Banner */}
      {ocrResult && (
        <div className={`rounded-xl border p-4 ${
          ocrResult.confidence === 'HIGH' ? 'bg-emerald-50 border-emerald-200' :
          ocrResult.confidence === 'MEDIUM' ? 'bg-amber-50 border-amber-200' :
          'bg-rose-50 border-rose-200'
        }`}>
          <div className="flex items-start gap-3">
            {ocrResult.confidence === 'HIGH'
              ? <CheckCircle size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              : ocrResult.confidence === 'MEDIUM'
              ? <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
              : <XCircle size={18} className="text-rose-600 mt-0.5 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-slate-800">
                  OCR Scan Complete —
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  ocrResult.confidence === 'HIGH' ? 'bg-emerald-100 text-emerald-700' :
                  ocrResult.confidence === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                  'bg-rose-100 text-rose-700'
                }`}>{ocrResult.confidence} confidence</span>
                <span className="text-xs text-slate-400">via Tesseract.js (offline)</span>
              </div>
              {ocrResult.warnings && ocrResult.warnings.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {ocrResult.warnings.map((w: string, i: number) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                      <AlertTriangle size={11} className="text-amber-500 mt-0.5 flex-shrink-0" />{w}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-slate-500 mt-2">Form fields have been auto-filled. Please review every field before saving.</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Header card */}
        <Card>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="col-span-full sm:col-span-2 lg:col-span-1">
              <label className={lbl}>Vendor *</label>
              <select value={vendorId} onChange={e => setVendorId(e.target.value)} className={inp} required>
                <option value="">Select vendor…</option>
                {(vendors || []).map(v => (
                  <option key={v.id} value={v.id}>{v.name}{v.gstin ? ` (${v.gstin})` : ''}</option>
                ))}
              </select>
              {(vendors || []).length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No vendors found. Add a vendor in Contacts first.</p>
              )}
            </div>
            <div>
              <label className={lbl}>Bill Number</label>
              <input value={billNumber} onChange={e => setBillNumber(e.target.value)}
                placeholder="Auto-generated if blank" className={inp} />
            </div>
            <div>
              <label className={lbl}>Bill Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inp} required />
            </div>
            <div>
              <label className={lbl}>Due Date *</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inp} required />
            </div>
            <div className="col-span-full">
              <label className={lbl}>Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Optional internal note…" className={inp} />
            </div>
          </div>
        </Card>

        {/* Line items */}
        <Card>
          <div className="px-6 pt-5 pb-2 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Items Purchased</h3>
              <p className="text-xs text-slate-400 mt-0.5">Stock levels update automatically on save</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addLine}>
              <Plus size={14} /> Add Item
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-medium">
                  <th className="px-4 py-3 text-left w-[40%]">Product</th>
                  <th className="px-4 py-3 text-right w-[12%]">Qty</th>
                  <th className="px-4 py-3 text-right w-[18%]">Unit Price (₹)</th>
                  <th className="px-4 py-3 text-right w-[13%]">GST %</th>
                  <th className="px-4 py-3 text-right w-[14%]">Total</th>
                  <th className="px-4 py-3 w-[3%]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((l, i) => {
                  const lineTotal = l.quantity * l.unitPrice * (1 + l.taxRate / 100);
                  return (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5">
                        <select value={l.productId} onChange={e => onProduct(i, e.target.value)}
                          className={`${inp} text-xs`}>
                          <option value="">Select product…</option>
                          {(products || []).map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <input type="number" min="0.01" step="0.01" value={l.quantity}
                          onChange={e => setLine(i, { quantity: Number(e.target.value) })}
                          className={`${inp} text-right text-xs`} />
                      </td>
                      <td className="px-4 py-2.5">
                        <input type="number" min="0" step="0.01" value={l.unitPrice}
                          onChange={e => setLine(i, { unitPrice: Number(e.target.value) })}
                          className={`${inp} text-right text-xs`} />
                      </td>
                      <td className="px-4 py-2.5">
                        <select value={l.taxRate}
                          onChange={e => setLine(i, { taxRate: Number(e.target.value) })}
                          className={`${inp} text-xs`}>
                          <option value={0}>0%</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                          <option value={28}>28%</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700 text-xs whitespace-nowrap">
                        {inr(lineTotal)}
                      </td>
                      <td className="px-4 py-2.5">
                        <button type="button" onClick={() => removeLine(i)}
                          className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="p-6 flex justify-end border-t border-slate-100">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span><span>{inr(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST</span><span>{inr(taxTotal)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800 text-base border-t border-slate-200 pt-2">
                <span>Total</span><span>{inr(grand)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Inventory notice */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3.5 flex items-start gap-3">
          <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">✓</div>
          <div className="text-sm text-emerald-800">
            <span className="font-medium">Inventory update:</span> When you save this bill, the quantity of each product is added to your inventory and the weighted average cost is recalculated automatically.
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={() => navigate('/purchases')}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save Vendor Bill'}
          </Button>
        </div>
      </form>
    </div>
  );
}
