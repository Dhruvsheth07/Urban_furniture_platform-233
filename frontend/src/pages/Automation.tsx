import { useState } from 'react';
import { Zap, Play, Clock, CheckCircle2, XCircle } from 'lucide-react';
import api, { apiError } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { fmtDate } from '../lib/format';
import { Card, CardHeader, Button, Loading, ErrorState, EmptyState, toast } from '../components/ui';

type Rule = { id: string; triggerEvent: string; actionType: string; condition: string; isActive: boolean };
type Run = { id: string; ruleId: string; status: string; details: string; executedAt: string };

const TRIGGER_LABEL: Record<string, string> = {
  INVOICE_OVERDUE: 'Invoice overdue',
  LOW_STOCK: 'Low stock',
};
const ACTION_LABEL: Record<string, string> = {
  SEND_EMAIL: 'Send reminder email',
  CREATE_ACTION_ITEM: 'Create reorder proposal',
};

export default function Automation() {
  const rules = useFetch<Rule[]>('/automation/rules');
  const runs = useFetch<Run[]>('/automation/runs');
  const [running, setRunning] = useState(false);
  const [toggling, setToggling] = useState('');

  const run = async () => {
    setRunning(true);
    try {
      const res = await api.post('/automation/run');
      toast(res.data.emailEnabled ? `Processed ${res.data.count} action(s)` : `Processed ${res.data.count} action(s) (email disabled — in-app only)`);
      runs.refetch();
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setRunning(false);
    }
  };

  const toggle = async (r: Rule) => {
    setToggling(r.id);
    try {
      await api.patch(`/automation/rules/${r.id}/toggle`);
      rules.refetch();
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setToggling('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center"><Zap size={20} /></div>
          <div>
            <p className="font-medium text-slate-800">Automation rules</p>
            <p className="text-xs text-slate-400">Reminders and reorder proposals — never posts accounting entries</p>
          </div>
        </div>
        <Button onClick={run} disabled={running}><Play size={15} /> {running ? 'Running…' : 'Run now'}</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {rules.loading ? <Loading /> : rules.error ? <ErrorState message={rules.error} onRetry={rules.refetch} /> :
          !rules.data?.length ? <Card><EmptyState title="No rules configured" /></Card> :
          rules.data.map(r => (
            <Card key={r.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-slate-800">{TRIGGER_LABEL[r.triggerEvent] || r.triggerEvent}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{ACTION_LABEL[r.actionType] || r.actionType}</p>
                  <p className="text-xs text-slate-400 mt-1 font-mono">when {r.condition}</p>
                </div>
                <button onClick={() => toggle(r)} disabled={toggling === r.id}
                  className={`relative w-11 h-6 rounded-full transition-colors ${r.isActive ? 'bg-brand-500' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${r.isActive ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </Card>
          ))}
      </div>

      <Card>
        <CardHeader title="Recent runs" subtitle="Automation execution log" />
        {runs.loading ? <Loading /> : runs.error ? <ErrorState message={runs.error} onRetry={runs.refetch} /> :
          !runs.data?.length ? <EmptyState title="No runs yet" hint="Trigger a run to see the log." /> : (
            <div className="divide-y divide-slate-100">
              {runs.data.map(run => (
                <div key={run.id} className="p-4 flex items-start gap-3">
                  {run.status === 'SUCCESS'
                    ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                    : <XCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">{run.details}</p>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><Clock size={11} /> {fmtDate(run.executedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
      </Card>
    </div>
  );
}
