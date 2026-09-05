// INR currency + date formatting for the whole app.
export function inr(n: number | string | null | undefined, opts?: { decimals?: boolean }): string {
  const v = Number(n || 0);
  return v.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: opts?.decimals ? 2 : 0,
    maximumFractionDigits: opts?.decimals ? 2 : 0,
  });
}

// Compact form for KPI cards: ₹11.2L, ₹1.5Cr
export function inrCompact(n: number | string | null | undefined): string {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtNum(n: number | string | null | undefined): string {
  return Number(n || 0).toLocaleString('en-IN');
}
