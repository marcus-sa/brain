import { useState, useCallback } from "react";
import {
  ENTITY_PRIORITIES,
  KNOWN_LEARNING_TARGET_AGENTS,
} from "../../../shared/contracts";
import type { LearningSummary } from "../../../shared/contracts";
import type { EditLearningData } from "../../hooks/use-learning-actions";
import {
  buildEditFormState,
  canSubmitEdit,
  buildEditPayload,
  type EditFormState,
} from "./edit-dialog-logic";

type EditDialogProps = {
  learning: LearningSummary;
  onConfirm: (learningId: string, data: EditLearningData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
};

export function EditDialog({ learning, onConfirm, onCancel, isSubmitting }: EditDialogProps) {
  const [form, setForm] = useState<EditFormState>(() => buildEditFormState(learning));

  const updateField = useCallback(
    <K extends keyof EditFormState>(field: K, value: EditFormState[K]) => {
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

  const handleConfirm = useCallback(() => {
    const payload = buildEditPayload(learning, form);
    if (payload) {
      onConfirm(learning.id, payload);
    }
  }, [learning, form, onConfirm]);

  const isValid = canSubmitEdit(form.text, form.priority);
  const hasChanges = buildEditPayload(learning, form) !== undefined;

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog dialog--edit" onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog__title">Edit Learning</h3>

        <label className="dialog__label" htmlFor="edit-text">
          Learning text
        </label>
        <textarea
          id="edit-text"
          className="dialog__textarea"
          value={form.text}
          onChange={(e) => updateField("text", e.target.value)}
          rows={4}
          disabled={isSubmitting}
        />

        <label className="dialog__label" htmlFor="edit-priority">
          Priority
        </label>
        <select
          id="edit-priority"
          className="dialog__select"
          value={form.priority}
          onChange={(e) => updateField("priority", e.target.value as EditFormState["priority"])}
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
            onClick={handleConfirm}
            disabled={!isValid || !hasChanges || isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
