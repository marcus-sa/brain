# Agent Learnings Data Models

## SurrealDB Schema

### `learning` Table (SCHEMAFULL)

```sql
DEFINE TABLE learning SCHEMAFULL;

-- Core content
DEFINE FIELD text ON learning TYPE string;
DEFINE FIELD learning_type ON learning TYPE string
  ASSERT $value IN ["constraint", "instruction", "precedent"];
DEFINE FIELD status ON learning TYPE string
  ASSERT $value IN ["active", "pending_approval", "dismissed", "superseded", "deactivated"];
DEFINE FIELD source ON learning TYPE string
  ASSERT $value IN ["human", "agent"];
DEFINE FIELD priority ON learning TYPE string DEFAULT "medium"
  ASSERT $value IN ["low", "medium", "high"];

-- Targeting
DEFINE FIELD target_agents ON learning TYPE array<string>;
DEFINE FIELD target_agents[*] ON learning TYPE string;
DEFINE FIELD workspace ON learning TYPE record<workspace>;

-- Agent suggestion metadata
DEFINE FIELD suggested_by ON learning TYPE option<string>;
DEFINE FIELD pattern_confidence ON learning TYPE option<float>;

-- Provenance and audit trail
DEFINE FIELD created_by ON learning TYPE option<record<identity>>;
DEFINE FIELD created_at ON learning TYPE datetime;
DEFINE FIELD updated_at ON learning TYPE option<datetime>;

-- Approval audit (set when pending_approval -> active)
DEFINE FIELD approved_by ON learning TYPE option<record<identity>>;
DEFINE FIELD approved_at ON learning TYPE option<datetime>;

-- Activation timestamp (set when status becomes active, regardless of path)
DEFINE FIELD activated_at ON learning TYPE option<datetime>;

-- Dismissal audit (set when pending_approval -> dismissed)
DEFINE FIELD dismissed_by ON learning TYPE option<record<identity>>;
DEFINE FIELD dismissed_at ON learning TYPE option<datetime>;
DEFINE FIELD dismissed_reason ON learning TYPE option<string>;

-- Deactivation audit (set when active -> deactivated)
DEFINE FIELD deactivated_by ON learning TYPE option<record<identity>>;
DEFINE FIELD deactivated_at ON learning TYPE option<datetime>;

-- Vector search
DEFINE FIELD embedding ON learning TYPE option<array<float>>;

-- Indexes
DEFINE INDEX idx_learning_workspace_status ON learning FIELDS workspace, status;
DEFINE INDEX idx_learning_embedding ON learning FIELDS embedding HNSW DIMENSION 1536 DIST COSINE;
```

### `learning_evidence` Relation Table

Links a learning to the evidence that prompted its creation (messages, traces, observations, agent sessions).

```sql
DEFINE TABLE learning_evidence TYPE RELATION
  IN learning
  OUT message | trace | observation | agent_session
  SCHEMAFULL;
DEFINE FIELD added_at ON learning_evidence TYPE option<datetime>;
```

### `supersedes` Relation Table

Links a new learning to the old learning it replaces. Direction: `RELATE new_learning->supersedes->old_learning` (the new learning supersedes the old one; arrow points to what was replaced).

```sql
DEFINE TABLE supersedes TYPE RELATION
  IN learning
  OUT learning
  SCHEMAFULL;
DEFINE FIELD superseded_at ON supersedes TYPE datetime;
DEFINE FIELD reason ON supersedes TYPE option<string>;
```

## Status Lifecycle

```
Human-created:
  -> active (immediate)
  -> active -> superseded (new learning replaces)
  -> active -> deactivated (user disables)

Agent-suggested:
  -> pending_approval
  -> pending_approval -> active (human approves)
  -> pending_approval -> dismissed (human rejects)
  -> active -> superseded
  -> active -> deactivated
```

## Learning Types

| Type | Injection Rule | Example |
|---|---|---|
| `constraint` | ALWAYS injected, never dropped for token budget | "Never use null for domain data values" |
| `instruction` | Injected within token budget, priority-ordered | "Use RecordId objects, never raw table:id strings" |
| `precedent` | Injected only when semantically relevant (similarity > 0.70) | "PostgreSQL chosen over MySQL for JSON support" |

## Target Agents

Array of agent type strings. Empty array = all agents.

Known agent types: `"chat_agent"`, `"pm_agent"`, `"observer_agent"`, `"mcp"`, `"coding_agent"`.

## Shared Contract Types

Added to `app/src/shared/contracts.ts`:

```typescript
export const LEARNING_TYPES = ["constraint", "instruction", "precedent"] as const;
export type LearningType = (typeof LEARNING_TYPES)[number];

export const LEARNING_STATUSES = ["active", "pending_approval", "dismissed", "superseded", "deactivated"] as const;
export type LearningStatus = (typeof LEARNING_STATUSES)[number];

export const LEARNING_SOURCES = ["human", "agent"] as const;
export type LearningSource = (typeof LEARNING_SOURCES)[number];

export type LearningSummary = {
  id: string;
  text: string;
  learningType: LearningType;
  status: LearningStatus;
  source: LearningSource;
  priority: EntityPriority;
  targetAgents: string[];
  suggestedBy?: string;
  patternConfidence?: number;
  createdAt: string;
  approvedAt?: string;
  dismissedAt?: string;
  dismissedReason?: string;
  deactivatedAt?: string;
};
```

## Collision Detection Types

```typescript
export type CollisionType = "contradicts" | "duplicates" | "overlaps" | "reinforces";

export type CollisionResult = {
  collisionType: CollisionType;
  targetKind: "learning" | "policy" | "decision";
  targetId: string;
  targetText: string;
  similarity: number;
  blocking: boolean; // true for policy collisions
};
```

## Query Patterns

### Load Active Learnings (JIT - follows two-step KNN pattern)

For `constraint` and `instruction` types (non-semantic):
```sql
SELECT id, text, learning_type, source, priority, target_agents, created_at
FROM learning
WHERE workspace = $workspace
  AND status = "active"
  AND learning_type IN ["constraint", "instruction"]
  AND (array::len(target_agents) = 0 OR $agentType IN target_agents)
ORDER BY
  source = "human" DESC,
  priority = "high" DESC,
  priority = "medium" DESC,
  created_at DESC
LIMIT 50;
```

For `precedent` type (semantic - two-step KNN):
```sql
-- Step 1: KNN candidates
LET $candidates = SELECT id, text, learning_type, source, priority, target_agents, created_at,
    vector::similarity::cosine(embedding, $contextEmbedding) AS similarity
  FROM learning
  WHERE embedding <|20, COSINE|> $contextEmbedding;

-- Step 2: Filter by workspace + status + relevance
SELECT * FROM $candidates
  WHERE workspace = $workspace
  AND status = "active"
  AND learning_type = "precedent"
  AND (array::len(target_agents) = 0 OR $agentType IN target_agents)
  AND similarity > 0.70
  ORDER BY similarity DESC
  LIMIT 10;
```

### Collision Check (similarity search)

```sql
-- Step 1: KNN candidates from active learnings
LET $candidates = SELECT id, text, learning_type,
    vector::similarity::cosine(embedding, $newEmbedding) AS similarity
  FROM learning
  WHERE embedding <|20, COSINE|> $newEmbedding;

-- Step 2: Filter
SELECT * FROM $candidates
  WHERE workspace = $workspace
  AND status = "active"
  AND similarity > 0.75
  ORDER BY similarity DESC
  LIMIT 10;
```

### Pending Learnings for Feed

```sql
SELECT id, text, learning_type, source, status, suggested_by,
       pattern_confidence, target_agents, created_at
FROM learning
WHERE workspace = $workspace
  AND status = "pending_approval"
ORDER BY created_at DESC
LIMIT $limit;
```

### Rate Limiting Check

```sql
SELECT count() AS count
FROM learning
WHERE workspace = $workspace
  AND suggested_by = $agentType
  AND created_at > time::now() - 7d
GROUP ALL;
```

Detector logic: if count >= 5, skip suggestion creation and log observation "Learning suggestion rate limit reached for {agentType} ({count}/5 this week)".

### Dismissed Re-Suggestion Prevention (two-step KNN)

Before creating an agent-suggested learning, check if a similar learning was previously dismissed:

```sql
-- Step 1: KNN candidates from dismissed learnings
LET $dismissed_candidates = SELECT id, text,
    vector::similarity::cosine(embedding, $proposedEmbedding) AS similarity
  FROM learning
  WHERE embedding <|10, COSINE|> $proposedEmbedding;

-- Step 2: Filter by workspace + dismissed status + high similarity
SELECT * FROM $dismissed_candidates
  WHERE workspace = $workspace
  AND status = "dismissed"
  AND similarity > 0.85
  LIMIT 1;
```

If any row returned: skip suggestion creation. The human already rejected a substantially similar learning.

## Graph Relationships

```
learning --[learning_evidence]--> message | trace | observation | agent_session
learning --[supersedes]--> learning (the superseded one)
```

No `belongs_to` edge to project/feature -- learnings are workspace-scoped, not project-scoped. This is intentional: a learning like "never use null" applies across all projects.
