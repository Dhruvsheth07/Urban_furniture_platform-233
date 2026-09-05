import { useState, useEffect, useCallback } from 'react';
import api, { apiError } from './api';

// Small data-fetching hook with loading/error/refetch.
export function useFetch<T = any>(url: string | null, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(url);
      setData(res.data);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, deps);

  return { data, loading, error, refetch: load, setData };
}
