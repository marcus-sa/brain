/**
 * Unit tests for use-pending-learning-count hook.
 *
 * Tests the pure URL-building and count-extraction logic.
 * React state/effect/polling behavior is integration-level.
 */
import { describe, expect, it } from "bun:test";
import {
  buildPendingCountUrl,
  extractPendingCount,
} from "../../../app/src/client/hooks/use-pending-learning-count";

describe("buildPendingCountUrl", () => {
  it("builds URL with pending_approval status filter", () => {
    const url = buildPendingCountUrl("ws-123");
    expect(url).toBe("/api/workspaces/ws-123/learnings?status=pending_approval");
  });

  it("encodes workspace ID for URL safety", () => {
    const url = buildPendingCountUrl("ws with spaces");
    expect(url).toBe("/api/workspaces/ws%20with%20spaces/learnings?status=pending_approval");
  });
});

describe("extractPendingCount", () => {
  it("returns count of learnings in response", () => {
    const count = extractPendingCount({ learnings: [{}, {}, {}] });
    expect(count).toBe(3);
  });

  it("returns zero for empty learnings array", () => {
    const count = extractPendingCount({ learnings: [] });
    expect(count).toBe(0);
  });

  it("returns zero for missing learnings field", () => {
    const count = extractPendingCount({});
    expect(count).toBe(0);
  });

  it("returns zero for non-array learnings field", () => {
    const count = extractPendingCount({ learnings: "not-array" });
    expect(count).toBe(0);
  });
});
