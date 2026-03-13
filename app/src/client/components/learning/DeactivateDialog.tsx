import { useCallback } from "react";
import type { LearningSummary } from "../../../shared/contracts";
import { resolveAgentLabels } from "./learning-card-logic";

type DeactivateDialogProps = {
  learning: LearningSummary;
  onConfirm: (learningId: string) => void;
  onCancel: () => void;
  isSubmitting: boolean;
};

export function DeactivateDialog({ learning, onConfirm, onCancel, isSubmitting }: DeactivateDialogProps) {
  const affectedAgents = resolveAgentLabels(learning.targetAgents);

  const handleConfirm = useCallback(() => {
    onConfirm(learning.id);
  }, [learning.id, onConfirm]);

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog dialog--deactivate" onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog__title">Deactivate Learning</h3>

        <p className="dialog__description">
          Are you sure you want to deactivate this learning?
        </p>

        <blockquote className="dialog__quote">
          {learning.text}
        </blockquote>

        <p className="dialog__affected-agents">
          Affected agents: {affectedAgents.join(", ")}
        </p>

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
            className="dialog__btn dialog__btn--confirm dialog__btn--destructive"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Deactivating..." : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}
