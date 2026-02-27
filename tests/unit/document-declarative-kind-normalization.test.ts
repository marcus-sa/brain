import { describe, expect, it } from "bun:test";
import { dedupeExtractedEntities } from "../../app/src/server/extraction/filtering";
import type { ExtractionPromptEntity } from "../../app/src/server/extraction/schema";

describe("document declarative kind normalization", () => {
  it("normalizes declarative process task output to feature for document chunks", () => {
    const source = "Deduplicate features by embedding similarity and keep the more descriptive name when merged.";
    const entities: ExtractionPromptEntity[] = [
      {
        tempId: "t1",
        kind: "task",
        text: "Deduplicate features by embedding similarity",
        confidence: 0.95,
        evidence: "Deduplicate features by embedding similarity",
      },
    ];

    const output = dedupeExtractedEntities({
      entities,
      sourceText: source,
      storeThreshold: 0.6,
      sourceKind: "document_chunk",
    });
    expect(output).toHaveLength(1);
    expect(output[0]?.kind).toBe("feature");
  });

  it("normalizes architecture/tool task output to decision for document chunks", () => {
    const source = "The platform will store entities in SurrealDB for graph persistence.";
    const entities: ExtractionPromptEntity[] = [
      {
        tempId: "t1",
        kind: "task",
        text: "store entities in SurrealDB",
        confidence: 0.95,
        evidence: "store entities in SurrealDB",
      },
    ];

    const output = dedupeExtractedEntities({
      entities,
      sourceText: source,
      storeThreshold: 0.6,
      sourceKind: "document_chunk",
    });
    expect(output).toHaveLength(1);
    expect(output[0]?.kind).toBe("decision");
  });

  it("normalizes directive decision output to task for document chunks", () => {
    const source = "Extract decisions and tasks from chat transcripts.";
    const entities: ExtractionPromptEntity[] = [
      {
        tempId: "d1",
        kind: "decision",
        text: "extract decisions and tasks",
        confidence: 0.95,
        evidence: "Extract decisions and tasks",
      },
    ];

    const output = dedupeExtractedEntities({
      entities,
      sourceText: source,
      storeThreshold: 0.6,
      sourceKind: "document_chunk",
    });
    expect(output).toHaveLength(1);
    expect(output[0]?.kind).toBe("task");
  });

  it("does not apply document normalization to message source extractions", () => {
    const source = "Deduplicate features by embedding similarity and keep the more descriptive name when merged.";
    const entities: ExtractionPromptEntity[] = [
      {
        tempId: "t1",
        kind: "task",
        text: "Deduplicate features by embedding similarity",
        confidence: 0.95,
        evidence: "Deduplicate features by embedding similarity",
      },
    ];

    const output = dedupeExtractedEntities({
      entities,
      sourceText: source,
      storeThreshold: 0.6,
      sourceKind: "message",
    });
    expect(output).toHaveLength(1);
    expect(output[0]?.kind).toBe("task");
  });
});
