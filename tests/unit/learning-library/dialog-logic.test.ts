/**
 * Unit tests for ApproveDialog and DismissDialog pure logic.
 *
 * Tests validation, payload construction, and form readiness
 * for the learning approval and dismissal dialogs.
 */
import { describe, expect, it } from "bun:test";
import {
  canSubmitApproval,
  hasTextChanged,
  buildApprovePayload,
  canSubmitDismissal,
  buildDismissPayload,
} from "../../../app/src/client/components/learning/dialog-logic";

// --- canSubmitApproval ---

describe("canSubmitApproval", () => {
  it("returns true when edited text is non-empty", () => {
    expect(canSubmitApproval("Use strict TypeScript")).toBe(true);
  });

  it("returns false when edited text is empty", () => {
    expect(canSubmitApproval("")).toBe(false);
  });

  it("returns false when edited text is only whitespace", () => {
    expect(canSubmitApproval("   ")).toBe(false);
  });
});

// --- hasTextChanged ---

describe("hasTextChanged", () => {
  it("returns false when text is identical", () => {
    expect(hasTextChanged("original", "original")).toBe(false);
  });

  it("returns true when text differs", () => {
    expect(hasTextChanged("original", "edited version")).toBe(true);
  });

  it("ignores leading and trailing whitespace differences", () => {
    expect(hasTextChanged("  original  ", "original")).toBe(false);
  });
});

// --- buildApprovePayload ---

describe("buildApprovePayload", () => {
  it("includes editedText when text changed", () => {
    const payload = buildApprovePayload("learn-1", "original", "new text");
    expect(payload).toEqual({ learningId: "learn-1", editedText: "new text" });
  });

  it("omits editedText when text is unchanged", () => {
    const payload = buildApprovePayload("learn-1", "same text", "same text");
    expect(payload).toEqual({ learningId: "learn-1" });
    expect("editedText" in payload).toBe(false);
  });

  it("trims edited text in the payload", () => {
    const payload = buildApprovePayload("learn-1", "original", "  new text  ");
    expect(payload.editedText).toBe("new text");
  });
});

// --- canSubmitDismissal ---

describe("canSubmitDismissal", () => {
  it("returns true when reason is non-empty", () => {
    expect(canSubmitDismissal("Outdated constraint")).toBe(true);
  });

  it("returns false when reason is empty", () => {
    expect(canSubmitDismissal("")).toBe(false);
  });

  it("returns false when reason is only whitespace", () => {
    expect(canSubmitDismissal("  \n  ")).toBe(false);
  });
});

// --- buildDismissPayload ---

describe("buildDismissPayload", () => {
  it("returns learningId and trimmed reason", () => {
    const payload = buildDismissPayload("learn-2", "  No longer relevant  ");
    expect(payload).toEqual({
      learningId: "learn-2",
      reason: "No longer relevant",
    });
  });
});
