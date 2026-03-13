import { useState, useCallback } from "react";
import type { LearningSummary } from "../../../shared/contracts";
import { canSubmitDismissal, buildDismissPayload } from "./dialog-logic";

type DismissDialogProps = {
  learning: LearningSummary;
  onConfirm: (learningId: string, reason: string) => void;
  onCancel: () => void;
  isSubmitting: boolean;
};

export function DismissDialog({ learning, onConfirm, onCancel, isSubmitting }: DismissDialogProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = useCallback(() => {
    const payload = buildDismissPayload(learning.id, reason);
    onConfirm(payload.learningId, payload.reason);
  }, [learning.id, reason, onConfirm]);

  const isValid = canSubmitDismissal(reason);

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog dialog--dismiss" onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog__title">Dismiss Learning</h3>

        <p className="dialog__description">
          {learning.text}
        </p>

        <label className="dialog__label" htmlFor="dismiss-reason">
          Reason for dismissal (required)
        </label>
        <textarea
          id="dismiss-reason"
          className="dialog__textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this learning being dismissed?"
          rows={3}
          disabled={isSubmitting}
        />

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
            {isSubmitting ? "Dismissing..." : "Dismiss"}
          </button>
        </div>
      </div>
    </div>
  );
}
