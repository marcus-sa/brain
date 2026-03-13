/**
 * Pure functions driving the EditDialog component.
 *
 * All validation, dirty-checking, and payload construction
 * lives here -- no React imports, no side effects, fully testable.
 */
import type { EntityPriority, LearningSummary } from "../../../shared/contracts";
import type { EditLearningData } from "../../hooks/use-learning-actions";

export type EditFormState = {
  text: string;
  priority: EntityPriority;
  targetAllAgents: boolean;
  selectedAgents: string[];
};

/** Build initial form state from an existing learning. */
export function buildEditFormState(learning: LearningSummary): EditFormState {
  const targetAllAgents = learning.targetAgents.length === 0;
  return {
    text: learning.text,
    priority: learning.priority,
    targetAllAgents,
    selectedAgents: [...learning.targetAgents],
  };
}

/** Whether the edit form is ready to submit. Text must be non-empty. */
export function canSubmitEdit(text: string, _priority: string): boolean {
  return text.trim().length > 0;
}

/** Resolve target agents from form state. Empty array means "all agents". */
function resolveTargetAgents(form: EditFormState): string[] {
  return form.targetAllAgents ? [] : form.selectedAgents;
}

/** Compute only the fields that changed between the original learning and the form. */
export function computeEditChanges(
  learning: LearningSummary,
  form: EditFormState,
): EditLearningData {
  const changes: EditLearningData = {};
  const trimmedText = form.text.trim();

  if (trimmedText !== learning.text.trim()) {
    changes.text = trimmedText;
  }

  if (form.priority !== learning.priority) {
    changes.priority = form.priority;
  }

  const resolvedAgents = resolveTargetAgents(form);
  const originalSorted = [...learning.targetAgents].sort();
  const newSorted = [...resolvedAgents].sort();
  if (JSON.stringify(originalSorted) !== JSON.stringify(newSorted)) {
    changes.target_agents = resolvedAgents;
  }

  return changes;
}

/** Build the edit payload. Returns undefined when nothing changed. */
export function buildEditPayload(
  learning: LearningSummary,
  form: EditFormState,
): EditLearningData | undefined {
  const changes = computeEditChanges(learning, form);
  const hasChanges = Object.keys(changes).length > 0;
  return hasChanges ? changes : undefined;
}
