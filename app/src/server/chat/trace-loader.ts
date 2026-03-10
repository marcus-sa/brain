import { RecordId, type Surreal } from "surrealdb";
import type { SubagentTrace, SubagentTraceStep } from "../../shared/contracts";

// ---------------------------------------------------------------------------
// Row types returned by SurrealDB queries
// ---------------------------------------------------------------------------

type RootTraceRow = {
  id: RecordId<"trace", string>;
  type: string;
  tool_name?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  duration_ms?: number;
  created_at: Date;
  source_message: Array<RecordId<"message", string>>;
};

type ChildTraceRow = {
  id: RecordId<"trace", string>;
  type: string;
  parent_trace: RecordId<"trace", string>;
  tool_name?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  duration_ms?: number;
  created_at: Date;
};

// ---------------------------------------------------------------------------
// Pure reconstruction: trace rows -> SubagentTrace wire format
// ---------------------------------------------------------------------------

/**
 * Reconstruct SubagentTrace wire format from root and child trace rows.
 * Pure function - no IO, no side effects.
 */
export function reconstructTraces(
  rootRows: unknown[],
  childRows: unknown[],
): Map<string, SubagentTrace[]> {
  const roots = rootRows as RootTraceRow[];
  const children = childRows as ChildTraceRow[];

  if (roots.length === 0) return new Map();

  // Group children by parent_trace id
  const childrenByParent = new Map<string, ChildTraceRow[]>();
  for (const child of children) {
    const parentId = child.parent_trace.id as string;
    const existing = childrenByParent.get(parentId);
    if (existing) {
      existing.push(child);
    } else {
      childrenByParent.set(parentId, [child]);
    }
  }

  // Build traces grouped by message id
  const tracesByMessage = new Map<string, SubagentTrace[]>();

  for (const root of roots) {
    const messageId = extractMessageId(root.source_message);
    if (!messageId) continue;

    const rootId = root.id.id as string;
    const rootChildren = childrenByParent.get(rootId) ?? [];
    const steps = rootChildren.map(mapChildToStep);

    const input = root.input as Record<string, unknown> | undefined;
    const trace: SubagentTrace = {
      agentId: (input?.agentId as string) ?? "unknown",
      intent: (input?.intent as string) ?? "unknown",
      steps,
      totalDurationMs: root.duration_ms ?? 0,
    };

    const existing = tracesByMessage.get(messageId);
    if (existing) {
      existing.push(trace);
    } else {
      tracesByMessage.set(messageId, [trace]);
    }
  }

  return tracesByMessage;
}

function extractMessageId(sourceMessage: Array<{ id: string | unknown }>): string | undefined {
  if (!sourceMessage || sourceMessage.length === 0) return undefined;
  return sourceMessage[0]!.id as string;
}

function mapChildToStep(child: ChildTraceRow): SubagentTraceStep {
  if (child.type === "message") {
    return {
      type: "text",
      text: (child.input as Record<string, unknown>)?.text as string | undefined,
    };
  }

  return {
    type: "tool_call",
    ...(child.tool_name ? { toolName: child.tool_name } : {}),
    ...(child.input ? { argsJson: JSON.stringify(child.input) } : {}),
    ...(child.output ? { resultJson: JSON.stringify(child.output) } : {}),
    ...(child.duration_ms !== undefined ? { durationMs: child.duration_ms } : {}),
  };
}

// ---------------------------------------------------------------------------
// Batch loading: 2-query pattern
// ---------------------------------------------------------------------------

/**
 * Batch-load SubagentTraces for a set of message IDs.
 * Uses exactly 2 queries: one for root traces via spawns edges, one for children.
 * Returns a Map keyed by message ID (string) to SubagentTrace[].
 * Messages with no traces are simply absent from the Map.
 */
export async function batchLoadTraces(
  surreal: Surreal,
  messageIds: RecordId<"message", string>[],
): Promise<Map<string, SubagentTrace[]>> {
  if (messageIds.length === 0) return new Map();

  // Query 1: All root traces for the message batch via spawns edges
  const [rootRows] = await surreal
    .query<[RootTraceRow[]]>(
      "SELECT *, <-spawns<-message AS source_message FROM trace WHERE <-spawns<-message CONTAINSANY $message_ids;",
      { message_ids: messageIds },
    )
    .collect<[RootTraceRow[]]>();

  if (rootRows.length === 0) return new Map();

  // Query 2: All children of those roots
  const rootIds = rootRows.map((r) => r.id);
  const [childRows] = await surreal
    .query<[ChildTraceRow[]]>(
      "SELECT * FROM trace WHERE parent_trace INSIDE $root_ids ORDER BY created_at ASC, id ASC;",
      { root_ids: rootIds },
    )
    .collect<[ChildTraceRow[]]>();

  return reconstructTraces(rootRows, childRows);
}
