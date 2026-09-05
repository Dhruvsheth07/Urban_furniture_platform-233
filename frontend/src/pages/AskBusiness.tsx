import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User } from 'lucide-react';
import api, { apiError } from '../lib/api';
import { Card } from '../components/ui';

type Msg = { role: 'ai' | 'user'; text: string };

const SUGGESTIONS = [
  'What is our net profit?',
  'Which invoices are overdue?',
  'Who owes us the most?',
  'What is low on stock?',
];

export default function AskBusiness() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'ai', text: 'Ask me about your finances — profit, revenue, cash, overdue invoices, top debtors or low stock. Answers come straight from your posted ledger data.' },
  ]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const send = async (text?: string) => {
    const q = (text ?? query).trim();
    if (!q || loading) return;
    setQuery('');
    setMessages(m => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await api.post('/ai/ask', { question: q });
      setMessages(m => [...m, { role: 'ai', text: res.data.answer }]);
    } catch (err) {
      setMessages(m => [...m, { role: 'ai', text: apiError(err) }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card className="flex flex-col h-[calc(100vh-9rem)]">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center"><Sparkles size={18} /></div>
          <div>
            <h2 className="font-semibold text-slate-800 leading-tight">Ask Your Business</h2>
            <p className="text-xs text-slate-400">Grounded in real ledger data</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-thin">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-brand-50 text-brand-600'}`}>
                {m.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
              </div>
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-brand-600 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'}`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><Sparkles size={16} /></div>
              <div className="px-4 py-3 rounded-2xl bg-slate-100 flex gap-1">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)} className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200">{s}</button>
            ))}
          </div>
        )}

        <div className="p-4 border-t border-slate-100 flex gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask a question…"
            className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500" />
          <button onClick={() => send()} disabled={loading || !query.trim()}
            className="px-4 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center">
            <Send size={18} />
          </button>
        </div>
      </Card>
    </div>
  );
}
