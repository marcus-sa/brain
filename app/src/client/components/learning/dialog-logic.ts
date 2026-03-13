/**
 * Pure functions driving ApproveDialog and DismissDialog components.
 *
 * All validation and form state logic lives here -- no React imports,
 * no side effects, fully testable.
 */

/** Whether the approve form is ready to submit. Always true since text edit is optional. */
export function canSubmitApproval(editedText: string): boolean {
  return editedText.trim().length > 0;
}

/** Whether the edited text differs from the original learning text. */
export function hasTextChanged(originalText: string, editedText: string): boolean {
  return editedText.trim() !== originalText.trim();
}

/** Build the approve action payload. Returns edited text only if it changed. */
export function buildApprovePayload(
  learningId: string,
  originalText: string,
  editedText: string,
): { learningId: string; editedText?: string } {
  const changed = hasTextChanged(originalText, editedText);
  return changed
    ? { learningId, editedText: editedText.trim() }
    : { learningId };
}

/** Whether the dismiss form is ready to submit. Reason is required. */
export function canSubmitDismissal(reason: string): boolean {
  return reason.trim().length > 0;
}

/** Build the dismiss action payload. */
export function buildDismissPayload(
  learningId: string,
  reason: string,
): { learningId: string; reason: string } {
  return { learningId, reason: reason.trim() };
}
