/**
 * Shared test factory for LearningSummary objects.
 *
 * Centralizes the test data construction pattern used across
 * learning-library unit test suites.
 */
import type { LearningSummary } from "../../../app/src/shared/contracts";

export function makeLearning(overrides: Partial<LearningSummary> = {}): LearningSummary {
  return {
    id: "learning-1",
    text: "Always use Result types for errors",
    learningType: "constraint",
    status: "active",
    source: "human",
    priority: "medium",
    targetAgents: ["chat_agent"],
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}
