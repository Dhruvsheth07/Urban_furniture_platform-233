import React, { useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import api, { apiError } from '../lib/api';

const DEMO = [
  { label: 'Owner', email: 'admin@urban.com', password: 'admin123' },
  { label: 'Accountant', email: 'accounts@urban.com', password: 'account123' },
];

export default function Login() {
  const [email, setEmail] = useState('admin@urban.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      window.location.href = '/';
    } catch (err) {
      setError(apiError(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-brand-500 flex items-center justify-center text-white"><Building2 size={24} /></div>
          <div>
            <div className="text-white text-xl font-semibold leading-tight">Urban Furniture</div>
            <div className="text-sm text-slate-400">Business Operations</div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-xl">
          <h2 className="text-xl font-semibold text-slate-800 mb-1">Welcome back</h2>
          <p className="text-sm text-slate-500 mb-6">Sign in to continue to your workspace</p>

          {error && <div className="bg-rose-50 text-rose-700 border border-rose-200 p-3 rounded-lg mb-4 text-sm">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500" required />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium flex items-center justify-center gap-2 disabled:opacity-70">
              {loading && <Loader2 size={16} className="animate-spin" />} Sign in
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Demo accounts</p>
            <div className="space-y-1.5">
              {DEMO.map((d) => (
                <button key={d.email} type="button"
                  onClick={() => { setEmail(d.email); setPassword(d.password); }}
                  className="w-full text-left text-sm px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 flex justify-between items-center">
                  <span className="text-slate-700 font-medium">{d.label}</span>
                  <span className="text-slate-400 text-xs">{d.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
