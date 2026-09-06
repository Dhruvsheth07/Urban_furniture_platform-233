import { useState } from 'react';
import { Users, Plus, X, ShieldCheck, Mail, UserCheck, UserX, Loader2, Pencil } from 'lucide-react';
import api, { apiError } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { Card, Button, Loading, ErrorState, EmptyState, toast } from '../components/ui';

type Role = { id: string; key: string; name: string; description: string };
type TeamUser = { id: string; name: string; email: string; isActive: boolean; role: string | null; roleKey: string | null };

const ROLE_COLORS: Record<string, string> = {
  ADMIN:      'bg-violet-100 text-violet-700',
  OWNER:      'bg-amber-100 text-amber-700',
  ACCOUNTANT: 'bg-blue-100 text-blue-700',
  SALES:      'bg-emerald-100 text-emerald-700',
  PURCHASE:   'bg-cyan-100 text-cyan-700',
  INVENTORY:  'bg-orange-100 text-orange-700',
};
const roleColor = (key: string | null) => ROLE_COLORS[key || ''] || 'bg-slate-100 text-slate-600';

const inp = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white';
const lbl = 'block text-xs font-medium text-slate-600 mb-1.5';

/* ── Add / Edit User Modal ── */
function UserModal({
  roles, editing, onClose, onDone,
}: {
  roles: Role[];
  editing?: TeamUser;
  onClose: () => void;
  onDone: () => void;
}) {
  const isEdit = !!editing;
  const [name, setName] = useState(editing?.name || '');
  const [email, setEmail] = useState(editing?.email || '');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState(roles.find(r => r.key === editing?.roleKey)?.id || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || (!isEdit && !email.trim())) {
      toast('Name and email are required', 'error'); return;
    }
    if (!isEdit && !password.trim()) {
      toast('Password is required for new users', 'error'); return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/users/${editing!.id}`, { name, ...(password ? { password } : {}) });
      } else {
        await api.post('/users', { name, email, password, roleId: roleId || undefined });
      }
      toast(isEdit ? 'User updated' : 'User created');
      onDone();
    } catch (err) {
      toast(apiError(err), 'error');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              {isEdit ? <Pencil size={15} /> : <Plus size={15} />}
            </div>
            <h2 className="text-sm font-semibold text-slate-800">{isEdit ? 'Edit User' : 'Add Team Member'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className={lbl}>Full Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" className={inp} />
          </div>
          {!isEdit && (
            <div>
              <label className={lbl}>Email Address *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@company.com" className={inp} />
            </div>
          )}
          <div>
            <label className={lbl}>{isEdit ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={isEdit ? 'Enter new password…' : 'Min 8 characters'} className={inp} />
          </div>
          {!isEdit && (
            <div>
              <label className={lbl}>Role</label>
              <select value={roleId} onChange={e => setRoleId(e.target.value)} className={inp}>
                <option value="">No role assigned</option>
                {roles.filter(r => r.key !== 'PORTAL').map(r => (
                  <option key={r.id} value={r.id}>{r.name} — {r.description || r.key}</option>
                ))}
              </select>
            </div>
          )}

          {/* Role legend */}
          {!isEdit && (
            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-medium text-slate-500 mb-2">Role Access Guide</p>
              {roles.filter(r => !['PORTAL', 'OWNER'].includes(r.key)).map(r => (
                <div key={r.id} className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${roleColor(r.key)}`}>{r.name}</span>
                  <span className="text-xs text-slate-500">{r.description || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={save} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function TeamManagement() {
  const { data: users, loading: lu, error: eu, refetch } = useFetch<TeamUser[]>('/users');
  const { data: roles, loading: lr, error: er } = useFetch<Role[]>('/roles');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<TeamUser | undefined>();
  const [toggling, setToggling] = useState<string | null>(null);

  const toggleActive = async (u: TeamUser) => {
    setToggling(u.id);
    try {
      await api.put(`/users/${u.id}`, { isActive: !u.isActive });
      toast(u.isActive ? `${u.name} deactivated` : `${u.name} reactivated`);
      refetch();
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setToggling(null);
    }
  };

  const openEdit = (u: TeamUser) => { setEditing(u); setModal('edit'); };
  const closeModal = () => { setModal(null); setEditing(undefined); };

  if (lu || lr) return <Loading label="Loading team…" />;
  if (eu || er) return <ErrorState message={eu || er || 'Failed to load'} />;

  const active = (users || []).filter(u => u.isActive);
  const inactive = (users || []).filter(u => !u.isActive);

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Users size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Team Management</h1>
            <p className="text-sm text-slate-500">{active.length} active · {inactive.length} deactivated</p>
          </div>
        </div>
        <Button onClick={() => setModal('add')}>
          <Plus size={15} /> Add Team Member
        </Button>
      </div>

      {/* Role breakdown cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {(roles || []).filter(r => !['PORTAL', 'OWNER'].includes(r.key)).map(r => {
          const count = (users || []).filter(u => u.isActive && u.roleKey === r.key).length;
          return (
            <div key={r.id} className="bg-white rounded-xl border border-slate-100 p-3 text-center">
              <p className="text-2xl font-bold text-slate-800">{count}</p>
              <span className={`mt-1 inline-block px-2 py-0.5 text-xs rounded-full font-medium ${roleColor(r.key)}`}>{r.name}</span>
            </div>
          );
        })}
      </div>

      {/* Active Users */}
      <Card>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <UserCheck size={16} className="text-emerald-500" />
          <h3 className="text-sm font-semibold text-slate-800">Active Users</h3>
          <span className="ml-auto text-xs text-slate-400">{active.length} members</span>
        </div>
        {active.length === 0 ? (
          <EmptyState title="No active users" hint="Add team members using the button above." />
        ) : (
          <div className="divide-y divide-slate-100">
            {active.map(u => (
              <div key={u.id} className="px-6 py-4 flex items-center gap-4">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold shrink-0">
                  {u.name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 truncate">{u.name}</p>
                    {u.roleKey && (
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium shrink-0 ${roleColor(u.roleKey)}`}>
                        {u.role}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Mail size={11} className="text-slate-400" />
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(u)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => toggleActive(u)} disabled={toggling === u.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50">
                    {toggling === u.id ? <Loader2 size={12} className="animate-spin" /> : <UserX size={12} />}
                    Deactivate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Deactivated Users */}
      {inactive.length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <UserX size={16} className="text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-500">Deactivated Users</h3>
            <span className="ml-auto text-xs text-slate-400">{inactive.length} members</span>
          </div>
          <div className="divide-y divide-slate-100">
            {inactive.map(u => (
              <div key={u.id} className="px-6 py-4 flex items-center gap-4 opacity-60">
                <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-sm font-bold shrink-0">
                  {u.name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-600 truncate line-through">{u.name}</p>
                    {u.roleKey && (
                      <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-slate-100 text-slate-500 shrink-0">{u.role}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{u.email}</p>
                </div>
                <button onClick={() => toggleActive(u)} disabled={toggling === u.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50 opacity-100">
                  {toggling === u.id ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />}
                  Reactivate
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Role legend */}
      <Card>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <ShieldCheck size={16} className="text-brand-500" />
          <h3 className="text-sm font-semibold text-slate-800">Role Access Matrix</h3>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'ADMIN',      name: 'Admin',      access: 'Full access to all modules including user management' },
            { key: 'ACCOUNTANT', name: 'Accountant', access: 'Reports, Accounting, Invoices, Vendor Bills, Payments, Contacts, Inventory' },
            { key: 'SALES',      name: 'Sales',      access: 'Sales orders, Invoices, Contacts, Products, Payments, Dashboard' },
            { key: 'PURCHASE',   name: 'Purchase',   access: 'Purchase orders, Vendor Bills, Contacts, Products, Payments, Dashboard' },
            { key: 'INVENTORY',  name: 'Inventory',  access: 'Products, Warehouses, Stock Movements, Dashboard' },
          ].map(r => (
            <div key={r.key} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium shrink-0 mt-0.5 ${roleColor(r.key)}`}>{r.name}</span>
              <p className="text-xs text-slate-500 leading-relaxed">{r.access}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Modals */}
      {modal && (
        <UserModal
          roles={roles || []}
          editing={modal === 'edit' ? editing : undefined}
          onClose={closeModal}
          onDone={() => { closeModal(); refetch(); }}
        />
      )}
    </div>
  );
}
