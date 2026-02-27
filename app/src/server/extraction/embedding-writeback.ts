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
      const preUpdateSnapshot = await readRecordSnapshot(input.surreal, input.assistantMessageRecord);
      if (!preUpdateSnapshot.hasId) {
        throw new Error(
          [
            "assistant message embedding precheck failed",
            `messageId=${input.assistantMessageRecord.id as string}`,
            `expectedDimension=${messageEmbedding.length}`,
            `pre.payloadType=${preUpdateSnapshot.payloadType}`,
            `pre.recordType=${preUpdateSnapshot.recordType}`,
            `pre.embeddingType=${preUpdateSnapshot.embeddingType}`,
            `pre.vectorLength=${preUpdateSnapshot.vectorLength ?? -1}`,
            `pre.keys=${preUpdateSnapshot.keys.join(",")}`,
            `pre.select.hasId=${preUpdateSnapshot.selectHasId}`,
            `pre.select.payloadType=${preUpdateSnapshot.selectPayloadType}`,
            `pre.select.recordType=${preUpdateSnapshot.selectRecordType}`,
            `pre.select.embeddingType=${preUpdateSnapshot.selectEmbeddingType}`,
            `pre.select.vectorLength=${preUpdateSnapshot.selectVectorLength ?? -1}`,
            `pre.query.hasId=${preUpdateSnapshot.queryHasId}`,
            `pre.query.payloadType=${preUpdateSnapshot.queryPayloadType}`,
            `pre.query.recordType=${preUpdateSnapshot.queryRecordType}`,
            `pre.query.embeddingType=${preUpdateSnapshot.queryEmbeddingType}`,
            `pre.query.vectorLength=${preUpdateSnapshot.queryVectorLength ?? -1}`,
          ].join(" "),
        );
      }

      const [assistantResult] = await input.surreal
        .query<[unknown]>(
          "UPDATE $record MERGE $patch RETURN AFTER;",
          {
            record: input.assistantMessageRecord,
            patch: { embedding: messageEmbedding },
          },
        )
        .collect<[unknown]>();

      const assistantResultInspection = inspectQueryResult(assistantResult);
      if (!assistantResultInspection.hasRecordId) {
        const verification = await verifyEmbeddingPresent(
          input.surreal,
          input.assistantMessageRecord,
          messageEmbedding.length,
        );
        if (!verification.ok) {
          throw new Error(
            [
              "assistant message embedding update verification failed",
              `messageId=${input.assistantMessageRecord.id as string}`,
              `expectedDimension=${messageEmbedding.length}`,
              `pre.payloadType=${preUpdateSnapshot.payloadType}`,
              `pre.recordType=${preUpdateSnapshot.recordType}`,
              `pre.embeddingType=${preUpdateSnapshot.embeddingType}`,
              `pre.vectorLength=${preUpdateSnapshot.vectorLength ?? -1}`,
              `pre.keys=${preUpdateSnapshot.keys.join(",")}`,
              `update.hasRecordId=${assistantResultInspection.hasRecordId}`,
              `update.flattenedCount=${assistantResultInspection.flattenedCount}`,
              `update.sampleTypes=${assistantResultInspection.sampleTypes.join("|")}`,
              `update.sampleKeys=${assistantResultInspection.sampleKeys.map((keys) => keys.join(",")).join("|")}`,
              `select.hasId=${verification.selectedHasId}`,
              `select.payloadType=${verification.selectedPayloadType}`,
              `select.recordType=${verification.selectedRecordType}`,
              `select.embeddingType=${verification.embeddingType}`,
              `select.vectorLength=${verification.vectorLength ?? -1}`,
              `select.keys=${verification.selectedKeys.join(",")}`,
            ].join(" "),
          );
        }

        logWarn(
          "embedding.persist.unexpected_update_output",
          "assistant message embedding update returned no row but verification succeeded",
          {
            messageId: input.assistantMessageRecord.id as string,
            expectedDimension: messageEmbedding.length,
            prePayloadType: preUpdateSnapshot.payloadType,
            preRecordType: preUpdateSnapshot.recordType,
            preEmbeddingType: preUpdateSnapshot.embeddingType,
            preVectorLength: preUpdateSnapshot.vectorLength,
            preKeys: preUpdateSnapshot.keys,
            preSelectHasId: preUpdateSnapshot.selectHasId,
            preSelectPayloadType: preUpdateSnapshot.selectPayloadType,
            preSelectRecordType: preUpdateSnapshot.selectRecordType,
            preSelectEmbeddingType: preUpdateSnapshot.selectEmbeddingType,
            preSelectVectorLength: preUpdateSnapshot.selectVectorLength,
            preQueryHasId: preUpdateSnapshot.queryHasId,
            preQueryPayloadType: preUpdateSnapshot.queryPayloadType,
            preQueryRecordType: preUpdateSnapshot.queryRecordType,
            preQueryEmbeddingType: preUpdateSnapshot.queryEmbeddingType,
            preQueryVectorLength: preUpdateSnapshot.queryVectorLength,
            updateFlattenedCount: assistantResultInspection.flattenedCount,
            updateSampleTypes: assistantResultInspection.sampleTypes,
            updateSampleKeys: assistantResultInspection.sampleKeys,
            selectPayloadType: verification.selectedPayloadType,
            selectRecordType: verification.selectedRecordType,
            selectEmbeddingType: verification.embeddingType,
            selectVectorLength: verification.vectorLength,
          },
        );
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

      const entityResultInspection = inspectQueryResult(entityResult);
      if (!entityResultInspection.hasRecordId) {
        const verification = await verifyEmbeddingPresent(
          input.surreal,
          entity.record as RecordId<string, string>,
          entityEmbedding.length,
        );
        if (!verification.ok) {
          throw new Error(
            [
              `entity embedding update verification failed for ${entity.record.tb}:${entity.record.id as string}`,
              `expectedDimension=${entityEmbedding.length}`,
              `update.hasRecordId=${entityResultInspection.hasRecordId}`,
              `update.flattenedCount=${entityResultInspection.flattenedCount}`,
              `update.sampleTypes=${entityResultInspection.sampleTypes.join("|")}`,
              `update.sampleKeys=${entityResultInspection.sampleKeys.map((keys) => keys.join(",")).join("|")}`,
              `select.hasId=${verification.selectedHasId}`,
              `select.payloadType=${verification.selectedPayloadType}`,
              `select.recordType=${verification.selectedRecordType}`,
              `select.embeddingType=${verification.embeddingType}`,
              `select.vectorLength=${verification.vectorLength ?? -1}`,
              `select.keys=${verification.selectedKeys.join(",")}`,
              `verify.select.hasId=${verification.verifySelectHasId}`,
              `verify.select.payloadType=${verification.verifySelectPayloadType}`,
              `verify.select.recordType=${verification.verifySelectRecordType}`,
              `verify.select.embeddingType=${verification.verifySelectEmbeddingType}`,
              `verify.select.vectorLength=${verification.verifySelectVectorLength ?? -1}`,
              `verify.query.hasId=${verification.verifyQueryHasId}`,
              `verify.query.payloadType=${verification.verifyQueryPayloadType}`,
              `verify.query.recordType=${verification.verifyQueryRecordType}`,
              `verify.query.embeddingType=${verification.verifyQueryEmbeddingType}`,
              `verify.query.vectorLength=${verification.verifyQueryVectorLength ?? -1}`,
            ].join(" "),
          );
        }

        logWarn(
          "embedding.persist.unexpected_update_output",
          "entity embedding update returned no row but verification succeeded",
          {
            record: `${entity.record.tb}:${entity.record.id as string}`,
            expectedDimension: entityEmbedding.length,
            updateFlattenedCount: entityResultInspection.flattenedCount,
            updateSampleTypes: entityResultInspection.sampleTypes,
            updateSampleKeys: entityResultInspection.sampleKeys,
            selectPayloadType: verification.selectedPayloadType,
            selectRecordType: verification.selectedRecordType,
            selectEmbeddingType: verification.embeddingType,
            selectVectorLength: verification.vectorLength,
          },
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

async function verifyEmbeddingPresent(
  surreal: Surreal,
  record: RecordId<string, string>,
  expectedDimension: number,
): Promise<{
  ok: boolean;
  selectedHasId: boolean;
  selectedPayloadType: string;
  selectedRecordType: string;
  embeddingType: string;
  vectorLength?: number;
  selectedKeys: string[];
  verifySelectHasId: boolean;
  verifySelectPayloadType: string;
  verifySelectRecordType: string;
  verifySelectEmbeddingType: string;
  verifySelectVectorLength?: number;
  verifyQueryHasId: boolean;
  verifyQueryPayloadType: string;
  verifyQueryRecordType: string;
  verifyQueryEmbeddingType: string;
  verifyQueryVectorLength?: number;
}> {
  const snapshot = await readRecordSnapshot(surreal, record);
  if (!snapshot.hasId) {
    return {
      ok: false,
      selectedHasId: false,
      selectedPayloadType: snapshot.payloadType,
      selectedRecordType: snapshot.recordType,
      embeddingType: "undefined",
      selectedKeys: snapshot.keys,
      verifySelectHasId: snapshot.selectHasId,
      verifySelectPayloadType: snapshot.selectPayloadType,
      verifySelectRecordType: snapshot.selectRecordType,
      verifySelectEmbeddingType: snapshot.selectEmbeddingType,
      verifySelectVectorLength: snapshot.selectVectorLength,
      verifyQueryHasId: snapshot.queryHasId,
      verifyQueryPayloadType: snapshot.queryPayloadType,
      verifyQueryRecordType: snapshot.queryRecordType,
      verifyQueryEmbeddingType: snapshot.queryEmbeddingType,
      verifyQueryVectorLength: snapshot.queryVectorLength,
    };
  }

  const selectedHasId = snapshot.hasId;
  const selectedKeys = snapshot.keys;
  const vectorLength = snapshot.vectorLength;
  return {
    ok: selectedHasId && vectorLength === expectedDimension,
    selectedHasId,
    selectedPayloadType: snapshot.payloadType,
    selectedRecordType: snapshot.recordType,
    embeddingType: snapshot.embeddingType,
    vectorLength,
    selectedKeys,
    verifySelectHasId: snapshot.selectHasId,
    verifySelectPayloadType: snapshot.selectPayloadType,
    verifySelectRecordType: snapshot.selectRecordType,
    verifySelectEmbeddingType: snapshot.selectEmbeddingType,
    verifySelectVectorLength: snapshot.selectVectorLength,
    verifyQueryHasId: snapshot.queryHasId,
    verifyQueryPayloadType: snapshot.queryPayloadType,
    verifyQueryRecordType: snapshot.queryRecordType,
    verifyQueryEmbeddingType: snapshot.queryEmbeddingType,
    verifyQueryVectorLength: snapshot.queryVectorLength,
  };
}

function inspectQueryResult(result: unknown): {
  hasRecordId: boolean;
  flattenedCount: number;
  sampleTypes: string[];
  sampleKeys: string[][];
} {
  const flattened = flattenQueryResult(result);
  let hasRecordId = false;
  const sampleTypes: string[] = [];
  const sampleKeys: string[][] = [];

  for (const candidate of flattened) {
    sampleTypes.push(describeValueType(candidate));
    if (candidate && typeof candidate === "object" && "id" in candidate) {
      const id = (candidate as { id?: unknown }).id;
      if (id !== undefined) {
        hasRecordId = true;
      }
      sampleKeys.push(Object.keys(candidate as Record<string, unknown>).slice(0, 8));
      continue;
    }

    sampleKeys.push([]);
  }

  return {
    hasRecordId,
    flattenedCount: flattened.length,
    sampleTypes: sampleTypes.slice(0, 3),
    sampleKeys: sampleKeys.slice(0, 3),
  };
}

function flattenQueryResult(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return [value];
  }

  const flattened: unknown[] = [];
  for (const entry of value) {
    if (Array.isArray(entry)) {
      flattened.push(...flattenQueryResult(entry));
      continue;
    }

    flattened.push(entry);
  }

  return flattened;
}

function readVectorLength(value: unknown): number | undefined {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (ArrayBuffer.isView(value)) {
    const arrayLike = value as { length?: number };
    if (typeof arrayLike.length === "number") {
      return arrayLike.length;
    }
  }

  if (value && typeof value === "object" && Symbol.iterator in value) {
    const iterator = (value as { [Symbol.iterator]?: () => Iterator<unknown> })[Symbol.iterator];
    if (typeof iterator === "function") {
      return [...(value as Iterable<unknown>)].length;
    }
  }

  return undefined;
}

function describeValueType(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  if (value === null) {
    return "null";
  }

  return Object.prototype.toString.call(value);
}

async function readRecordSnapshot(
  surreal: Surreal,
  record: RecordId<string, string>,
): Promise<{
  hasId: boolean;
  payloadType: string;
  recordType: string;
  embeddingType: string;
  vectorLength?: number;
  keys: string[];
  selectHasId: boolean;
  selectPayloadType: string;
  selectRecordType: string;
  selectEmbeddingType: string;
  selectVectorLength?: number;
  queryHasId: boolean;
  queryPayloadType: string;
  queryRecordType: string;
  queryEmbeddingType: string;
  queryVectorLength?: number;
}> {
  const selectedViaSelect = await surreal.select<unknown>(record);
  const selectPayloadType = describeValueType(selectedViaSelect);
  const selectRecord = extractRecordFromPayload(selectedViaSelect);
  const selectHasId = selectRecord?.id !== undefined;
  const selectEmbeddingType = describeValueType(selectRecord?.embedding);
  const selectVectorLength = readVectorLength(selectRecord?.embedding);

  const [selectedViaQueryResult] = await surreal
    .query<[unknown]>("SELECT * FROM $record;", { record })
    .collect<[unknown]>();
  const queryPayloadType = describeValueType(selectedViaQueryResult);
  const queryRecord = extractRecordFromPayload(selectedViaQueryResult);
  const queryHasId = queryRecord?.id !== undefined;
  const queryEmbeddingType = describeValueType(queryRecord?.embedding);
  const queryVectorLength = readVectorLength(queryRecord?.embedding);

  const preferredRecord = selectHasId ? selectRecord : queryHasId ? queryRecord : undefined;
  if (!preferredRecord) {
    return {
      hasId: false,
      payloadType: selectPayloadType,
      recordType: "undefined",
      embeddingType: "undefined",
      keys: [],
      selectHasId,
      selectPayloadType,
      selectRecordType: describeValueType(selectRecord),
      selectEmbeddingType,
      selectVectorLength,
      queryHasId,
      queryPayloadType,
      queryRecordType: describeValueType(queryRecord),
      queryEmbeddingType,
      queryVectorLength,
    };
  }

  return {
    hasId: true,
    payloadType: selectHasId ? selectPayloadType : queryPayloadType,
    recordType: describeValueType(preferredRecord),
    embeddingType: describeValueType(preferredRecord.embedding),
    vectorLength: readVectorLength(preferredRecord.embedding),
    keys: Object.keys(preferredRecord),
    selectHasId,
    selectPayloadType,
    selectRecordType: describeValueType(selectRecord),
    selectEmbeddingType,
    selectVectorLength,
    queryHasId,
    queryPayloadType,
    queryRecordType: describeValueType(queryRecord),
    queryEmbeddingType,
    queryVectorLength,
  };
}

function extractRecordFromPayload(value: unknown):
  | { id?: unknown; embedding?: unknown }
  | undefined {
  const candidates = flattenQueryResult(value).filter((entry) => entry && typeof entry === "object");
  const withId = candidates.find((entry) => "id" in (entry as Record<string, unknown>));
  if (withId) {
    return withId as { id?: unknown; embedding?: unknown };
  }

  const first = candidates[0];
  return first ? (first as { id?: unknown; embedding?: unknown }) : undefined;
}
