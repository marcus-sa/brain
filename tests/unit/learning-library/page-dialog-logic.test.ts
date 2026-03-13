import { describe, expect, test } from "bun:test";
import {
  type DialogState,
  resolveDialogFromCardAction,
  closeDialog,
} from "../../../app/src/client/components/learning/page-dialog-logic";
import type { LearningSummary } from "../../../app/src/shared/contracts";

const makeLearning = (overrides: Partial<LearningSummary> = {}): LearningSummary => ({
  id: "learning-1",
  text: "Always use Result types for errors",
  learningType: "constraint",
  status: "pending_approval",
  priority: "medium",
  source: "agent",
  targetAgents: ["coding"],
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("resolveDialogFromCardAction", () => {
  test("approve action opens approve dialog with learning", () => {
    const learning = makeLearning();
    const result = resolveDialogFromCardAction(
      { action: "approve", learningId: learning.id },
      [learning],
    );
    expect(result).toEqual({ type: "approve", learning });
  });

  test("dismiss action opens dismiss dialog with learning", () => {
    const learning = makeLearning();
    const result = resolveDialogFromCardAction(
      { action: "dismiss", learningId: learning.id },
      [learning],
    );
    expect(result).toEqual({ type: "dismiss", learning });
  });

  test("returns undefined when learning not found in list", () => {
    const result = resolveDialogFromCardAction(
      { action: "approve", learningId: "nonexistent" },
      [makeLearning()],
    );
    expect(result).toBeUndefined();
  });

  test("edit action opens edit dialog with learning", () => {
    const learning = makeLearning({ status: "active" });
    const result = resolveDialogFromCardAction(
      { action: "edit", learningId: learning.id },
      [learning],
    );
    expect(result).toEqual({ type: "edit", learning });
  });

  test("deactivate action opens deactivate dialog with learning", () => {
    const learning = makeLearning({ status: "active" });
    const result = resolveDialogFromCardAction(
      { action: "deactivate", learningId: learning.id },
      [learning],
    );
    expect(result).toEqual({ type: "deactivate", learning });
  });

  test("returns undefined for unknown action", () => {
    const learning = makeLearning();
    const result = resolveDialogFromCardAction(
      { action: "unknown_action", learningId: learning.id },
      [learning],
    );
    expect(result).toBeUndefined();
  });
});

describe("closeDialog", () => {
  test("always returns undefined", () => {
    const state: DialogState = { type: "approve", learning: makeLearning() };
    expect(closeDialog(state)).toBeUndefined();
  });

  test("returns undefined when already closed", () => {
    expect(closeDialog(undefined)).toBeUndefined();
  });
});
