import { useFetch } from '../lib/useFetch';
import { inr } from '../lib/format';
import { Card, CardHeader, Loading, ErrorState, EmptyState } from '../components/ui';

type Health = {
  overall: number;
  metrics: { key: string; score: number; reason: string }[];
  summary: { revenue: number; expense: number; netProfit: number; cash: number; receivables: number; overdueAmount: number };
};
type RiskRow = { customer: { name: string }; outstanding: number; overdueCount: number; maxDaysOverdue: number; risk: string; reason: string };

function scoreColor(s: number) {
  if (s >= 75) return 'text-emerald-600';
  if (s >= 50) return 'text-amber-600';
  return 'text-rose-600';
}
function barColor(s: number) {
  if (s >= 75) return 'bg-emerald-500';
  if (s >= 50) return 'bg-amber-500';
  return 'bg-rose-500';
}

function Gauge({ score }: { score: number }) {
  const r = 52, c = 2 * Math.PI * r, off = c - (score / 100) * c;
  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" strokeLinecap="round"
          className={score >= 75 ? 'stroke-emerald-500' : score >= 50 ? 'stroke-amber-500' : 'stroke-rose-500'}
          strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</span>
        <span className="text-xs text-slate-400">/ 100</span>
      </div>
    </div>
  );
}

export default function BusinessHealth() {
  const { data, loading, error, refetch } = useFetch<Health>('/intelligence/health');
  const risk = useFetch<RiskRow[]>('/intelligence/risk');

  if (loading) return <Loading label="Analyzing business health…" />;
  if (error || !data) return <ErrorState message={error || 'No data'} onRetry={refetch} />;

  const s = data.summary;

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <Gauge score={data.overall} />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-800">Overall Health Score</h2>
            <p className="text-sm text-slate-500 mt-1">Composite of profitability, cash, receivables, inventory and customers — all computed from posted ledger data.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
              <div><p className="text-xs text-slate-400">Revenue</p><p className="font-semibold text-slate-800">{inr(s.revenue)}</p></div>
              <div><p className="text-xs text-slate-400">Net Profit</p><p className={`font-semibold ${s.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{inr(s.netProfit)}</p></div>
              <div><p className="text-xs text-slate-400">Cash & Bank</p><p className="font-semibold text-slate-800">{inr(s.cash)}</p></div>
              <div><p className="text-xs text-slate-400">Receivables</p><p className="font-semibold text-slate-800">{inr(s.receivables)}</p></div>
              <div><p className="text-xs text-slate-400">Overdue</p><p className="font-semibold text-rose-600">{inr(s.overdueAmount)}</p></div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {data.metrics.map(m => (
          <Card key={m.key} className="p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-slate-800">{m.key}</h3>
              <span className={`text-lg font-bold ${scoreColor(m.score)}`}>{m.score}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
              <div className={`h-full rounded-full ${barColor(m.score)}`} style={{ width: `${m.score}%` }} />
            </div>
            <p className="text-sm text-slate-500">{m.reason}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Customer Risk" subtitle="Ranked by outstanding exposure" />
        {risk.loading ? <Loading /> : risk.error ? <ErrorState message={risk.error} onRetry={risk.refetch} /> :
          !risk.data?.length ? <EmptyState title="No customer risk to report" /> : (
            <div className="divide-y divide-slate-100">
              {risk.data.map((r, i) => (
                <div key={i} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{r.customer.name}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${r.risk === 'HIGH' ? 'bg-rose-100 text-rose-700' : r.risk === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{r.risk}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5 truncate">{r.reason}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-slate-800">{inr(r.outstanding)}</p>
                    <p className="text-xs text-slate-400">outstanding</p>
                  </div>
                </div>
              ))}
            </div>
          )}
      </Card>
    </div>
  );
}
