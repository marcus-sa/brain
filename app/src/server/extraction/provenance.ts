import type { SourceKind } from "../../shared/contracts";

export function resolveValidatedResolvedFromMessageId(input: {
  resolvedFromMessageId?: string;
  sourceKind: SourceKind;
  sourceMessageId?: string;
  extractionHistoryMessageIds: Set<string>;
}): string | undefined {
  const resolvedFromMessageId = input.resolvedFromMessageId?.trim();
  if (!resolvedFromMessageId) {
    return undefined;
  }

  if (input.sourceKind !== "message") {
    throw new Error("resolvedFromMessageId is only valid for message extraction sources");
  }

  if (!input.sourceMessageId || input.sourceMessageId.trim().length === 0) {
    throw new Error("resolvedFromMessageId requires sourceMessageId");
  }

  if (resolvedFromMessageId === input.sourceMessageId) {
    throw new Error("resolvedFromMessageId cannot match the current source message id");
  }

  if (!input.extractionHistoryMessageIds.has(resolvedFromMessageId)) {
    throw new Error(`resolvedFromMessageId is not present in extraction conversation history: ${resolvedFromMessageId}`);
  }

  return resolvedFromMessageId;
}
