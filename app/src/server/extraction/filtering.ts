import { normalizeName } from "./normalize";
import type { ExtractionPromptEntity } from "./schema";
import type { SourceKind } from "../../shared/contracts";

export const placeholderEntityNames = new Set([
  "my project",
  "the project",
  "our project",
  "my app",
  "the app",
  "our app",
  "this feature",
  "the feature",
  "that feature",
  "my idea",
  "the idea",
  "this idea",
  "the thing",
  "this thing",
  "that thing",
  "my business",
  "the business",
  "my team",
  "the team",
]);

export function shouldStoreExtraction(confidence: number, threshold = 0.6): boolean {
  return confidence >= threshold;
}

export function shouldDisplayExtraction(confidence: number, threshold = 0.85): boolean {
  return confidence >= threshold;
}

export function isPlaceholderEntityName(text: string): boolean {
  return placeholderEntityNames.has(normalizeName(text));
}

export function hasGroundedEvidence(evidence: string, sourceText: string): boolean {
  const normalizedEvidence = normalizeName(evidence);
  if (normalizedEvidence.length === 0) {
    return false;
  }

  const normalizedSource = normalizeName(sourceText);
  return normalizedSource.includes(normalizedEvidence);
}

export function dedupeExtractedEntities(input: {
  entities: ExtractionPromptEntity[];
  sourceText: string;
  storeThreshold: number;
  sourceKind: SourceKind;
}): ExtractionPromptEntity[] {
  const byTempId = new Map<string, ExtractionPromptEntity>();
  const hasDecisionCommitmentLanguage = hasCommitmentIndicator(input.sourceText);

  for (const entity of input.entities) {
    const tempId = entity.tempId.trim();
    if (tempId.length === 0) {
      continue;
    }

    const text = entity.text.trim();
    if (text.length === 0) {
      continue;
    }

    const evidence = entity.evidence.trim();
    if (evidence.length === 0) {
      continue;
    }

    if (!shouldStoreExtraction(entity.confidence, input.storeThreshold)) {
      continue;
    }

    if (isPlaceholderEntityName(text)) {
      continue;
    }

    if (!hasGroundedEvidence(evidence, input.sourceText)) {
      continue;
    }

    const normalizedEntity = normalizeEntityKind({
      entity,
      hasDecisionCommitmentLanguage,
      sourceKind: input.sourceKind,
    });
    const existing = byTempId.get(tempId);
    const resolvedFromMessageId = ("resolvedFromMessageId" in normalizedEntity ? normalizedEntity.resolvedFromMessageId : undefined)
      ?.trim();
    if (!existing || normalizedEntity.confidence > existing.confidence) {
      byTempId.set(tempId, {
        ...normalizedEntity,
        tempId,
        text,
        evidence,
        ...(resolvedFromMessageId ? { resolvedFromMessageId } : {}),
      });
    }
  }

  return pruneQuestionAlternatives([...byTempId.values()], input.sourceText);
}

const commitmentIndicators = [
  /let'?s\s+go\s+with/i,
  /let'?s\s+move\s+forward\s+with/i,
  /\bwe\s+decided\b/i,
  /\bi(?:'m| am)?\s+choosing\b/i,
  /\bgoing\s+with\b/i,
  /\bsettled\s+on\b/i,
  /\bcommitted\s+to\b/i,
];

function hasCommitmentIndicator(sourceText: string): boolean {
  return commitmentIndicators.some((pattern) => pattern.test(sourceText));
}

function normalizeEntityKind(input: {
  entity: ExtractionPromptEntity;
  hasDecisionCommitmentLanguage: boolean;
  sourceKind: SourceKind;
}): ExtractionPromptEntity {
  if (input.hasDecisionCommitmentLanguage && input.entity.kind === "feature") {
    return {
      ...input.entity,
      kind: "decision",
    };
  }

  if (input.sourceKind !== "document_chunk") {
    return input.entity;
  }

  return normalizeDocumentChunkKind(input.entity);
}

const taskDirectiveIndicators = [
  /\b(implement|build|create|write|fix|migrate|deploy|ship|set\s+up|setup|configure|test|document|refactor|investigate|review|finalize|extract)\b/i,
  /\b(today|tomorrow|this\s+week|next\s+week|this\s+sprint|next\s+sprint|by\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|eod|eow|end\s+of\s+week|end\s+of\s+sprint|next\s+sprint|q[1-4]|[0-9]{4}-[0-9]{2}-[0-9]{2}))\b/i,
  /\b(responsible|owner)\b/i,
];

const architectureDecisionIndicators = [
  /\b(use|using|adopt|adopted|choose|chosen|select|selected|standardize)\b/i,
  /\b(store|persist)\b.{0,40}\b(in|on)\b/i,
  /\b(backed\s+by|powered\s+by)\b/i,
];

const technologyKeywordPattern =
  /\b(surrealdb|postgres|mysql|mariadb|mongodb|redis|kafka|tigerbeetle|openrouter|openai|anthropic|typescript|rust|go|bun)\b/i;

function normalizeDocumentChunkKind(entity: ExtractionPromptEntity): ExtractionPromptEntity {
  if (entity.kind === "task") {
    if (isArchitectureChoiceStatement(entity)) {
      return {
        ...entity,
        kind: "decision",
      };
    }

    if (!isTaskDirectiveStatement(entity)) {
      return {
        ...entity,
        kind: "feature",
      };
    }

    return entity;
  }

  if (entity.kind === "decision" && isTaskDirectiveStatement(entity) && !isArchitectureChoiceStatement(entity)) {
    return {
      ...entity,
      kind: "task",
    };
  }

  return entity;
}

function isTaskDirectiveStatement(entity: ExtractionPromptEntity): boolean {
  const classifierText = `${entity.text} ${entity.evidence}`;
  return taskDirectiveIndicators.some((pattern) => pattern.test(classifierText));
}

function isArchitectureChoiceStatement(entity: ExtractionPromptEntity): boolean {
  const classifierText = `${entity.text} ${entity.evidence}`;
  const hasArchitectureVerb = architectureDecisionIndicators.some((pattern) => pattern.test(classifierText));
  if (!hasArchitectureVerb) {
    return false;
  }

  return technologyKeywordPattern.test(classifierText);
}

function pruneQuestionAlternatives(
  entities: ExtractionPromptEntity[],
  sourceText: string,
): ExtractionPromptEntity[] {
  const questionMarkCount = [...sourceText].filter((char) => char === "?").length;
  if (questionMarkCount !== 1) {
    return entities;
  }

  const questionEntities = entities.filter((entity) => entity.kind === "question");
  if (questionEntities.length !== 1) {
    return entities;
  }

  const [questionEntity] = questionEntities;
  const normalizedQuestionText = normalizeName(questionEntity.text);
  if (normalizedQuestionText.length === 0) {
    return entities;
  }

  return entities.filter((entity) => {
    if (entity.kind === "question") {
      return true;
    }

    const normalizedEntityText = normalizeName(entity.text);
    if (normalizedEntityText.length === 0) {
      return false;
    }

    if (normalizedEntityText.split(" ").length > 4) {
      return true;
    }

    if (!normalizedQuestionText.includes(normalizedEntityText)) {
      return true;
    }

    return entity.confidence > questionEntity.confidence;
  });
}
