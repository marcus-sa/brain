BEGIN TRANSACTION;

-- Learning table: behavioral rules injected into agent prompts at runtime
DEFINE TABLE learning SCHEMAFULL;

DEFINE FIELD text ON learning TYPE string;
DEFINE FIELD learning_type ON learning TYPE string
  ASSERT $value IN ["constraint", "instruction", "precedent"];
DEFINE FIELD status ON learning TYPE string
  ASSERT $value IN ["active", "pending_approval", "dismissed", "superseded", "deactivated"];
DEFINE FIELD source ON learning TYPE string
  ASSERT $value IN ["human", "agent"];
DEFINE FIELD priority ON learning TYPE string
  DEFAULT "medium"
  ASSERT $value IN ["low", "medium", "high"];
DEFINE FIELD target_agents ON learning TYPE array<string>;
DEFINE FIELD workspace ON learning TYPE record<workspace>;

-- Agent suggestion metadata
DEFINE FIELD suggested_by ON learning TYPE option<string>;
DEFINE FIELD pattern_confidence ON learning TYPE option<float>;

-- Audit trail: creation
DEFINE FIELD created_by ON learning TYPE option<record<identity>>;
DEFINE FIELD created_at ON learning TYPE datetime;
DEFINE FIELD updated_at ON learning TYPE option<datetime>;

-- Audit trail: approval
DEFINE FIELD approved_by ON learning TYPE option<record<identity>>;
DEFINE FIELD approved_at ON learning TYPE option<datetime>;
DEFINE FIELD activated_at ON learning TYPE option<datetime>;

-- Audit trail: dismissal
DEFINE FIELD dismissed_by ON learning TYPE option<record<identity>>;
DEFINE FIELD dismissed_at ON learning TYPE option<datetime>;
DEFINE FIELD dismissed_reason ON learning TYPE option<string>;

-- Audit trail: deactivation
DEFINE FIELD deactivated_by ON learning TYPE option<record<identity>>;
DEFINE FIELD deactivated_at ON learning TYPE option<datetime>;

-- Embedding for semantic search
DEFINE FIELD embedding ON learning TYPE option<array<float>>;

-- Indexes
DEFINE INDEX idx_learning_workspace_status ON learning FIELDS workspace, status;
DEFINE INDEX idx_learning_embedding ON learning FIELDS embedding HNSW DIMENSION 1536 DIST COSINE;

-- Evidence relation: links a learning to the entities that support it
DEFINE TABLE learning_evidence TYPE RELATION IN learning OUT message | trace | observation | agent_session SCHEMAFULL;
DEFINE FIELD added_at ON learning_evidence TYPE option<datetime>;

-- Supersession relation: tracks when one learning replaces another
DEFINE TABLE supersedes TYPE RELATION IN learning OUT learning SCHEMAFULL;
DEFINE FIELD superseded_at ON supersedes TYPE datetime;
DEFINE FIELD reason ON supersedes TYPE option<string>;

COMMIT TRANSACTION;
