import { useCallback, useEffect, useReducer } from "react";
import {
  getSessionReview,
  acceptSession,
  rejectSession,
  type SessionReviewResponse,
  type AcceptSessionResponse,
  type RejectSessionResponse,
} from "../graph/orchestrator-api";

// ---------------------------------------------------------------------------
// State Machine (pure, testable)
// ---------------------------------------------------------------------------

export type AsyncStatus = "idle" | "pending" | "success" | "error";

export type ReviewState = {
  fetchStatus: AsyncStatus;
  reviewData?: SessionReviewResponse;
  fetchError?: string;
  acceptStatus: AsyncStatus;
  acceptError?: string;
  rejectStatus: AsyncStatus;
  rejectError?: string;
};

export type ReviewAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; data: SessionReviewResponse }
  | { type: "FETCH_ERROR"; error: string }
  | { type: "ACCEPT_START" }
  | { type: "ACCEPT_SUCCESS" }
  | { type: "ACCEPT_ERROR"; error: string }
  | { type: "REJECT_START" }
  | { type: "REJECT_SUCCESS" }
  | { type: "REJECT_ERROR"; error: string };

function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, fetchStatus: "pending", fetchError: undefined };
    case "FETCH_SUCCESS":
      return { ...state, fetchStatus: "success", reviewData: action.data, fetchError: undefined };
    case "FETCH_ERROR":
      return { ...state, fetchStatus: "error", fetchError: action.error, reviewData: undefined };
    case "ACCEPT_START":
      return { ...state, acceptStatus: "pending", acceptError: undefined };
    case "ACCEPT_SUCCESS":
      return { ...state, acceptStatus: "success", acceptError: undefined };
    case "ACCEPT_ERROR":
      return { ...state, acceptStatus: "error", acceptError: action.error };
    case "REJECT_START":
      return { ...state, rejectStatus: "pending", rejectError: undefined };
    case "REJECT_SUCCESS":
      return { ...state, rejectStatus: "success", rejectError: undefined };
    case "REJECT_ERROR":
      return { ...state, rejectStatus: "error", rejectError: action.error };
  }
}

const INITIAL_STATE: ReviewState = {
  fetchStatus: "idle",
  acceptStatus: "idle",
  rejectStatus: "idle",
};

/** Exported for testing -- pure state machine reducer. */
export const reduceReviewAction = reviewReducer;

/** Create a fresh initial state for testing. */
export function createInitialReviewState(): ReviewState {
  return { ...INITIAL_STATE };
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

export type UseAgentReviewReturn = {
  reviewData?: SessionReviewResponse;
  fetchStatus: AsyncStatus;
  fetchError?: string;
  acceptStatus: AsyncStatus;
  acceptError?: string;
  rejectStatus: AsyncStatus;
  rejectError?: string;
  /** True only during initial data fetch (blocks page rendering). */
  isLoading: boolean;
  /** True when an accept or reject mutation is in flight (disables action buttons). */
  isMutating: boolean;
  accept: (summary?: string) => Promise<AcceptSessionResponse | undefined>;
  reject: (feedback: string) => Promise<RejectSessionResponse | undefined>;
};

export function useAgentReview(
  workspaceId: string,
  sessionId: string,
): UseAgentReviewReturn {
  const [state, dispatch] = useReducer(reviewReducer, INITIAL_STATE);

  // Fetch review data on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchReview() {
      dispatch({ type: "FETCH_START" });
      try {
        const data = await getSessionReview(workspaceId, sessionId);
        if (!cancelled) {
          dispatch({ type: "FETCH_SUCCESS", data });
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Failed to fetch review";
          dispatch({ type: "FETCH_ERROR", error: message });
        }
      }
    }

    void fetchReview();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, sessionId]);

  const accept = useCallback(
    async (summary?: string): Promise<AcceptSessionResponse | undefined> => {
      dispatch({ type: "ACCEPT_START" });
      try {
        const result = await acceptSession(workspaceId, sessionId, summary);
        dispatch({ type: "ACCEPT_SUCCESS" });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Accept failed";
        dispatch({ type: "ACCEPT_ERROR", error: message });
        return undefined;
      }
    },
    [workspaceId, sessionId],
  );

  const reject = useCallback(
    async (feedback: string): Promise<RejectSessionResponse | undefined> => {
      dispatch({ type: "REJECT_START" });
      try {
        const result = await rejectSession(workspaceId, sessionId, feedback);
        dispatch({ type: "REJECT_SUCCESS" });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Reject failed";
        dispatch({ type: "REJECT_ERROR", error: message });
        return undefined;
      }
    },
    [workspaceId, sessionId],
  );

  const isLoading = state.fetchStatus === "pending";
  const isMutating = state.acceptStatus === "pending" || state.rejectStatus === "pending";

  return {
    reviewData: state.reviewData,
    fetchStatus: state.fetchStatus,
    fetchError: state.fetchError,
    acceptStatus: state.acceptStatus,
    acceptError: state.acceptError,
    rejectStatus: state.rejectStatus,
    rejectError: state.rejectError,
    isLoading,
    isMutating,
    accept,
    reject,
  };
}
