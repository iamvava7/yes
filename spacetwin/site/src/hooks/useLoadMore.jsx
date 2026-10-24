import { useState, useEffect, useCallback } from "react";

/**
 * Paginare incrementală „load more" pentru listele lungi din Admin.
 * `count` = câte itemi sunt afișați; `loadMore` adaugă încă `pageSize`.
 * Reset automat la schimbarea `resetDeps` (ex: filtru/tab) — nu la realtime reload.
 */
export function useLoadMore(pageSize = 5, resetDeps = []) {
  const [count, setCount] = useState(pageSize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setCount(pageSize); }, resetDeps);
  const loadMore = useCallback(() => setCount((c) => c + pageSize), [pageSize]);
  const reset = useCallback(() => setCount(pageSize), [pageSize]);
  return { count, loadMore, reset, pageSize };
}