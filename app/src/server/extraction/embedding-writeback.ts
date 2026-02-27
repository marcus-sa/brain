import { embed } from "ai";
import { type RecordId, type Surreal } from "surrealdb";
import { elapsedMs, logError, logInfo, logWarn } from "../http/observability";
import type { GraphEntityRecord } from "./types";

export async function persistEmbeddings(input: {
  surreal: Surreal;
  embeddingModel: any;
  embeddingDimension: number;
  assistantMessageRecord: RecordId<"message", string>;
  assistantText: string;
  entities: Array<{ record: GraphEntityRecord; text: string }>;
}): Promise<void> {
  const startedAt = performance.now();
  logInfo("embedding.persist.started", "Embedding persistence started", {
    messageId: input.assistantMessageRecord.id as string,
    entityCount: input.entities.length,
  });

  try {
    const messageEmbedding = await createEmbedding(input.embeddingModel, input.embeddingDimension, input.assistantText);
    if (messageEmbedding) {
      const [assistantResult] = await input.surreal
        .query<[unknown]>(
          "UPDATE $record MERGE $patch RETURN AFTER;",
          {
            record: input.assistantMessageRecord,
            patch: { embedding: messageEmbedding },
          },
        )
        .collect<[unknown]>();

      const assistantRows = Array.isArray(assistantResult) ? assistantResult : [assistantResult];
      if (assistantRows.length !== 1 || typeof assistantRows[0] !== "object" || !assistantRows[0]) {
        throw new Error("assistant message embedding update did not return a record");
      }

      const assistantRecord = assistantRows[0] as { id?: RecordId<"message", string> };
      if (!assistantRecord.id) {
        throw new Error("assistant message embedding update did not include id");
      }
    }

    let embeddedEntityCount = 0;
    for (const entity of input.entities) {
      const entityEmbedding = await createEmbedding(input.embeddingModel, input.embeddingDimension, entity.text);
      if (!entityEmbedding) {
        continue;
      }

      const [entityResult] = await input.surreal
        .query<[unknown]>(
          "UPDATE $record MERGE $patch RETURN AFTER;",
          {
            record: entity.record,
            patch: { embedding: entityEmbedding },
          },
        )
        .collect<[unknown]>();

      const entityRows = Array.isArray(entityResult) ? entityResult : [entityResult];
      if (entityRows.length !== 1 || typeof entityRows[0] !== "object" || !entityRows[0]) {
        throw new Error(
          `entity embedding update did not return a record for ${entity.record.tb}:${entity.record.id as string}`,
        );
      }

      const entityRecord = entityRows[0] as { id?: GraphEntityRecord };
      if (!entityRecord.id) {
        throw new Error(
          `entity embedding update did not include id for ${entity.record.tb}:${entity.record.id as string}`,
        );
      }

      embeddedEntityCount += 1;
    }

    logInfo("embedding.persist.completed", "Embedding persistence completed", {
      messageId: input.assistantMessageRecord.id as string,
      entityCount: input.entities.length,
      embeddedEntityCount,
      durationMs: elapsedMs(startedAt),
    });
  } catch (error) {
    logError("embedding.persist.failed", "Embedding persistence failed", error, {
      messageId: input.assistantMessageRecord.id as string,
      entityCount: input.entities.length,
      durationMs: elapsedMs(startedAt),
    });
    throw error;
  }
}

export async function createEmbedding(
  embeddingModel: any,
  embeddingDimension: number,
  value: string,
): Promise<number[] | undefined> {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return undefined;
  }

  const result = await embed({
    model: embeddingModel,
    value: normalized,
  });

  if (result.embedding.length !== embeddingDimension) {
    logWarn("embedding.dimension_mismatch", "Skipping embedding write due to vector dimension mismatch", {
      actualDimension: result.embedding.length,
      configuredDimension: embeddingDimension,
    });
    return undefined;
  }

  return result.embedding;
}
