import { useState, useEffect, useRef, useCallback } from "react";

export function useApi(fetcher, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const abortRef = useRef(null);

  const run = useCallback(() => {
    // Cancel previous in-flight request
    if (abortRef.current) abortRef.current.cancelled = true;
    const token = { cancelled: false };
    abortRef.current = token;

    setLoading(true);
    setError(null);

    fetcher()
      .then(res => {
        if (!token.cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(e => {
        if (!token.cancelled) {
          console.error("useApi error:", e.message);
          setError(e.message ?? "Error");
          setLoading(false);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(deps)]);

  useEffect(() => {
    run();
    return () => {
      if (abortRef.current) abortRef.current.cancelled = true;
    };
  }, [run]);

  return { data, loading, error, refetch: run };
}

export function useMutation(fn) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const mutate = async (...args) => {
    setLoading(true);
    setError(null);
    try {
      return await fn(...args);
    } catch(e) {
      setError(e.message ?? "Error");
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading, error, clearError: () => setError(null) };
}

export function usePaginated(fetcher, initialPage = 1) {
  const [page,    setPage]    = useState(initialPage);
  const [items,   setItems]   = useState([]);
  const [meta,    setMeta]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const depsKey = JSON.stringify([page]);

  useEffect(() => {
    setLoading(true);
    fetcher(page)
      .then(res => { setItems(res?.data ?? []); setMeta(res?.meta ?? null); })
      .catch(e  => setError(e.message))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  return { items, meta, page, setPage, loading, error, reload: () => fetcher(page) };
}