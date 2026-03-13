import { useState, useCallback } from "react";
import type { LearningSummary } from "../../../shared/contracts";
import { canSubmitApproval, buildApprovePayload } from "./dialog-logic";

type ApproveDialogProps = {
  learning: LearningSummary;
  onConfirm: (learningId: string, editedText?: string) => void;
  onCancel: () => void;
  isSubmitting: boolean;
};

export function ApproveDialog({ learning, onConfirm, onCancel, isSubmitting }: ApproveDialogProps) {
  const [editedText, setEditedText] = useState(learning.text);

  const handleConfirm = useCallback(() => {
    const payload = buildApprovePayload(learning.id, learning.text, editedText);
    onConfirm(payload.learningId, payload.editedText);
  }, [learning.id, learning.text, editedText, onConfirm]);

  const isValid = canSubmitApproval(editedText);

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog dialog--approve" onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog__title">Approve Learning</h3>

        <label className="dialog__label" htmlFor="approve-text">
          Learning text (optional edit)
        </label>
        <textarea
          id="approve-text"
          className="dialog__textarea"
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          rows={4}
          disabled={isSubmitting}
        />

        {learning.patternConfidence !== undefined && learning.patternConfidence < 0.7 && (
          <div className="dialog__warning">
            Low confidence ({Math.round(learning.patternConfidence * 100)}%) -- review text carefully before approving.
          </div>
        )}

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
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? "Approving..." : "Approve as Active"}
          </button>
        </div>
      </div>
    </div>
  );
}
