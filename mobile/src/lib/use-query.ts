import { useCallback, useEffect, useRef, useState } from "react";
import { useActingUser } from "./acting-user";

export type QueryState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

// tiny data hook. refetches whenever the acting user changes or the demo is reset.
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []): QueryState<T> {
  const { version } = useActingUser();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  // only the newest request may write state. without this, a slow response for the
  // previous acting user could land after a switch and show the wrong person's view.
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const d = await fnRef.current();
      if (mine !== seq.current) return;
      setData(d);
      setError(null);
    } catch (e) {
      if (mine !== seq.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setData(null); // never show the last person's data while the next one loads
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, version, ...deps]);

  return { data, loading, error, reload };
}
