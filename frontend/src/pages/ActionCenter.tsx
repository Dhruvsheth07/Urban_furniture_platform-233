import { useState } from 'react';
import { AlertTriangle, PackageX, FileWarning, Bell, Play, Mail, X, Loader2, Clock, Send } from 'lucide-react';
import api, { apiError } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { inr } from '../lib/format';
import { Card, Button, Loading, ErrorState, EmptyState, toast } from '../components/ui';

type Action = {
  id: string; type: string; priority: string; title: string;
  amount?: number; detail: string; referenceId: string; action: string;
  contactEmail?: string; contactName?: string;
};

type EmailPreview = {
  to: string; toName: string; subject: string; preview: string;
  smtpConfigured: boolean;
};

const ICONS: Record<string, React.ReactNode> = {
  OVERDUE_INVOICE: <AlertTriangle size={18} />,
  LOW_STOCK: <PackageX size={18} />,
  UPCOMING_DUE: <Clock size={18} />,
  DUPLICATE: <FileWarning size={18} />,
};

const EMAILABLE = new Set(['OVERDUE_INVOICE', 'LOW_STOCK', 'UPCOMING_DUE']);

/* ── Email Preview Modal ── */
function EmailPreviewModal({ action, onClose }: { action: Action; onClose: () => void }) {
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Fetch preview on mount
  useState(() => {
    api.get(`/intelligence/email-preview?type=${action.type}&referenceId=${action.referenceId}`)
      .then(r => setPreview(r.data))
      .catch(e => setLoadErr(apiError(e)))
      .finally(() => setLoading(false));
  });

  const handleSend = async () => {
    if (!preview?.smtpConfigured) return;
    setSending(true);
    try {
      const r = await api.post('/intelligence/send-email', { type: action.type, referenceId: action.referenceId });
      toast(`Email sent to ${r.data.to}`);
      onClose();
    } catch (e: any) {
      toast(apiError(e), 'error');
    } finally {
      setSending(false);
    }
  };

  const typeColor: Record<string, string> = {
    OVERDUE_INVOICE: 'bg-rose-50 border-rose-200',
    UPCOMING_DUE: 'bg-amber-50 border-amber-200',
    LOW_STOCK: 'bg-emerald-50 border-emerald-200',
  };
  const badgeColor: Record<string, string> = {
    OVERDUE_INVOICE: 'bg-rose-100 text-rose-700',
    UPCOMING_DUE: 'bg-amber-100 text-amber-700',
    LOW_STOCK: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <Mail size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Email Preview</h2>
              <p className="text-xs text-slate-400">{action.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center py-10 text-slate-400">
              <Loader2 size={28} className="animate-spin mb-2" />
              <p className="text-sm">Loading email draft…</p>
            </div>
          ) : loadErr ? (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
              <p className="font-medium mb-1">Cannot generate email</p>
              <p>{loadErr}</p>
            </div>
          ) : preview ? (
            <div className="space-y-4">
              {/* To / Subject */}
              <div className={`rounded-xl border p-4 space-y-2.5 ${typeColor[action.type] || 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500 w-14 shrink-0">To:</span>
                  <span className="font-medium text-slate-800">{preview.toName}</span>
                  <span className="text-slate-400 text-xs">({preview.to})</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-slate-500 w-14 shrink-0">Subject:</span>
                  <span className="text-slate-800">{preview.subject}</span>
                </div>
              </div>

              {/* Body preview */}
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Email Content</p>
                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600 leading-relaxed border border-slate-100">
                  {preview.preview}
                </div>
                <p className="text-xs text-slate-400 mt-2">The full formatted email will be sent as HTML to the recipient's inbox.</p>
              </div>

              {/* SMTP warning */}
              {!preview.smtpConfigured && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                  <p className="font-medium">SMTP not configured</p>
                  <p className="text-xs mt-0.5">Add <code className="bg-amber-100 px-1 rounded">SMTP_HOST</code>, <code className="bg-amber-100 px-1 rounded">SMTP_USER</code>, <code className="bg-amber-100 px-1 rounded">SMTP_PASS</code>, <code className="bg-amber-100 px-1 rounded">SMTP_FROM</code> to your server <code className="bg-amber-100 px-1 rounded">.env</code> to enable sending.</p>
                </div>
              )}

              {/* Type badge */}
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${badgeColor[action.type] || 'bg-slate-100 text-slate-600'}`}>
                  {action.type.replace(/_/g, ' ')}
                </span>
                {preview.smtpConfigured && (
                  <span className="text-xs text-emerald-600 font-medium">✓ SMTP configured — ready to send</span>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={!preview || !!loadErr || !preview?.smtpConfigured || sending}
            onClick={handleSend}
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? 'Sending…' : 'Send Email'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function ActionCenter() {
  const { data, loading, error, refetch } = useFetch<Action[]>('/intelligence/actions');
  const [running, setRunning] = useState(false);
  const [emailAction, setEmailAction] = useState<Action | null>(null);

  const runAutomations = async () => {
    setRunning(true);
    try {
      const res = await api.post('/automation/run');
      toast(res.data.count > 0 ? `${res.data.count} action(s) processed` : 'Nothing to process');
      refetch();
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setRunning(false);
    }
  };

  const high = (data || []).filter(a => a.priority === 'HIGH').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center"><Bell size={20} /></div>
          <div>
            <p className="text-sm text-slate-500">{data?.length || 0} open items{high > 0 && `, ${high} high priority`}</p>
            <p className="text-xs text-slate-400">Live from invoices, stock levels and anomaly detection</p>
          </div>
        </div>
        <Button onClick={runAutomations} disabled={running}><Play size={15} /> {running ? 'Running…' : 'Run automations'}</Button>
      </div>

      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={refetch} /> :
        !data?.length ? (
          <Card><EmptyState title="All clear" hint="No overdue invoices, low stock or anomalies right now." /></Card>
        ) : (
          <div className="space-y-3">
            {data.map(a => (
              <Card key={a.id} className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    a.priority === 'HIGH' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {ICONS[a.type] || <Bell size={18} />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{a.title}</p>
                    <p className="text-sm text-slate-500">{a.detail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {a.amount != null && <span className="font-semibold text-slate-800">{inr(a.amount)}</span>}
                  <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                    a.priority === 'HIGH' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                  }`}>{a.priority}</span>
                  {EMAILABLE.has(a.type) && (
                    <button
                      onClick={() => setEmailAction(a)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 transition-colors"
                    >
                      <Mail size={13} /> Email
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

      {emailAction && (
        <EmailPreviewModal action={emailAction} onClose={() => setEmailAction(null)} />
      )}
    </div>
  );
}

