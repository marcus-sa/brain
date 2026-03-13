import { useState, useCallback } from "react";
import {
  LEARNING_TYPES,
  KNOWN_LEARNING_TARGET_AGENTS,
  ENTITY_PRIORITIES,
} from "../../../shared/contracts";
import type { CreateLearningData } from "../../hooks/use-learning-actions";
import {
  canSubmitCreate,
  buildCreatePayload,
  INITIAL_CREATE_FORM,
  type CreateFormState,
} from "./create-dialog-logic";

type CollisionResult = {
  id: string;
  text: string;
  similarity: number;
};

type CreateDialogProps = {
  onConfirm: (data: CreateLearningData) => Promise<string | undefined>;
  onCancel: () => void;
  isSubmitting: boolean;
};

export function CreateDialog({ onConfirm, onCancel, isSubmitting }: CreateDialogProps) {
  const [form, setForm] = useState<CreateFormState>(INITIAL_CREATE_FORM);
  const [collisions, setCollisions] = useState<CollisionResult[]>([]);
  const [phase, setPhase] = useState<"form" | "collisions">("form");

  const updateField = useCallback(
    <K extends keyof CreateFormState>(field: K, value: CreateFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const toggleAgent = useCallback((agentValue: string) => {
    setForm((prev) => {
      const isSelected = prev.selectedAgents.includes(agentValue);
      const selectedAgents = isSelected
        ? prev.selectedAgents.filter((a) => a !== agentValue)
        : [...prev.selectedAgents, agentValue];
      return { ...prev, selectedAgents };
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    const payload = buildCreatePayload(form);
    const result = await onConfirm(payload);
    if (result) {
      setCollisions([]);
      setPhase("form");
    }
  }, [form, onConfirm]);

  const isValid = canSubmitCreate(form.text, form.learningType);

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog dialog--create" onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog__title">Create Learning</h3>

        {phase === "collisions" && collisions.length > 0 && (
          <div className="dialog__collisions">
            <p className="dialog__collision-heading">Similar learnings found:</p>
            {collisions.map((collision) => (
              <div key={collision.id} className="dialog__collision-item">
                <span className="dialog__collision-text">{collision.text}</span>
                <span className="dialog__collision-score">
                  {Math.round(collision.similarity * 100)}% match
                </span>
              </div>
            ))}
            <div className="dialog__actions">
              <button
                type="button"
                className="dialog__btn dialog__btn--cancel"
                onClick={() => setPhase("form")}
                disabled={isSubmitting}
              >
                Go Back
              </button>
              <button
                type="button"
                className="dialog__btn dialog__btn--confirm"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create Anyway"}
              </button>
            </div>
          </div>
        )}

        {phase === "form" && (
          <>
            <label className="dialog__label" htmlFor="create-text">
              Learning text (required)
            </label>
            <textarea
              id="create-text"
              className="dialog__textarea"
              value={form.text}
              onChange={(e) => updateField("text", e.target.value)}
              placeholder="Describe the learning rule or constraint..."
              rows={4}
              disabled={isSubmitting}
            />

            <label className="dialog__label" htmlFor="create-type">
              Type (required)
            </label>
            <select
              id="create-type"
              className="dialog__select"
              value={form.learningType}
              onChange={(e) => updateField("learningType", e.target.value as CreateFormState["learningType"])}
              disabled={isSubmitting}
            >
              <option value="">Select type...</option>
              {LEARNING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>

            <label className="dialog__label" htmlFor="create-priority">
              Priority
            </label>
            <select
              id="create-priority"
              className="dialog__select"
              value={form.priority}
              onChange={(e) => updateField("priority", e.target.value as CreateFormState["priority"])}
              disabled={isSubmitting}
            >
              {ENTITY_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>

            <fieldset className="dialog__fieldset">
              <legend className="dialog__legend">Target Agents</legend>

              <label className="dialog__checkbox-label">
                <input
                  type="checkbox"
                  checked={form.targetAllAgents}
                  onChange={(e) => updateField("targetAllAgents", e.target.checked)}
                  disabled={isSubmitting}
                />
                All agents
              </label>

              {!form.targetAllAgents && (
                <div className="dialog__agent-list">
                  {KNOWN_LEARNING_TARGET_AGENTS.map((agent) => (
                    <label key={agent.value} className="dialog__checkbox-label">
                      <input
                        type="checkbox"
                        checked={form.selectedAgents.includes(agent.value)}
                        onChange={() => toggleAgent(agent.value)}
                        disabled={isSubmitting}
                      />
                      {agent.label}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <div className="dialog__actions">
              <button
                type="button"
                className="dialog__btn dialog__btn--cancel"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="dialog__btn dialog__btn--confirm"
                onClick={handleSubmit}
                disabled={!isValid || isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create Learning"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
