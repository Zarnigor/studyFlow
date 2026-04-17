/**
 * useApi hook — wraps api calls with loading/error state
 * src/hooks/useApi.js
 *
 * Ishlatish:
 *   const { data, loading, error, refetch } = useApi(
 *     () => api.students.list({ page, limit }),
 *     [page, limit]
 *   );
 */
import { useState, useEffect, useCallback, useRef } from "react";

export function useApi(fetcher, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const mountedRef = useRef(true);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mountedRef.current) setData(result);
    } catch (e) {
      if (mountedRef.current) setError(e.message ?? "Xatolik yuz berdi");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { run(); }, [run]);
  useEffect(() => () => { mountedRef.current = false; }, []);

  return { data, loading, error, refetch: run };
}

// ── Mutation hook ──────────────────────────────────────────────
export function useMutation(fn) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const mutate = async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn(...args);
      return result;
    } catch (e) {
      setError(e.message ?? "Xatolik yuz berdi");
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading, error };
}

/**
 * Paginated list hook
 *
 * const { items, meta, page, setPage, loading } = usePaginated(
 *   (p) => api.students.list({ page: p, limit: 20 })
 * );
 */
export function usePaginated(fetcher, initialPage = 1) {
  const [page,    setPage]    = useState(initialPage);
  const [items,   setItems]   = useState([]);
  const [meta,    setMeta]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async (p) => {
    setLoading(true);
    try {
      const res = await fetcher(p);
      setItems(res.data ?? []);
      setMeta(res.meta ?? null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => { load(page); }, [page, load]);

  return { items, meta, page, setPage, loading, error, reload: () => load(page) };
}
