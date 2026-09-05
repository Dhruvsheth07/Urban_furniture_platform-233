import { useState } from 'react';
import { AlertTriangle, PackageX, FileWarning, Bell, Play } from 'lucide-react';
import api, { apiError } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { inr } from '../lib/format';
import { Card, CardHeader, Button, Loading, ErrorState, EmptyState, toast } from '../components/ui';

type Action = {
  id: string; type: string; priority: string; title: string;
  amount?: number; detail: string; referenceId: string; action: string;
};

const ICONS: Record<string, React.ReactNode> = {
  OVERDUE_INVOICE: <AlertTriangle size={18} />,
  LOW_STOCK: <PackageX size={18} />,
  DUPLICATE: <FileWarning size={18} />,
};

export default function ActionCenter() {
  const { data, loading, error, refetch } = useFetch<Action[]>('/intelligence/actions');
  const [running, setRunning] = useState(false);

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
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${a.priority === 'HIGH' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                    {ICONS[a.type] || <Bell size={18} />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{a.title}</p>
                    <p className="text-sm text-slate-500">{a.detail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {a.amount != null && <span className="font-semibold text-slate-800">{inr(a.amount)}</span>}
                  <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${a.priority === 'HIGH' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{a.priority}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
