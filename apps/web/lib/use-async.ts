"use client";

import { useCallback, useEffect, useState } from "react";

export function useAsync<T>(loader: () => Promise<T>, dependencies: React.DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let current = true;
    queueMicrotask(() => {
      if (!current) return;
      setLoading(true);
      setError(null);
      loader()
        .then((result) => {
          if (current) setData(result);
        })
        .catch((reason) => {
          if (current) setError(reason);
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    });
    return () => {
      current = false;
    };
    // loader is intentionally controlled by the caller-provided dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, nonce]);

  return { data, setData, loading, error, reload };
}
