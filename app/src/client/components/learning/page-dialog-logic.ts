/**
 * Pure functions for dialog state management on the Learnings page.
 *
 * Maps card action events to dialog state transitions.
 * No React imports, no side effects, fully testable.
 */
import type { LearningSummary } from "../../../shared/contracts";
import type { LearningCardAction } from "./LearningCard";

export type DialogState =
  | { type: "create" }
  | { type: "approve"; learning: LearningSummary }
  | { type: "dismiss"; learning: LearningSummary };

const DIALOG_ACTIONS = new Set(["approve", "dismiss"]);

/** Resolve a card action into the appropriate dialog state, or undefined if not applicable. */
export function resolveDialogFromCardAction(
  cardAction: LearningCardAction,
  learnings: LearningSummary[],
): DialogState | undefined {
  if (!DIALOG_ACTIONS.has(cardAction.action)) return undefined;

  const learning = learnings.find((l) => l.id === cardAction.learningId);
  if (!learning) return undefined;

  return { type: cardAction.action as "approve" | "dismiss", learning };
}

/** Close any open dialog. Always returns undefined. */
export function closeDialog(_current?: DialogState): undefined {
  return undefined;
}
