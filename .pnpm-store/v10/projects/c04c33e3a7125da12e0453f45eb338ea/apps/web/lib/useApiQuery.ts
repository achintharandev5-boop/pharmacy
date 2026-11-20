'use client';

import { useCallback, useEffect, useState } from 'react';
import { NETWORK_ERROR_MESSAGE, type ApiResult } from './api/types';

export type QueryState<T> =
  | { status: 'loading'; data: undefined; error: undefined; isFetching: true; retry: () => void }
  | { status: 'error'; data: undefined; error: string; isFetching: boolean; retry: () => void }
  | { status: 'success'; data: T; error: undefined; isFetching: boolean; retry: () => void };

/**
 * Runs a server action that returns an ApiResult and tracks loading / error / success.
 *
 * `deps` work like useEffect dependencies and must be JSON-serialisable. While a
 * refetch is in flight (for example after a filter change) the previous successful
 * data stays visible and `isFetching` is true.
 */
export function useApiQuery<T>(fetcher: () => Promise<ApiResult<T>>, deps: readonly unknown[]): QueryState<T> {
  const [reloadCount, setReloadCount] = useState(0);
  const key = JSON.stringify([deps, reloadCount]);
  const [settled, setSettled] = useState<{ key: string; result: ApiResult<T> } | null>(null);
  const [lastData, setLastData] = useState<{ value: T } | null>(null);

  useEffect(() => {
    let active = true;
    fetcher().then(
      (result) => {
        if (!active) return;
        setSettled({ key, result });
        if (result.ok) setLastData({ value: result.data });
      },
      () => {
        if (active) setSettled({ key, result: { ok: false, error: NETWORK_ERROR_MESSAGE } });
      },
    );
    return () => {
      active = false;
    };
    // `key` captures deps and retries; the fetcher closure is recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const retry = useCallback(() => setReloadCount((n) => n + 1), []);
  const isFetching = settled?.key !== key;

  if (settled && !isFetching) {
    return settled.result.ok
      ? { status: 'success', data: settled.result.data, error: undefined, isFetching: false, retry }
      : { status: 'error', data: undefined, error: settled.result.error, isFetching: false, retry };
  }
  // Refetching: keep showing the last good data rather than flashing a spinner.
  if (lastData && settled?.result.ok) {
    return { status: 'success', data: lastData.value, error: undefined, isFetching: true, retry };
  }
  return { status: 'loading', data: undefined, error: undefined, isFetching: true, retry };
}
