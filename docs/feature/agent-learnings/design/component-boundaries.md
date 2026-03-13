# Agent Learnings Component Boundaries

## Domain Boundary

The learning domain lives under `app/src/server/learning/` as a self-contained module, following the same pattern as `observation/`, `suggestion/`, and `intent/`.

## Component Dependency Map

```
                    +-----------------+
                    |  HTTP Adapter   |
                    | learning-route  |
                    +--------+--------+
                             |
              +--------------+--------------+
              |              |              |
    +---------v--+    +------v------+  +----v-------+
    |  queries   |    | collision   |  | detector   |
    | (CRUD/DB)  |    | (safety)   |  | (patterns) |
    +-----+------+    +------+------+  +-----+------+
          |                  |               |
          |           +------v------+        |
          |           |   loader    |        |
          |           | (JIT read)  |        |
          |           +------+------+        |
          |                  |               |
          |           +------v------+        |
          |           | formatter   |        |
          |           | (pure text) |        |
          |           +-------------+        |
          |                                  |
    +-----v----------------------------------v-----+
    |              SurrealDB + LLM Provider        |
    +----------------------------------------------+
```

## Component Responsibilities

### `queries.ts` - Learning Persistence

**Owns**: All SurrealDB read/write operations for the `learning` table and its relation edges.

**Functions**:
- `createLearning` - Create learning record + evidence edges
- `updateLearningStatus` - Transition status (with workspace scope validation)
- `supersedeLearning` - Deactivate old + create supersedes edge
- `listWorkspaceActiveLearnings` - Active learnings by workspace, optional agent type filter
- `listWorkspacePendingLearnings` - Pending approval learnings for feed
- `countRecentSuggestionsByAgent` - Rate limiting check

**Dependencies**: SurrealDB (driven port)

**Follows pattern of**: `observation/queries.ts`, `suggestion/queries.ts`

### `loader.ts` - JIT Learning Loading

**Owns**: Priority sorting, type-based filtering, token budgeting for prompt injection.

**Functions**:
- `loadActiveLearnings` - Main entry point. Takes `(surreal, workspaceRecord, agentType, contextEmbedding?)`. Returns sorted, budget-trimmed learning list.
- `estimateTokens` - Token estimation. Takes text string, returns estimated token count via `Math.ceil(text.trim().split(/\s+/).length / 0.75)`.

**Dependencies**: `queries.ts` (for DB access)

**Key behaviors**:
- Constraints: always included, never trimmed. If constraints alone exceed budget, log observation but include all.
- Instructions: included in priority order within remaining budget (skip oversized, try next)
- Precedents: only included when `contextEmbedding` provided and similarity > 0.70. If `contextEmbedding` is undefined, precedents are excluded entirely (not an error).
- Token budget: ~500 tokens (~375 words) via word-count heuristic (ADR-026)

**Context embedding source per prompt builder**:

| Prompt Builder | `contextEmbedding` Source | Precedent Behavior |
|---|---|---|
| Chat agent (`chat/context.ts`) | Embedding of conversation's project description (if project linked) | Excluded if no project linked |
| PM agent (`agents/pm/prompt.ts`) | Embedding of project description | Excluded if project has no description |
| MCP context (`mcp/context-builder.ts`) | Embedding of task description from context packet request | Excluded if no task scope |
| Observer (`agents/observer/prompt.ts`) | Not provided | Precedents always excluded -- observer gets constraints + instructions only |

### `formatter.ts` - Prompt Section Rendering (Pure)

**Owns**: Converting learning records into prompt text sections.

**Functions**:
- `formatLearningsSection` - Takes learning array, returns formatted string with type grouping

**Dependencies**: None (pure function, no IO)

**Output format**:
```
## Workspace Learnings
### Constraints (always apply)
- [text]
### Instructions
- [text]
### Precedents (contextually relevant)
- [text]
```

### `collision.ts` - Collision Detection

**Owns**: Three-layer collision check before learning activation.

**Functions**:
- `checkCollisions` - Takes new learning text, embedding (or undefined), workspace, and LLM model. Returns collision results array.
- `classifyIntent` - LLM structured output call. Takes two texts and target kind. Returns `{ classification, reasoning }`.

**Dependencies**: SurrealDB (driven port), LLM (driven port for intent classification)

**Layers** (see ADR-028 for unified classification algorithm):
1. Learning-vs-learning: similarity > 0.90 = duplicate; 0.75-0.90 = LLM classify; < 0.75 = no collision
2. Learning-vs-policy: similarity > 0.80 = LLM classify (contradiction = hard block); < 0.80 = no collision
3. Learning-vs-decision: similarity > 0.80 = LLM classify (contradiction = informational); < 0.80 = no collision

**LLM fallback**: If LLM unavailable, default to `"contradicts"` (safer -- surfaces warning rather than missing conflict).

**Embedding unavailable behavior**:
- Human-created learning: skip collision check entirely, activate learning, log observation "Learning activated without collision check -- embedding service unavailable"
- Agent-suggested learning: skip collision check, status stays `pending_approval` anyway (human will review)
- Deferred check: Observer picks up learnings with missing embeddings on next scan, computes embedding, runs retroactive collision check

### `detector.ts` - Pattern Detection

**Owns**: Identifying correction patterns across three data sources.

**Functions**:
- `detectConversationCorrections` - Scans recent messages for repeated corrections on same topic
- `detectTraceFailures` - Scans trace table for repeated tool failures
- `detectObservationClusters` - Clusters observations by embedding similarity

**Dependencies**: SurrealDB (driven port), LLM (driven port for correction extraction)

**Used by**:
- Chat agent: calls `detectConversationCorrections()` synchronously during message processing
- Observer agent: calls `detectTraceFailures()` + `detectObservationClusters()` during scheduled graph scan (configurable frequency, default every 6 hours)

**Rate limiting gate** (executed before any suggestion creation):
1. Call `countRecentSuggestionsByAgent(surreal, workspace, agentType)` -- if count >= 5, log observation and skip
2. Call dismissed re-suggestion check (KNN on dismissed learnings, similarity > 0.85) -- if match found, skip

**Embedding error handling**: If embedding generation fails for a proposed learning text, create the learning record with `embedding: undefined`. The Observer's deferred scan will compute the embedding later.

### `learning-route.ts` - HTTP Adapter

**Owns**: HTTP endpoint registration for learning CRUD.

**Endpoints**:
- `POST /api/workspaces/:workspaceId/learnings` - Create learning
- `GET /api/workspaces/:workspaceId/learnings` - List learnings (filterable by status, type, agent)
- `POST /api/workspaces/:workspaceId/learnings/:learningId/actions` - Status transitions (approve, dismiss, deactivate, supersede)

**Dependencies**: `queries.ts`, `collision.ts`, embedding model, `deps.inflight`

**Follows pattern of**: `entities/entity-actions-route.ts`, `feed/feed-route.ts`

**Inflight tracking** (per AGENTS.md): When the route handler fires background work (embedding generation, deferred collision check after embedding retry), wrap with `deps.inflight.track(promise)`. This ensures smoke tests can `drain()` pending work before closing connections.

**Embedding error handling in create flow**:
1. Attempt embedding generation for the learning text
2. If embedding succeeds: persist learning with embedding, run collision check synchronously, return result with collisions
3. If embedding fails: persist learning with `embedding: undefined`, skip collision check, log observation "Learning created without embedding -- collision check deferred", return result with `collisionCheckDeferred: true`
4. The actions endpoint (approve) also attempts collision check before activation. If embedding is still missing at approve time, compute it then. If that also fails, human-created learnings activate anyway (fail-open), agent-suggested learnings are blocked with error.

### `types.ts` - Internal Types

**Owns**: Internal type definitions not shared with client.

**Contains**: DB row types, collision internal types, detector config types.

## Dependency Inversion Compliance

All components depend inward (toward domain logic):

- **HTTP adapter** (`learning-route.ts`) depends on domain (`queries.ts`, `collision.ts`)
- **Domain** depends on driven ports (SurrealDB, LLM) via function parameters, not module-level imports
- **Pure functions** (`formatter.ts`) have zero dependencies
- **Integration points** (chat context, PM prompt, etc.) call `loadActiveLearnings()` and `formatLearningsSection()` -- one-way dependency into learning domain

No circular dependencies. No learning domain code depends on chat, PM, observer, or MCP modules.

## Testing Strategy

| Component | Test Type | Strategy |
|---|---|---|
| `formatter.ts` | Unit | Pure function. Input: learning array. Assert: grouped output text, type ordering, empty handling. |
| `loader.ts` (sort + budget) | Unit | Pure sort/budget logic. Input: unsorted learnings + budget. Assert: constraint-first ordering, budget trimming, overflow observation. |
| `loader.ts` (DB integration) | Acceptance | Seed learnings in test DB. Assert: workspace filtering, agent type filtering, precedent similarity threshold. |
| `collision.ts` | Acceptance | Seed active learnings + policies + decisions with embeddings. Assert: duplicate detection, LLM classification dispatch, policy hard block, fail-open behavior. Mock LLM for deterministic classification. |
| `detector.ts` | Acceptance | Seed conversation history / traces / observations. Assert: correction pattern detection, rate limiting, dismissed re-suggestion prevention. Mock LLM for correction extraction. |
| `learning-route.ts` | Acceptance | Full HTTP flow via `acceptance-test-kit.ts`. Assert: create with embedding, list with filters, approve/dismiss/deactivate actions, feed card appearance. |
| Prompt injection | Acceptance | Create active learning, build system prompt, assert "Workspace Learnings" section present. Per prompt builder: chat, PM, observer, MCP. |

## Integration Boundary Contracts

### Chat Agent Integration
```
chat/context.ts imports:
  - loadActiveLearnings from learning/loader
  - formatLearningsSection from learning/formatter

ChatContext type gains:
  activeLearnings?: LearningSummary[]

buildSystemPrompt gains:
  "## Workspace Learnings" section appended before "## This Conversation"
```

### PM Agent Integration
```
agents/pm/prompt.ts imports:
  - loadActiveLearnings from learning/loader
  - formatLearningsSection from learning/formatter

buildPmSystemPrompt gains:
  "## Workspace Learnings" section appended before "## Core Responsibilities"
```

### MCP Context Integration
```
mcp/context-builder.ts imports:
  - loadActiveLearnings from learning/loader

ContextPacket type gains:
  learnings?: Array<{ text, type, priority }>
```

### Observer Integration
```
agents/observer/prompt.ts imports:
  - loadActiveLearnings from learning/loader
  - formatLearningsSection from learning/formatter

buildObserverSystemPrompt gains:
  "## Workspace Learnings" section appended before "## Existing Workspace Observations"
```

### Feed Integration
```
feed/feed-queries.ts gains:
  - listPendingLearnings() query function
  - mapPendingLearningToFeedItem() mapper

feed/feed-route.ts gains:
  - Pending learnings added to review tier
  - Learning actions: approve, dismiss, discuss
```
