import { describe, expect, it } from "bun:test";
import { extractReferencedTaskIds } from "../../app/src/server/webhook/commit-task-refs";

describe("commit task reference parsing", () => {
  it("parses single task:<id> tokens", () => {
    const ids = extractReferencedTaskIds("task:task-20260304-123 implement oauth callback");
    expect(ids).toEqual(["task-20260304-123"]);
  });

  it("parses tasks: lists and de-duplicates with task:<id>", () => {
    const ids = extractReferencedTaskIds(
      "tasks: task-1a2b, task-9z8y task:task-1a2b follow-up cleanup",
    );
    expect(ids).toEqual(["task-1a2b", "task-9z8y"]);
  });

  it("ignores obvious non-id tokens", () => {
    const ids = extractReferencedTaskIds(
      "tasks: cleanup docs followups task:refactor",
    );
    expect(ids).toEqual([]);
  });
});
