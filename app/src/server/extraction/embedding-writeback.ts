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
      await input.surreal.update(input.assistantMessageRecord).merge({ embedding: messageEmbedding });
    }

    let embeddedEntityCount = 0;
    for (const entity of input.entities) {
      const entityEmbedding = await createEmbedding(input.embeddingModel, input.embeddingDimension, entity.text);
      if (!entityEmbedding) {
        continue;
      }

      await input.surreal.update(entity.record).merge({ embedding: entityEmbedding });
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
