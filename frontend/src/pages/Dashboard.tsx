import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { IndianRupee, TrendingUp, TrendingDown, Landmark, ArrowDownCircle, ArrowUpCircle, Boxes, AlertTriangle } from 'lucide-react';
import { useFetch } from '../lib/useFetch';
import { inr, inrCompact } from '../lib/format';
import { Card, Loading, ErrorState } from '../components/ui';

type Dashboard = {
  revenue: number; expense: number; netProfit: number; cash: number;
  receivables: number; payables: number; inventoryValue: number; overdueInvoices: number;
  monthly: { name: string; revenue: number; expense: number }[];
};

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <p className="text-xl lg:text-2xl font-bold text-slate-800 mt-1 whitespace-nowrap">{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>{icon}</div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { data, loading, error, refetch } = useFetch<Dashboard>('/reports/dashboard');

  if (loading) return <Loading label="Loading dashboard…" />;
  if (error || !data) return <ErrorState message={error || 'No data'} onRetry={refetch} />;

  const profitPositive = data.netProfit >= 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <Kpi label="Revenue" value={inr(data.revenue)} icon={<IndianRupee size={22} className="text-emerald-600" />} tone="bg-emerald-50" />
        <Kpi label="Expenses" value={inr(data.expense)} icon={<TrendingDown size={22} className="text-rose-600" />} tone="bg-rose-50" />
        <Kpi label="Net Profit" value={inr(data.netProfit)}
          icon={profitPositive ? <TrendingUp size={22} className="text-emerald-600" /> : <TrendingDown size={22} className="text-rose-600" />}
          tone={profitPositive ? 'bg-emerald-50' : 'bg-rose-50'} />
        <Kpi label="Cash & Bank" value={inr(data.cash)} icon={<Landmark size={22} className="text-blue-600" />} tone="bg-blue-50" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <Kpi label="Receivables" value={inr(data.receivables)} icon={<ArrowDownCircle size={22} className="text-indigo-600" />} tone="bg-indigo-50" />
        <Kpi label="Payables" value={inr(data.payables)} icon={<ArrowUpCircle size={22} className="text-amber-600" />} tone="bg-amber-50" />
        <Kpi label="Inventory Value" value={inr(data.inventoryValue)} icon={<Boxes size={22} className="text-purple-600" />} tone="bg-purple-50" />
        <Kpi label="Overdue Invoices" value={String(data.overdueInvoices)} icon={<AlertTriangle size={22} className="text-rose-600" />} tone="bg-rose-50" />
      </div>

      <Card className="p-5">
        <h3 className="text-base font-semibold text-slate-800 mb-4">Revenue vs Expenses — last 6 months</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.monthly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => inrCompact(v)} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} width={70} />
              <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
