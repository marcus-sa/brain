import { randomUUID } from "node:crypto";
import { RecordId, type Surreal } from "surrealdb";
import type { EntityKind, ExtractedEntity, ExtractedRelationship, OnboardingSeedItem, SourceKind } from "../../shared/contracts";
import { dedupeExtractedEntities } from "./filtering";
import { resolveValidatedResolvedFromMessageId } from "./provenance";
import type { ExtractionPromptEntity, ExtractionPromptOutput } from "./schema";
import {
  applyPersonReferenceFromRelationship,
  appendWorkspaceTools,
  createProvenanceEdge,
  loadWorkspaceKindCandidates,
  normalizeRelationshipKind,
  resolveWorkspacePersonMention,
  upsertGraphEntity,
} from "./entity-upsert";
import type {
  GraphEntityRecord,
  PersistExtractionResult,
  PersonMentionReference,
  SourceRecord,
  TempEntityReference,
} from "./types";
import { elapsedMs, logError, logInfo } from "../http/observability";
import { loadWorkspaceProjects } from "../workspace/workspace-scope";

export async function persistExtractionOutput(input: {
  surreal: Surreal;
  embeddingModel: any;
  embeddingDimension: number;
  extractionModelId: string;
  extractionStoreThreshold: number;
  workspaceRecord: RecordId<"workspace", string>;
  sourceRecord: SourceRecord;
  sourceKind: SourceKind;
  sourceLabel?: string;
  promptText: string;
  output: ExtractionPromptOutput;
  sourceMessageRecord?: RecordId<"message", string>;
  sourceChunkRecord?: RecordId<"document_chunk", string>;
  extractionHistoryMessageIds?: string[];
  now: Date;
}): Promise<PersistExtractionResult> {
  const startedAt = performance.now();
  logInfo("extraction.persist.started", "Extraction persistence started", {
    workspaceId: input.workspaceRecord.id as string,
    sourceKind: input.sourceKind,
    sourceId: input.sourceRecord.id as string,
    candidateEntityCount: input.output.entities.length,
    candidateRelationshipCount: input.output.relationships.length,
  });

  try {
    const entities = dedupeExtractedEntities({
      entities: input.output.entities,
      sourceText: input.promptText,
      storeThreshold: input.extractionStoreThreshold,
      sourceKind: input.sourceKind,
    });
    if (input.sourceKind === "message" && !input.sourceMessageRecord) {
      throw new Error("message extraction persistence requires sourceMessageRecord");
    }

    const extractionHistoryMessageIds = new Set(input.extractionHistoryMessageIds ?? []);
    const relationships = input.output.relationships
      .filter((relationship) => relationship.confidence >= input.extractionStoreThreshold)
      .map((relationship) => ({
        ...relationship,
        kind: normalizeRelationshipKind(relationship.kind),
        fromTempId: relationship.fromTempId.trim(),
        toTempId: relationship.toTempId.trim(),
        fromText: relationship.fromText.trim(),
        toText: relationship.toText.trim(),
      }))
      .filter(
        (relationship) =>
          relationship.kind.length > 0 &&
          relationship.fromTempId.length > 0 &&
          relationship.toTempId.length > 0 &&
          relationship.fromText.length > 0 &&
          relationship.toText.length > 0,
      );

    const persistedEntities: ExtractedEntity[] = [];
    const persistedRelationships: ExtractedRelationship[] = [];
    const seeds: OnboardingSeedItem[] = [];
    const embeddingTargets: Array<{ record: GraphEntityRecord; text: string }> = [];
    const entityByTempId = new Map<string, TempEntityReference>();
    const personMentionsByTempId = new Map<string, PersonMentionReference>();

    const workspaceProjects = await loadWorkspaceProjects(input.surreal, input.workspaceRecord);
    const personCandidates = entities.some((entity) => entity.kind === "person")
      ? await loadWorkspaceKindCandidates(input.surreal, input.workspaceRecord, "person")
      : [];

    for (const extracted of entities) {
      const resolvedFromMessageId = resolveValidatedResolvedFromMessageId({
        resolvedFromMessageId: "resolvedFromMessageId" in extracted ? extracted.resolvedFromMessageId : undefined,
        sourceKind: input.sourceKind,
        sourceMessageId: input.sourceMessageRecord?.id as string | undefined,
        extractionHistoryMessageIds,
      });
      const resolvedFromMessageRecord = resolvedFromMessageId
        ? new RecordId("message", resolvedFromMessageId)
        : undefined;

      if (extracted.kind === "person") {
        const personMatch = await resolveWorkspacePersonMention(
          input.embeddingModel,
          input.embeddingDimension,
          extracted.text,
          personCandidates,
        );
        personMentionsByTempId.set(extracted.tempId, {
          tempId: extracted.tempId,
          name: extracted.text,
          ...(personMatch ? { record: personMatch.id as RecordId<"person", string> } : {}),
        });

        if (!personMatch) {
          continue;
        }

        await createProvenanceEdge({
          surreal: input.surreal,
          sourceRecord: input.sourceRecord,
          targetRecord: personMatch.id,
          confidence: extracted.confidence,
          model: input.extractionModelId,
          now: input.now,
          fromText: extracted.text,
          evidence: extracted.evidence,
          evidenceSourceRecord: input.sourceMessageRecord,
          resolvedFromRecord: resolvedFromMessageRecord,
        });

        entityByTempId.set(extracted.tempId, {
          record: personMatch.id,
          text: personMatch.text,
          id: personMatch.id.id as string,
          kind: "person",
        });

        persistedEntities.push({
          id: personMatch.id.id as string,
          kind: "person",
          text: personMatch.text,
          confidence: extracted.confidence,
          sourceKind: input.sourceKind,
          sourceId: input.sourceRecord.id as string,
        });

        seeds.push({
          id: personMatch.id.id as string,
          kind: "person",
          text: personMatch.text,
          confidence: extracted.confidence,
          sourceKind: input.sourceKind,
          sourceId: input.sourceRecord.id as string,
          ...(input.sourceLabel ? { sourceLabel: input.sourceLabel } : {}),
        });

        continue;
      }

      const extractedNonPerson = extracted as ExtractionPromptEntity & { kind: Exclude<EntityKind, "workspace" | "person"> };
      const persisted = await upsertGraphEntity({
        surreal: input.surreal,
        embeddingModel: input.embeddingModel,
        embeddingDimension: input.embeddingDimension,
        extractionModelId: input.extractionModelId,
        workspaceRecord: input.workspaceRecord,
        workspaceProjects,
        sourceRecord: input.sourceRecord,
        sourceKind: input.sourceKind,
        promptText: input.promptText,
        extracted: extractedNonPerson,
        sourceMessageRecord: input.sourceMessageRecord,
        sourceChunkRecord: input.sourceChunkRecord,
        resolvedFromMessageRecord,
        now: input.now,
      });

      entityByTempId.set(extracted.tempId, {
        record: persisted.record,
        text: persisted.text,
        id: persisted.record.id as string,
        kind: persisted.kind,
      });

      persistedEntities.push({
        id: persisted.record.id as string,
        kind: persisted.kind,
        text: persisted.text,
        confidence: extracted.confidence,
        sourceKind: input.sourceKind,
        sourceId: input.sourceRecord.id as string,
      });

      seeds.push({
        id: persisted.record.id as string,
        kind: persisted.kind,
        text: persisted.text,
        confidence: extracted.confidence,
        sourceKind: input.sourceKind,
        sourceId: input.sourceRecord.id as string,
        ...(input.sourceLabel ? { sourceLabel: input.sourceLabel } : {}),
      });

      if (persisted.created) {
        embeddingTargets.push({
          record: persisted.record,
          text: persisted.text,
        });
      }
    }

    for (const relationship of relationships) {
      await applyPersonReferenceFromRelationship({
        surreal: input.surreal,
        relationship,
        personMentionsByTempId,
        entityByTempId,
        now: input.now,
      });

      const from = entityByTempId.get(relationship.fromTempId);
      const to = entityByTempId.get(relationship.toTempId);
      if (!from || !to) {
        continue;
      }

      const relationRecord = new RecordId("entity_relation", randomUUID());
      await input.surreal.relate(from.record, relationRecord, to.record, {
        kind: relationship.kind,
        confidence: relationship.confidence,
        ...(input.sourceMessageRecord ? { source_message: input.sourceMessageRecord } : {}),
        ...(input.sourceChunkRecord ? { source_chunk: input.sourceChunkRecord } : {}),
        extracted_at: input.now,
        created_at: input.now,
        from_text: relationship.fromText,
        to_text: relationship.toText,
      }).output("after");

      persistedRelationships.push({
        id: relationRecord.id as string,
        kind: relationship.kind,
        fromId: from.id,
        toId: to.id,
        confidence: relationship.confidence,
        sourceKind: input.sourceKind,
        sourceId: input.sourceRecord.id as string,
        ...(input.sourceMessageRecord ? { sourceMessageId: input.sourceMessageRecord.id as string } : {}),
        fromText: relationship.fromText,
        toText: relationship.toText,
      });
    }

    logInfo("extraction.persist.completed", "Extraction persistence completed", {
      workspaceId: input.workspaceRecord.id as string,
      sourceKind: input.sourceKind,
      sourceId: input.sourceRecord.id as string,
      persistedEntityCount: persistedEntities.length,
      persistedRelationshipCount: persistedRelationships.length,
      seedCount: seeds.length,
      toolCount: input.output.tools.length,
      durationMs: elapsedMs(startedAt),
    });

    return {
      entities: persistedEntities,
      relationships: persistedRelationships,
      seeds,
      embeddingTargets,
      tools: input.output.tools.map((tool) => tool.trim()).filter((tool) => tool.length > 0),
    };
  } catch (error) {
    logError("extraction.persist.failed", "Extraction persistence failed", error, {
      workspaceId: input.workspaceRecord.id as string,
      sourceKind: input.sourceKind,
      sourceId: input.sourceRecord.id as string,
      durationMs: elapsedMs(startedAt),
    });
    throw error;
  }
}

export async function appendExtractedTools(
  surreal: Surreal,
  workspaceRecord: RecordId<"workspace", string>,
  extractedTools: string[],
  now: Date,
): Promise<void> {
  const dedupedTools = [...new Set(extractedTools.map((tool) => tool.trim()).filter((tool) => tool.length > 0))];
  if (extractedTools.length > 0 && dedupedTools.length > 0) {
    await appendWorkspaceTools(surreal, workspaceRecord, dedupedTools, now);
  }
}
