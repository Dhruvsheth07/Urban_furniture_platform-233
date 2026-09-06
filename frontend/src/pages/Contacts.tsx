import { useState, useEffect, useCallback } from 'react';
import { Search, Mail, Phone, Plus, Pencil, Trash2, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import api, { apiError } from '../lib/api';
import { Card, Badge, Loading, ErrorState, EmptyState, Table, Th, Td, Button, PageHeader, toast } from '../components/ui';

type Contact = {
  id: string; type: string; name: string; displayName?: string;
  gstin?: string; email?: string; phone?: string;
  billingLine1?: string; billingCity?: string; billingState?: string; billingPincode?: string;
  notes?: string; isActive?: boolean; creditLimit?: number | string;
};
type PagedResponse = { data: Contact[]; total: number; page: number; pageCount: number };

const TABS = ['ALL', 'CUSTOMER', 'VENDOR'];
const PAGE_SIZE = 20;

const EMPTY_FORM = {
  name: '', displayName: '', type: 'CUSTOMER', gstin: '',
  email: '', phone: '', billingLine1: '', billingCity: '',
  billingState: '', billingPincode: '', notes: '', creditLimit: '',
};
type FormData = typeof EMPTY_FORM;

/* ── Pagination ── */
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
        <span className="font-medium text-slate-700">{total}</span> contacts
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

/* ── Add / Edit Modal ── */
function ContactModal({ initial, onClose, onSaved }: { initial?: Contact | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!initial;
  const [form, setForm] = useState<FormData>(
    initial
      ? { name: initial.name || '', displayName: initial.displayName || '', type: initial.type || 'CUSTOMER',
          gstin: initial.gstin || '', email: initial.email || '', phone: initial.phone || '',
          billingLine1: initial.billingLine1 || '', billingCity: initial.billingCity || '',
          billingState: initial.billingState || '', billingPincode: initial.billingPincode || '',
          notes: initial.notes || '', creditLimit: initial.creditLimit ? String(initial.creditLimit) : '' }
      : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setErr('Name is required'); return; }
    setErr(''); setSaving(true);
    try {
      if (isEdit) { await api.put(`/contacts/${initial!.id}`, form); toast('Contact updated'); }
      else        { await api.post('/contacts', form); toast('Contact added'); }
      onSaved(); onClose();
    } catch (e: any) { setErr(apiError(e)); }
    finally { setSaving(false); }
  };

  const inp = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:border-slate-500 bg-white';
  const lbl = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">{isEdit ? 'Edit Contact' : 'Add New Contact'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <span className={lbl}>Type</span>
            <div className="flex gap-2">
              {(['CUSTOMER', 'VENDOR', 'BOTH'] as const).map(t => (
                <button key={t} type="button" onClick={() => set('type', t)}
                  className={`flex-1 py-2 text-sm rounded-lg font-medium border transition-colors ${form.type === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={lbl}>Business / Full Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Orchid Interiors" className={inp} required />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Display Name</label>
              <input value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder="Short name for invoices" className={inp} />
            </div>
          </div>
          <div>
            <label className={lbl}>GSTIN</label>
            <input value={form.gstin} onChange={e => set('gstin', e.target.value)} placeholder="e.g. 27AAACH7409R1ZZ" className={inp} maxLength={15} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="billing@company.com" className={inp} />
            </div>
            <div>
              <label className={lbl}>Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" className={inp} />
            </div>
          </div>
          <div className="space-y-3">
            <span className={lbl}>Billing Address</span>
            <input value={form.billingLine1} onChange={e => set('billingLine1', e.target.value)} placeholder="Street / Address line" className={inp} />
            <div className="grid grid-cols-3 gap-3">
              <input value={form.billingCity}    onChange={e => set('billingCity', e.target.value)}    placeholder="City"    className={inp} />
              <input value={form.billingState}   onChange={e => set('billingState', e.target.value)}   placeholder="State"   className={inp} />
              <input value={form.billingPincode} onChange={e => set('billingPincode', e.target.value)} placeholder="Pincode" className={inp} maxLength={6} />
            </div>
          </div>
          <div>
            <label className={lbl}>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Internal notes…" className={`${inp} resize-none`} />
          </div>
          {/* Credit Limit */}
          <div>
            <label className={lbl}>Credit Limit (₹) <span className="text-slate-400 font-normal">— leave blank for unlimited</span></label>
            <input
              type="number" min="0" step="any"
              value={form.creditLimit}
              onChange={e => set('creditLimit', e.target.value)}
              placeholder="e.g. 500000"
              className={inp}
            />
          </div>
          {err && <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{err}</p>}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Contact'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Delete Confirm Modal ── */
function DeleteConfirm({ contact, onClose, onDeleted }: { contact: Contact; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false);
  const confirm = async () => {
    setLoading(true);
    try { await api.delete(`/contacts/${contact.id}`); toast('Contact deactivated'); onDeleted(); onClose(); }
    catch (e: any) { toast(apiError(e), 'error'); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={22} className="text-rose-600" />
        </div>
        <h3 className="text-base font-semibold text-slate-800 mb-1">Deactivate Contact?</h3>
        <p className="text-sm text-slate-500 mb-5">
          <strong>{contact.name}</strong> will be deactivated. Existing invoices and bills are preserved.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="danger" className="flex-1" disabled={loading} onClick={confirm}>
            {loading && <Loader2 size={14} className="animate-spin" />}Deactivate
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function Contacts() {
  const [result, setResult]           = useState<PagedResponse | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [tab, setTab]                 = useState('ALL');
  const [modal, setModal]             = useState<'add' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected]       = useState<Contact | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search)        params.set('search', search);
      if (tab !== 'ALL') params.set('type', tab);
      const res = await api.get<PagedResponse>(`/contacts?${params}`);
      setResult(res.data);
    } catch (err) { setError(apiError(err)); }
    finally { setLoading(false); }
  }, [page, search, tab]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { load(); }, [load]);

  const openEdit   = (c: Contact) => { setSelected(c); setModal('edit'); };
  const openDelete = (c: Contact) => { setSelected(c); setModal('delete'); };
  const closeModal = () => { setModal(null); setSelected(null); };

  const contacts = result?.data || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contacts"
        subtitle={result ? `${result.total} contact${result.total !== 1 ? 's' : ''}` : 'Loading…'}
        actions={<Button onClick={() => setModal('add')}><Plus size={15} /> Add Contact</Button>}
      />

      {/* Filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1.5">
          {TABS.map(t => (
            <button key={t} onClick={() => { setTab(t); setPage(1); }}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                tab === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}>
              {t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase() + 's'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Search name, email, GSTIN, phone…"
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:border-slate-500 bg-white" />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <Card>
        {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={load} /> :
          contacts.length === 0 ? (
            <EmptyState
              title="No contacts"
              hint={search || tab !== 'ALL'
                ? 'Try clearing your search or filter.'
                : 'Click "Add Contact" to create your first customer or vendor.'}
            />
          ) : (
            <Table>
              <thead>
                <tr><Th>Name</Th><Th>Type</Th><Th>GSTIN</Th><Th>Contact</Th><Th>Location</Th><Th className="text-right">Credit Limit</Th><Th></Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contacts.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 group">
                    <Td>
                      <div className="font-medium text-slate-800">{c.name}</div>
                      {c.displayName && c.displayName !== c.name && <div className="text-xs text-slate-400">{c.displayName}</div>}
                    </Td>
                    <Td><Badge tone={c.type === 'VENDOR' ? 'MEDIUM' : c.type === 'BOTH' ? 'CONFIRMED' : 'LOW'}>{c.type}</Badge></Td>
                    <Td className="text-slate-500 font-mono text-xs">{c.gstin || '—'}</Td>
                    <Td>
                      <div className="space-y-0.5 text-sm">
                        {c.email && <div className="flex items-center gap-1.5 text-slate-600"><Mail size={13} className="text-slate-400" />{c.email}</div>}
                        {c.phone && <div className="flex items-center gap-1.5 text-slate-600"><Phone size={13} className="text-slate-400" />{c.phone}</div>}
                        {!c.email && !c.phone && '—'}
                      </div>
                    </Td>
                    <Td className="text-slate-500">{[c.billingCity, c.billingState].filter(Boolean).join(', ') || '—'}</Td>
                    <Td className="text-right">
                      {Number(c.creditLimit) > 0
                        ? <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            ₹{Number(c.creditLimit).toLocaleString('en-IN')}
                          </span>
                        : <span className="text-xs text-slate-400">Unlimited</span>
                      }
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => openDelete(c)} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600" title="Deactivate">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        {result && (
          <Pagination page={result.page} pageCount={result.pageCount} total={result.total} limit={PAGE_SIZE} onPage={setPage} />
        )}
      </Card>

      {(modal === 'add' || modal === 'edit') && (
        <ContactModal initial={modal === 'edit' ? selected : null} onClose={closeModal} onSaved={() => { load(); closeModal(); }} />
      )}
      {modal === 'delete' && selected && (
        <DeleteConfirm contact={selected} onClose={closeModal} onDeleted={() => { load(); closeModal(); }} />
      )}
    </div>
  );
}
