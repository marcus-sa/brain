/**
 * Unit tests for StatusTabs pure logic.
 *
 * Tests the tab configuration, label mapping, and count computation
 * that drive the StatusTabs component.
 */
import { describe, expect, it } from "bun:test";
import {
  STATUS_TAB_DEFINITIONS,
  computeStatusCounts,
  type StatusTabDefinition,
} from "../../../app/src/client/components/learning/StatusTabs";
import type { LearningSummary } from "../../../app/src/shared/contracts";

describe("STATUS_TAB_DEFINITIONS", () => {
  it("defines exactly four tabs", () => {
    expect(STATUS_TAB_DEFINITIONS).toHaveLength(4);
  });

  it("includes Active, Pending, Dismissed, and Deactivated tabs", () => {
    const labels = STATUS_TAB_DEFINITIONS.map((tab: StatusTabDefinition) => tab.label);
    expect(labels).toEqual(["Active", "Pending", "Dismissed", "Deactivated"]);
  });

  it("maps to the correct learning statuses", () => {
    const statuses = STATUS_TAB_DEFINITIONS.map((tab: StatusTabDefinition) => tab.status);
    expect(statuses).toEqual(["active", "pending_approval", "dismissed", "deactivated"]);
  });

  it("has Active as the first tab (default selection)", () => {
    expect(STATUS_TAB_DEFINITIONS[0].status).toBe("active");
    expect(STATUS_TAB_DEFINITIONS[0].label).toBe("Active");
  });
});

describe("computeStatusCounts", () => {
  const makeLearning = (status: LearningSummary["status"]): LearningSummary => ({
    id: crypto.randomUUID(),
    text: "test learning",
    learningType: "instruction",
    status,
    source: "human",
    priority: "medium",
    targetAgents: ["chat_agent"],
    createdAt: new Date().toISOString(),
  });

  it("returns zero counts for all statuses when learnings list is empty", () => {
    const counts = computeStatusCounts([]);
    expect(counts.active).toBe(0);
    expect(counts.pending_approval).toBe(0);
    expect(counts.dismissed).toBe(0);
    expect(counts.deactivated).toBe(0);
  });

  it("counts learnings by their status", () => {
    const learnings = [
      makeLearning("active"),
      makeLearning("active"),
      makeLearning("pending_approval"),
      makeLearning("dismissed"),
    ];
    const counts = computeStatusCounts(learnings);
    expect(counts.active).toBe(2);
    expect(counts.pending_approval).toBe(1);
    expect(counts.dismissed).toBe(1);
    expect(counts.deactivated).toBe(0);
  });

  it("ignores superseded status (not a tab)", () => {
    const learnings = [
      makeLearning("active"),
      makeLearning("superseded"),
    ];
    const counts = computeStatusCounts(learnings);
    expect(counts.active).toBe(1);
    expect(counts.pending_approval).toBe(0);
    expect(counts.dismissed).toBe(0);
    expect(counts.deactivated).toBe(0);
  });
});
