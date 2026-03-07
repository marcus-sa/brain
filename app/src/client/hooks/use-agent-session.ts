/**
 * useAgentSession -- SSE subscription hook for agent session state.
 *
 * Opens an EventSource when given an active sessionId + streamUrl.
 * Exposes AgentSessionState: status, filesChanged, startedAt,
 * stallWarning, connectionError.
 *
 * Pure core: reduceAgentSessionEvent handles all state transitions.
 * Effect boundary: useEffect manages EventSource lifecycle + stall timer.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AgentStatusEvent,
  AgentFileChangeEvent,
  AgentStallWarningEvent,
} from "../../shared/contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentSessionStatus =
  | "spawning"
  | "active"
  | "idle"
  | "completed"
  | "aborted"
  | "error";

export type AgentSessionState = {
  status: AgentSessionStatus;
  filesChanged: number;
  startedAt: string;
  lastEventAt?: string;
  stallWarning?: { lastEventAt: string; stallDurationSeconds: number };
  error?: string;
  connectionError?: string;
};

// Events the reducer handles (subset of StreamEvent relevant to agent sessions)
type AgentEvent = AgentStatusEvent | AgentFileChangeEvent | AgentStallWarningEvent;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STALL_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Pure core: state reducer
// ---------------------------------------------------------------------------

export function createInitialState(startedAt: string): AgentSessionState {
  return {
    status: "spawning",
    filesChanged: 0,
    startedAt,
  };
}

export function isTerminalStatus(status: AgentSessionStatus): boolean {
  return status === "completed" || status === "aborted" || status === "error";
}

export function reduceAgentSessionEvent(
  state: AgentSessionState,
  event: AgentEvent,
): AgentSessionState {
  const now = new Date().toISOString();

  switch (event.type) {
    case "agent_status":
      return {
        ...state,
        status: event.status,
        lastEventAt: now,
        stallWarning: undefined,
        error: event.error,
      };

    case "agent_file_change":
      return {
        ...state,
        filesChanged: state.filesChanged + 1,
        lastEventAt: now,
        stallWarning: undefined,
      };

    case "agent_stall_warning":
      return {
        ...state,
        lastEventAt: now,
        stallWarning: {
          lastEventAt: event.lastEventAt,
          stallDurationSeconds: event.stallDurationSeconds,
        },
      };
  }
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export type UseAgentSessionReturn = {
  state: AgentSessionState;
  close: () => void;
};

// ---------------------------------------------------------------------------
// Hook: effect boundary (EventSource lifecycle + stall timer)
// ---------------------------------------------------------------------------

export function useAgentSession(
  streamUrl: string | undefined,
  startedAt: string,
): UseAgentSessionReturn {
  const [state, setState] = useState<AgentSessionState>(() =>
    createInitialState(startedAt),
  );
  const eventSourceRef = useRef<EventSource | undefined>(undefined);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const resetStallTimer = useCallback(() => {
    if (stallTimerRef.current !== undefined) {
      clearTimeout(stallTimerRef.current);
    }
    stallTimerRef.current = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        stallWarning: {
          lastEventAt: prev.lastEventAt ?? prev.startedAt,
          stallDurationSeconds: STALL_TIMEOUT_MS / 1000,
        },
      }));
    }, STALL_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    if (!streamUrl) return;

    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    function handleEvent(eventType: string, rawData: string) {
      try {
        const data = JSON.parse(rawData);
        const event: AgentEvent = { ...data, type: eventType };
        setState((prev) => reduceAgentSessionEvent(prev, event));
        resetStallTimer();

        // Close on terminal status
        if (eventType === "agent_status" && isTerminalStatus(data.status)) {
          eventSource.close();
          if (stallTimerRef.current !== undefined) {
            clearTimeout(stallTimerRef.current);
          }
        }
      } catch {
        // Malformed event data -- ignore
      }
    }

    eventSource.addEventListener("agent_status", (e) =>
      handleEvent("agent_status", e.data),
    );
    eventSource.addEventListener("agent_file_change", (e) =>
      handleEvent("agent_file_change", e.data),
    );
    eventSource.addEventListener("agent_stall_warning", (e) =>
      handleEvent("agent_stall_warning", e.data),
    );

    eventSource.onerror = () => {
      setState((prev) => ({
        ...prev,
        connectionError: "Connection lost, retrying...",
      }));
    };

    // Start stall timer
    resetStallTimer();

    return () => {
      eventSource.close();
      eventSourceRef.current = undefined;
      if (stallTimerRef.current !== undefined) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = undefined;
      }
    };
  }, [streamUrl, resetStallTimer]);

  const close = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = undefined;
    }
    if (stallTimerRef.current !== undefined) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = undefined;
    }
  }, []);

  return { state, close };
}
