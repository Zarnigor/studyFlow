import { useState, useEffect, useRef } from "react";

export function useApi(fetcher, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const mounted = useRef(true);
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    setError(null);
    fetcher()
      .then(res => { if (mounted.current) setData(res); })
      .catch(e  => { if (mounted.current) setError(e.message ?? "Xatolik"); })
      .finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  const refetch = () => {
    mounted.current = true;
    setLoading(true);
    setError(null);
    fetcher()
      .then(res => { if (mounted.current) setData(res); })
      .catch(e  => { if (mounted.current) setError(e.message ?? "Xatolik"); })
      .finally(() => { if (mounted.current) setLoading(false); });
  };

  return { data, loading, error, refetch };
}

export function useMutation(fn) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const mutate = async (...args) => {
    setLoading(true); setError(null);
    try { return await fn(...args); }
    catch (e) { setError(e.message ?? "Xatolik"); throw e; }
    finally { setLoading(false); }
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
