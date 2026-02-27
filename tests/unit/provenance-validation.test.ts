import { describe, expect, it } from "bun:test";
import { resolveValidatedResolvedFromMessageId } from "../../app/src/server/extraction/provenance";

describe("resolved-from provenance validation", () => {
  it("returns undefined when lineage id is omitted", () => {
    const result = resolveValidatedResolvedFromMessageId({
      sourceKind: "message",
      sourceMessageId: "msg-current",
      extractionHistoryMessageIds: new Set(["msg-a", "msg-b"]),
    });

    expect(result).toBeUndefined();
  });

  it("accepts a lineage id that exists in extraction history", () => {
    const result = resolveValidatedResolvedFromMessageId({
      resolvedFromMessageId: "msg-a",
      sourceKind: "message",
      sourceMessageId: "msg-current",
      extractionHistoryMessageIds: new Set(["msg-a", "msg-b"]),
    });

    expect(result).toBe("msg-a");
  });

  it("rejects lineage ids that are not in extraction history", () => {
    expect(() =>
      resolveValidatedResolvedFromMessageId({
        resolvedFromMessageId: "msg-x",
        sourceKind: "message",
        sourceMessageId: "msg-current",
        extractionHistoryMessageIds: new Set(["msg-a", "msg-b"]),
      }),
    ).toThrow("resolvedFromMessageId is not present in extraction conversation history");
  });

  it("rejects lineage ids that match the current message", () => {
    expect(() =>
      resolveValidatedResolvedFromMessageId({
        resolvedFromMessageId: "msg-current",
        sourceKind: "message",
        sourceMessageId: "msg-current",
        extractionHistoryMessageIds: new Set(["msg-current", "msg-a"]),
      }),
    ).toThrow("resolvedFromMessageId cannot match the current source message id");
  });

  it("rejects lineage ids for non-message extraction sources", () => {
    expect(() =>
      resolveValidatedResolvedFromMessageId({
        resolvedFromMessageId: "msg-a",
        sourceKind: "document_chunk",
        sourceMessageId: undefined,
        extractionHistoryMessageIds: new Set(["msg-a"]),
      }),
    ).toThrow("resolvedFromMessageId is only valid for message extraction sources");
  });
});
