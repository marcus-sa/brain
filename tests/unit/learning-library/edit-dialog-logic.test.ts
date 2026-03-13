/**
 * Unit tests for EditDialog pure logic.
 *
 * Tests validation, dirty-checking, and payload construction
 * for the edit learning dialog.
 */
import { describe, expect, test } from "bun:test";
import {
  type EditFormState,
  buildEditFormState,
  canSubmitEdit,
  computeEditChanges,
  buildEditPayload,
} from "../../../app/src/client/components/learning/edit-dialog-logic";
import type { LearningSummary } from "../../../app/src/shared/contracts";

const makeLearning = (overrides: Partial<LearningSummary> = {}): LearningSummary => ({
  id: "learning-1",
  text: "Always use Result types for errors",
  learningType: "constraint",
  status: "active",
  priority: "medium",
  source: "human",
  targetAgents: ["chat_agent"],
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("buildEditFormState", () => {
  test("populates form from learning summary", () => {
    const learning = makeLearning({
      text: "Use strict mode",
      priority: "high",
      targetAgents: ["chat_agent", "pm_agent"],
    });
    const form = buildEditFormState(learning);
    expect(form.text).toBe("Use strict mode");
    expect(form.priority).toBe("high");
    expect(form.targetAllAgents).toBe(false);
    expect(form.selectedAgents).toEqual(["chat_agent", "pm_agent"]);
  });

  test("sets targetAllAgents true when targetAgents is empty", () => {
    const learning = makeLearning({ targetAgents: [] });
    const form = buildEditFormState(learning);
    expect(form.targetAllAgents).toBe(true);
    expect(form.selectedAgents).toEqual([]);
  });
});

describe("canSubmitEdit", () => {
  test("returns false when text is empty", () => {
    expect(canSubmitEdit("", "medium")).toBe(false);
  });

  test("returns false when text is whitespace only", () => {
    expect(canSubmitEdit("   ", "medium")).toBe(false);
  });

  test("returns true when text is non-empty", () => {
    expect(canSubmitEdit("Some rule", "medium")).toBe(true);
  });
});

describe("computeEditChanges", () => {
  test("returns empty object when nothing changed", () => {
    const learning = makeLearning();
    const form = buildEditFormState(learning);
    const changes = computeEditChanges(learning, form);
    expect(changes).toEqual({});
  });

  test("includes text when it changed", () => {
    const learning = makeLearning({ text: "Original" });
    const form = buildEditFormState(learning);
    form.text = "Updated text";
    const changes = computeEditChanges(learning, form);
    expect(changes.text).toBe("Updated text");
    expect(changes.priority).toBeUndefined();
    expect(changes.target_agents).toBeUndefined();
  });

  test("includes priority when it changed", () => {
    const learning = makeLearning({ priority: "medium" });
    const form = buildEditFormState(learning);
    form.priority = "high";
    const changes = computeEditChanges(learning, form);
    expect(changes.priority).toBe("high");
    expect(changes.text).toBeUndefined();
  });

  test("includes target_agents when they changed", () => {
    const learning = makeLearning({ targetAgents: ["chat_agent"] });
    const form = buildEditFormState(learning);
    form.selectedAgents = ["chat_agent", "pm_agent"];
    const changes = computeEditChanges(learning, form);
    expect(changes.target_agents).toEqual(["chat_agent", "pm_agent"]);
  });

  test("includes target_agents as empty array when switching to all agents", () => {
    const learning = makeLearning({ targetAgents: ["chat_agent"] });
    const form = buildEditFormState(learning);
    form.targetAllAgents = true;
    form.selectedAgents = [];
    const changes = computeEditChanges(learning, form);
    expect(changes.target_agents).toEqual([]);
  });

  test("trims text whitespace in changes", () => {
    const learning = makeLearning({ text: "Original" });
    const form = buildEditFormState(learning);
    form.text = "  Updated text  ";
    const changes = computeEditChanges(learning, form);
    expect(changes.text).toBe("Updated text");
  });
});

describe("buildEditPayload", () => {
  test("returns undefined when no changes detected", () => {
    const learning = makeLearning();
    const form = buildEditFormState(learning);
    const payload = buildEditPayload(learning, form);
    expect(payload).toBeUndefined();
  });

  test("returns edit data when changes exist", () => {
    const learning = makeLearning({ text: "Original" });
    const form = buildEditFormState(learning);
    form.text = "Updated";
    form.priority = "high";
    const payload = buildEditPayload(learning, form);
    expect(payload).toEqual({ text: "Updated", priority: "high" });
  });
});
