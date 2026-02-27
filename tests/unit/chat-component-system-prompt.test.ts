import { describe, expect, it } from "bun:test";
import { chatComponentSystemPrompt } from "../../app/src/server/chat/chat-component-system-prompt";

describe("chat component system prompt", () => {
  it("includes fenced component usage instructions and catalog entries", () => {
    expect(chatComponentSystemPrompt.includes("```component")).toBe(true);
    expect(chatComponentSystemPrompt.includes("EntityCard")).toBe(true);
    expect(chatComponentSystemPrompt.includes("ExtractionSummary")).toBe(true);
  });
});
