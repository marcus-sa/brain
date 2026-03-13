/**
 * Pure functions driving the CreateDialog component.
 *
 * All validation, payload construction, and agent targeting logic
 * lives here -- no React imports, no side effects, fully testable.
 */
import type { LearningType, EntityPriority } from "../../../shared/contracts";
import type { CreateLearningData } from "../../hooks/use-learning-actions";

export type CreateFormState = {
  text: string;
  learningType: LearningType | "";
  priority: EntityPriority;
  targetAllAgents: boolean;
  selectedAgents: string[];
};

export const INITIAL_CREATE_FORM: CreateFormState = {
  text: "",
  learningType: "",
  priority: "medium",
  targetAllAgents: true,
  selectedAgents: [],
};

/** Whether the create form is ready to submit. Text and type are required. */
export function canSubmitCreate(text: string, learningType: string): boolean {
  return text.trim().length > 0 && learningType.length > 0;
}

/** Resolve target agents: empty array means "all agents". */
export function resolveTargetAgents(targetAllAgents: boolean, selectedAgents: string[]): string[] {
  return targetAllAgents ? [] : selectedAgents;
}

/** Build the create action payload from form state. */
export function buildCreatePayload(form: CreateFormState): CreateLearningData {
  return {
    text: form.text.trim(),
    learning_type: form.learningType as LearningType,
    priority: form.priority,
    target_agents: resolveTargetAgents(form.targetAllAgents, form.selectedAgents),
  };
}
