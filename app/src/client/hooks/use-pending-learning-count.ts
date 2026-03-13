import { useCallback, useEffect, useState } from "react";
import { useWorkspaceState } from "../stores/workspace-state";

const POLL_INTERVAL_MS = 60_000;

/** Pure function: builds the API URL for fetching pending learnings count. */
export function buildPendingCountUrl(workspaceId: string): string {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}/learnings?status=pending_approval`;
}

/** Pure function: extracts the count of learnings from the API response payload. */
export function extractPendingCount(data: Record<string, unknown>): number {
  const learnings = data.learnings;
  if (!Array.isArray(learnings)) return 0;
  return learnings.length;
}

type UsePendingLearningCountReturn = {
  pendingCount: number;
  isLoading: boolean;
};

/** Polls the learnings API for pending_approval count on a 60s interval. */
export function usePendingLearningCount(): UsePendingLearningCountReturn {
  const workspaceId = useWorkspaceState((s) => s.workspaceId);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCount = useCallback(async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    try {
      const url = buildPendingCountUrl(workspaceId);
      const response = await fetch(url);
      if (!response.ok) return;
      const data = (await response.json()) as Record<string, unknown>;
      setPendingCount(extractPendingCount(data));
    } catch {
      // Polling failure is non-critical; count stays at previous value
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;

    void fetchCount();
    const intervalId = setInterval(() => void fetchCount(), POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [workspaceId, fetchCount]);

  return { pendingCount, isLoading };
}
