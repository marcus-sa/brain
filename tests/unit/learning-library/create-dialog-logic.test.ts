/**
 * Unit tests for CreateDialog pure logic.
 *
 * Tests validation, payload construction, and agent targeting
 * for the learning creation dialog.
 */
import { describe, expect, it } from "bun:test";
import {
  canSubmitCreate,
  buildCreatePayload,
  resolveTargetAgents,
  type CreateFormState,
} from "../../../app/src/client/components/learning/create-dialog-logic";

// --- canSubmitCreate ---

describe("canSubmitCreate", () => {
  it("returns true when text and type are provided", () => {
    expect(canSubmitCreate("Always use strict types", "constraint")).toBe(true);
  });

  it("returns false when text is empty", () => {
    expect(canSubmitCreate("", "constraint")).toBe(false);
  });

  it("returns false when text is only whitespace", () => {
    expect(canSubmitCreate("   \n  ", "instruction")).toBe(false);
  });

  it("returns false when type is empty string", () => {
    expect(canSubmitCreate("Some learning", "" as any)).toBe(false);
  });
});

// --- resolveTargetAgents ---

describe("resolveTargetAgents", () => {
  it("returns empty array when targeting all agents", () => {
    expect(resolveTargetAgents(true, ["chat_agent", "pm_agent"])).toEqual([]);
  });

  it("returns selected agents when not targeting all", () => {
    expect(resolveTargetAgents(false, ["chat_agent", "pm_agent"])).toEqual([
      "chat_agent",
      "pm_agent",
    ]);
  });

  it("returns empty array when no agents selected and not targeting all", () => {
    expect(resolveTargetAgents(false, [])).toEqual([]);
  });
});

// --- buildCreatePayload ---

describe("buildCreatePayload", () => {
  const baseForm: CreateFormState = {
    text: "  Always use strict types  ",
    learningType: "constraint",
    priority: "medium",
    targetAllAgents: true,
    selectedAgents: [],
  };

  it("trims text in the payload", () => {
    const payload = buildCreatePayload(baseForm);
    expect(payload.text).toBe("Always use strict types");
  });

  it("maps learningType to learning_type", () => {
    const payload = buildCreatePayload(baseForm);
    expect(payload.learning_type).toBe("constraint");
  });

  it("includes priority", () => {
    const payload = buildCreatePayload(baseForm);
    expect(payload.priority).toBe("medium");
  });

  it("returns empty target_agents when targeting all agents", () => {
    const payload = buildCreatePayload(baseForm);
    expect(payload.target_agents).toEqual([]);
  });

  it("returns selected agents when not targeting all", () => {
    const form: CreateFormState = {
      ...baseForm,
      targetAllAgents: false,
      selectedAgents: ["chat_agent", "mcp"],
    };
    const payload = buildCreatePayload(form);
    expect(payload.target_agents).toEqual(["chat_agent", "mcp"]);
  });
});
