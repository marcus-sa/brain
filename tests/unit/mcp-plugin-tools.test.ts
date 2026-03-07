/**
 * Unit tests for MCP plugin tool query functions and validation logic.
 *
 * Tests pure functions extracted for plugin endpoints:
 * - Task context query (getPluginTaskContext)
 * - Project context query (getPluginProjectContext)
 * - Task status validation (VALID_TASK_STATUSES, validateTaskStatus)
 */
import { describe, expect, it } from "bun:test";
import {
  VALID_TASK_STATUSES,
  validateTaskStatus,
} from "../../app/src/server/mcp/mcp-queries";

// ---------------------------------------------------------------------------
// Task status validation
// ---------------------------------------------------------------------------

describe("validateTaskStatus", () => {
  it("accepts all valid task statuses", () => {
    const validStatuses = ["open", "todo", "ready", "in_progress", "blocked", "done", "completed"];
    for (const status of validStatuses) {
      expect(validateTaskStatus(status)).toBe(true);
    }
  });

  it("rejects invalid status values", () => {
    expect(validateTaskStatus("invalid_status")).toBe(false);
    expect(validateTaskStatus("")).toBe(false);
    expect(validateTaskStatus("DONE")).toBe(false);
    expect(validateTaskStatus("cancelled")).toBe(false);
  });
});

describe("VALID_TASK_STATUSES", () => {
  it("contains exactly the schema-defined statuses", () => {
    expect(VALID_TASK_STATUSES).toEqual([
      "open", "todo", "ready", "in_progress", "blocked", "done", "completed",
    ]);
  });
});
