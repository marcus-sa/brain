# Shared Artifacts Registry: Agent Learnings

## Purpose
Track all data values that flow across journey steps and integration points. Every ${variable} in journey mockups has a single source of truth and documented consumers.

---

## Artifact Registry

### learning_text
- **Source of truth**: `learning` table, `text` field
- **Consumers**:
  - Chat correction text (pre-fill source)
  - Learning editor form field
  - Learning record in SurrealDB
  - Governance feed card body
  - System prompt "Workspace Learnings" section
  - MCP context packet "Active Learnings" section
  - Learning library list view
- **Owner**: Learning entity lifecycle (create/edit flows)
- **Integration risk**: HIGH -- text appears in 7 places. Edits must propagate immediately.
- **Validation**: All consumers read from the same `learning.text` field. No hardcoded copies.

### learning_type
- **Source of truth**: `learning` table, `learning_type` field
- **Consumers**:
  - Learning editor type selector
  - Learning record
  - Prompt section grouping (Constraints, Instructions, Precedents)
  - MCP context packet type tags ([constraint], [instruction], [precedent])
  - Learning library filter
  - Conflict detection categorization
- **Owner**: Learning entity lifecycle
- **Integration risk**: MEDIUM -- type determines prompt grouping. Invalid type breaks formatting.
- **Validation**: ASSERT constraint on field: `$value IN ["constraint", "instruction", "precedent"]`

### learning_status
- **Source of truth**: `learning` table, `status` field
- **Consumers**:
  - Learning record
  - Confirmation card ("Status: Active")
  - Governance feed card (pending_approval badge)
  - Learning library filter and badge
  - Prompt injection query (WHERE status = 'active')
- **Owner**: Learning lifecycle state machine
- **Integration risk**: HIGH -- status controls whether learning is injected. Wrong status = missed or extra injections.
- **Validation**: ASSERT: `$value IN ["active", "pending_approval", "dismissed", "superseded", "deactivated"]`
- **State transitions**:
  - Human-created: -> `active` (immediate)
  - Agent-suggested: -> `pending_approval` -> `active` | `dismissed`
  - Any active: -> `superseded` (when replaced) | `deactivated` (manual)

### target_agents
- **Source of truth**: `learning` table, `target_agents` field (array of strings)
- **Consumers**:
  - Learning editor agent checkboxes
  - Learning record
  - Governance feed card ("For: code_agent")
  - Prompt injection query filter (WHERE $agent_type IN target_agents)
  - Learning library agent filter
- **Owner**: Learning entity lifecycle
- **Integration risk**: HIGH -- controls which agents receive the learning. Wrong value = silent injection failure.
- **Validation**: ASSERT each value IN ["code_agent", "chat_agent", "pm_agent", "architect", "observer", "design_partner", "all"]

### learning_source
- **Source of truth**: `learning` table, `source` field
- **Consumers**:
  - Learning record
  - Priority sort (human > agent)
  - Learning library source indicator
  - Governance feed attribution
- **Owner**: Learning creation flow
- **Integration risk**: MEDIUM -- determines priority ordering in prompt injection.
- **Validation**: ASSERT: `$value IN ["human", "agent"]`

### suggested_by
- **Source of truth**: `learning` table, `suggested_by` field
- **Consumers**:
  - Learning record (for agent-suggested)
  - Governance feed card ("Suggested by: Observer")
  - Learning library attribution
- **Owner**: Agent suggestion flow
- **Integration risk**: LOW -- display only, does not affect injection.
- **Validation**: Optional field. When present, ASSERT: `$value IN ["observer", "pm_agent", "chat_agent", "architect", "code_agent"]`

### evidence_refs
- **Source of truth**: `learning` table, `evidence_refs` field (array of record references)
- **Consumers**:
  - Learning record
  - Governance feed evidence section
  - Learning library provenance view
- **Owner**: Agent suggestion flow (Observer populates)
- **Integration risk**: MEDIUM -- broken refs = missing evidence in governance review.
- **Validation**: Each ref must be a valid record ID in agent_session, observation, or message table.

### pattern_confidence
- **Source of truth**: `learning` table, `confidence` field
- **Consumers**:
  - Learning record
  - Governance feed card ("Confidence: 89%")
  - Suggestion threshold (must be >= 0.70 to create suggestion)
- **Owner**: Agent pattern detection
- **Integration risk**: LOW -- informational for human review.
- **Validation**: Float between 0 and 1.

### workspace_record
- **Source of truth**: Session context (workspace table)
- **Consumers**:
  - Learning query WHERE clause
  - Learning record workspace field
  - All agent prompt builders
- **Owner**: Workspace entity (existing)
- **Integration risk**: HIGH -- wrong workspace = wrong learnings injected.
- **Validation**: Must match session workspace. Existing validation in prompt builders.

### agent_type
- **Source of truth**: Agent session context
- **Consumers**:
  - Learning query target_agents filter
  - Prompt injection point selection (which builder to call)
- **Owner**: Agent session lifecycle (existing)
- **Integration risk**: HIGH -- determines which learnings are injected.
- **Validation**: Must be a valid agent type string matching target_agents enum.

---

## Integration Checkpoints

### Checkpoint 1: Learning Creation -> Storage
- Learning text, type, status, target_agents, source correctly persisted
- Embedding generated and stored
- For human-created: status = "active" immediately
- For agent-suggested: status = "pending_approval"

### Checkpoint 2: Storage -> Governance Feed
- Pending learnings appear in feed queries
- Evidence refs resolve to valid session records
- Feed card displays correct text, attribution, confidence

### Checkpoint 3: Governance -> Activation
- Approve action transitions status to "active"
- Edit & Approve preserves original text in history
- Dismiss action transitions status to "dismissed"
- State transition recorded with actor and timestamp

### Checkpoint 4: Activation -> Prompt Injection
- Active learnings returned by query for correct agent type
- Priority sort: human before agent, high before low
- Token budget enforced without losing human learnings
- Formatted section injected at correct point in system prompt

### Checkpoint 5: Conflict Detection (Cross-Cutting)
- On create: check semantic similarity against active learnings
- Similarity > 0.85: flag as duplicate
- Contradictory semantics detected: flag as conflict
- At injection time: resolve conflicts by source priority

---

## CLI Vocabulary Consistency

Not directly applicable (web UI feature). However, the MCP context packet format for coding agents must use consistent terminology:

| Term | Usage |
|------|-------|
| Learning | The entity name in schema, UI, and documentation |
| Active Learning | A learning with status = "active" |
| Workspace Learning | A learning scoped to the current workspace |
| Constraint | Learning type: must-follow rule |
| Instruction | Learning type: conditional guidance |
| Precedent | Learning type: historical reference |
| Pending | A learning awaiting human approval (agent-suggested) |
| Superseded | A learning replaced by a newer learning |
