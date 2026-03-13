import { randomUUID } from "node:crypto";
import { RecordId, Surreal } from "surrealdb";
import type { EntityPriority, LearningStatus, LearningType, LearningSource, LearningSummary } from "../../shared/contracts";
import type { CreateLearningInput, EvidenceTargetRecord, LearningRecord } from "./types";

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createLearning(input: {
  surreal: Surreal;
  workspaceRecord: RecordId<"workspace", string>;
  learning: CreateLearningInput;
  now: Date;
  embedding?: number[];
}): Promise<LearningRecord> {
  const learningRecord = new RecordId("learning", randomUUID());

  const isActive = input.learning.source === "human";
  const status: LearningStatus = isActive ? "active" : "pending_approval";

  await input.surreal.create(learningRecord).content({
    text: input.learning.text,
    learning_type: input.learning.learningType,
    status,
    source: input.learning.source,
    priority: input.learning.priority ?? "medium",
    target_agents: input.learning.targetAgents ?? [],
    workspace: input.workspaceRecord,
    ...(input.learning.suggestedBy ? { suggested_by: input.learning.suggestedBy } : {}),
    ...(input.learning.patternConfidence !== undefined ? { pattern_confidence: input.learning.patternConfidence } : {}),
    ...(input.learning.createdBy ? { created_by: new RecordId("identity", input.learning.createdBy) } : {}),
    ...(input.embedding ? { embedding: input.embedding } : {}),
    ...(isActive ? { activated_at: input.now } : {}),
    created_at: input.now,
    updated_at: input.now,
  });

  // Create evidence edges
  if (input.learning.evidenceIds && input.learning.evidenceIds.length > 0) {
    for (const evidence of input.learning.evidenceIds) {
      const evidenceRecord = new RecordId(evidence.table, evidence.id) as EvidenceTargetRecord;
      await input.surreal
        .relate(learningRecord, new RecordId("learning_evidence", randomUUID()), evidenceRecord, {
          added_at: input.now,
        })
        .output("after");
    }
  }

  return learningRecord;
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

export async function updateLearningStatus(input: {
  surreal: Surreal;
  workspaceRecord: RecordId<"workspace", string>;
  learningRecord: LearningRecord;
  newStatus: LearningStatus;
  now: Date;
  actorRecord?: RecordId<"identity", string>;
  reason?: string;
}): Promise<void> {
  const row = await input.surreal.select<{ workspace: RecordId<"workspace", string>; status: LearningStatus }>(input.learningRecord);
  if (!row) {
    throw new Error(`learning not found: ${input.learningRecord.id as string}`);
  }

  if ((row.workspace.id as string) !== (input.workspaceRecord.id as string)) {
    throw new Error("learning is outside the current workspace scope");
  }

  const auditFields = buildAuditFields(input.newStatus, input.now, input.actorRecord, input.reason);

  await input.surreal.update(input.learningRecord).merge({
    status: input.newStatus,
    updated_at: input.now,
    ...auditFields,
  });
}

function buildAuditFields(
  newStatus: LearningStatus,
  now: Date,
  actorRecord?: RecordId<"identity", string>,
  reason?: string,
): Record<string, unknown> {
  switch (newStatus) {
    case "active":
      return {
        activated_at: now,
        ...(actorRecord ? { approved_by: actorRecord } : {}),
        approved_at: now,
      };
    case "dismissed":
      return {
        dismissed_at: now,
        ...(actorRecord ? { dismissed_by: actorRecord } : {}),
        ...(reason ? { dismissed_reason: reason } : {}),
      };
    case "deactivated":
      return {
        deactivated_at: now,
        ...(actorRecord ? { deactivated_by: actorRecord } : {}),
      };
    case "superseded":
      return {};
    case "pending_approval":
      return {};
  }
}

// ---------------------------------------------------------------------------
// Supersession
// ---------------------------------------------------------------------------

export async function supersedeLearning(input: {
  surreal: Surreal;
  workspaceRecord: RecordId<"workspace", string>;
  oldLearningRecord: LearningRecord;
  newLearningRecord: LearningRecord;
  reason?: string;
  now: Date;
}): Promise<void> {
  // Validate workspace scope for old learning
  const oldRow = await input.surreal.select<{ workspace: RecordId<"workspace", string> }>(input.oldLearningRecord);
  if (!oldRow) {
    throw new Error(`learning not found: ${input.oldLearningRecord.id as string}`);
  }
  if ((oldRow.workspace.id as string) !== (input.workspaceRecord.id as string)) {
    throw new Error("learning is outside the current workspace scope");
  }

  // Deactivate old learning
  await input.surreal.update(input.oldLearningRecord).merge({
    status: "superseded" satisfies LearningStatus,
    updated_at: input.now,
  });

  // Create supersedes edge: new -> old
  await input.surreal
    .relate(input.newLearningRecord, new RecordId("supersedes", randomUUID()), input.oldLearningRecord, {
      superseded_at: input.now,
      ...(input.reason ? { reason: input.reason } : {}),
    })
    .output("after");
}

// ---------------------------------------------------------------------------
// List queries
// ---------------------------------------------------------------------------

export async function listWorkspaceActiveLearnings(input: {
  surreal: Surreal;
  workspaceRecord: RecordId<"workspace", string>;
  agentType?: string;
}): Promise<LearningSummary[]> {
  const query = input.agentType
    ? [
        "SELECT id, text, learning_type, status, source, priority, target_agents,",
        "suggested_by, pattern_confidence, created_at, approved_at, dismissed_at,",
        "dismissed_reason, deactivated_at",
        "FROM learning",
        "WHERE workspace = $workspace",
        'AND status = "active"',
        "AND (array::len(target_agents) = 0 OR $agentType IN target_agents)",
        "ORDER BY created_at DESC;",
      ].join(" ")
    : [
        "SELECT id, text, learning_type, status, source, priority, target_agents,",
        "suggested_by, pattern_confidence, created_at, approved_at, dismissed_at,",
        "dismissed_reason, deactivated_at",
        "FROM learning",
        "WHERE workspace = $workspace",
        'AND status = "active"',
        "ORDER BY created_at DESC;",
      ].join(" ");

  const [rows] = await input.surreal
    .query<[LearningRow[]]>(query, {
      workspace: input.workspaceRecord,
      ...(input.agentType ? { agentType: input.agentType } : {}),
    })
    .collect<[LearningRow[]]>();

  return rows.map(toLearnings);
}

export async function listWorkspacePendingLearnings(input: {
  surreal: Surreal;
  workspaceRecord: RecordId<"workspace", string>;
  limit?: number;
}): Promise<LearningSummary[]> {
  const [rows] = await input.surreal
    .query<[LearningRow[]]>(
      [
        "SELECT id, text, learning_type, status, source, priority, target_agents,",
        "suggested_by, pattern_confidence, created_at, approved_at, dismissed_at,",
        "dismissed_reason, deactivated_at",
        "FROM learning",
        "WHERE workspace = $workspace",
        'AND status = "pending_approval"',
        "ORDER BY created_at DESC",
        "LIMIT $limit;",
      ].join(" "),
      {
        workspace: input.workspaceRecord,
        limit: input.limit ?? 50,
      },
    )
    .collect<[LearningRow[]]>();

  return rows.map(toLearnings);
}

// ---------------------------------------------------------------------------
// Rate-limit counting
// ---------------------------------------------------------------------------

export async function countRecentSuggestionsByAgent(input: {
  surreal: Surreal;
  workspaceRecord: RecordId<"workspace", string>;
  agentType: string;
}): Promise<number> {
  const [rows] = await input.surreal
    .query<[Array<{ count: number }>]>(
      [
        "SELECT count() AS count FROM learning",
        "WHERE workspace = $workspace",
        'AND source = "agent"',
        "AND suggested_by = $agentType",
        "AND created_at > time::now() - 7d;",
      ].join(" "),
      {
        workspace: input.workspaceRecord,
        agentType: input.agentType,
      },
    )
    .collect<[Array<{ count: number }>]>();

  return rows[0]?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type LearningRow = {
  id: LearningRecord;
  text: string;
  learning_type: LearningType;
  status: LearningStatus;
  source: LearningSource;
  priority: EntityPriority;
  target_agents: string[];
  suggested_by?: string;
  pattern_confidence?: number;
  created_at: string | Date;
  approved_at?: string | Date;
  dismissed_at?: string | Date;
  dismissed_reason?: string;
  deactivated_at?: string | Date;
};

function toLearnings(row: LearningRow): LearningSummary {
  return {
    id: row.id.id as string,
    text: row.text,
    learningType: row.learning_type,
    status: row.status,
    source: row.source,
    priority: row.priority,
    targetAgents: row.target_agents,
    ...(row.suggested_by ? { suggestedBy: row.suggested_by } : {}),
    ...(row.pattern_confidence !== undefined ? { patternConfidence: row.pattern_confidence } : {}),
    createdAt: toISOString(row.created_at),
    ...(row.approved_at ? { approvedAt: toISOString(row.approved_at) } : {}),
    ...(row.dismissed_at ? { dismissedAt: toISOString(row.dismissed_at) } : {}),
    ...(row.dismissed_reason ? { dismissedReason: row.dismissed_reason } : {}),
    ...(row.deactivated_at ? { deactivatedAt: toISOString(row.deactivated_at) } : {}),
  };
}

function toISOString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
