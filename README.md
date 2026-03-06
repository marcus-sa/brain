# Brain

**The knowledge graph that replaces you as the integration layer between AI agents.**

AI agents are already writing code, generating plans, and answering questions. The gap is coordination.

Brain gives humans and agents a shared memory layer so decisions, tasks, constraints, and implementation signals persist across sessions and tools.

---

## The Problem

Today, most teams are the glue between disconnected agent workflows.

You manually:
- relay architecture decisions from chat to implementation,
- repeat project context to each coding session,
- track what changed and what is blocked,
- reconcile contradictions between code, plans, and decisions.

Without shared context, agents produce generic output. With shared context, they produce deployable work.

## How Brain Works

### Chat to Think

Conversations are the primary interface. The chat orchestrator and subagents (PM + analytics) turn discussions into structured graph updates.

### Graph to Coordinate

The knowledge graph is shared state across agents and humans.

- An observation written by a coding agent becomes visible to planning/governance workflows.
- A confirmed decision in chat is available in future coding-agent context packets.
- Coordination happens through graph reads and writes, not agent-to-agent message passing.

### Feed to Govern

The feed is where humans govern:
- blocking items,
- review-required items,
- awareness signals.

Agents execute quickly. Humans retain authority over high-impact decisions.

## Capability Map

### Core Platform

- Multi-turn workspace chat with streaming responses
- Graph entities for projects, features, tasks, decisions, questions, observations, and suggestions
- Provenance-aware relationships from messages/documents/commits
- Governance feed with `blocking`, `review`, and `awareness` tiers
- Graph views for workspace/project/focused entity exploration

### Agent System

- Thin orchestration chat agent with tool calling
- PM subagent for planning and work-item management
- Analytics subagent for aggregation/provenance-style graph analysis
- Shared tool layer for search, status, decision workflows, observations, and work item creation

### Coding Agent Integration

- MCP server (`brain mcp`) for Claude Code/Cursor/Aider/Codex-style workflows
- CLI integration via `brain init` (auth, hooks, commands, MCP wiring)
- Agent session lifecycle capture in graph entities

### Unified IAM (Identity + Authority)

- Identity resolution across platform, GitHub, Slack, calendar, and MCP identities
- Authority scopes for agent actions (`auto`, `provisional`, `propose`, `blocked`)
- Person-first attribution for human/agent activity

### Direction

Brain is built as a long-lived coordination layer, not a single-feature assistant. The roadmap expands autonomy and integrations without changing the graph-first model.

## Coordination Model

Agents do not coordinate by messaging each other. They coordinate through the graph.

```text
Coding agent logs observation
  -> graph stores signal + provenance
  -> feed/governance surfaces impact
  -> planning workflows convert to action
  -> next sessions consume updated context automatically
```

## Architecture

```text
Human + Agent Inputs
  -> Chat Orchestrator (tools + subagents)
      -> PM Agent / Analytics Agent
      -> Graph Query + Write Layer
  -> Governance Feed (blocking/review/awareness)
  -> Graph UI (entities, edges, provenance)

Coding Agents
  -> MCP stdio server (brain mcp)
  -> Authenticated MCP HTTP API
  -> Same SurrealDB knowledge graph

Identity + Authority
  -> Unified IAM layer (person resolution + scoped permissions)
  -> Human and agent actions attributed to person/workspace context
```

## Self-Hosting

Brain is intentionally self-host-friendly.

### Infrastructure footprint

- Required datastore: **SurrealDB**
- No separate Redis/Kafka/vector DB requirement for core operation
- App runtime: single Bun server process

SurrealDB can run:
- as a standalone service, or
- embedded for tighter single-node deployment patterns.

### Inference options

Brain supports:
- OpenRouter (hosted), and
- Ollama (local inference).

For local/private setups, run Brain + SurrealDB + Ollama on one machine.

## IAM: Unified Identity + Authority

IAM is a core layer, not an add-on.

It solves two problems:
- **Identity resolution:** unify multiple external identities into one `person` entity.
- **Authority controls:** enforce who can perform which graph actions.

### Core concepts

- One person, many identities (`platform`, `github`, `slack`, `google`, `mcp`, ...)
- Person nodes are created through explicit identity flows (owner creation, OAuth link, invite), not extraction
- Resolution chain:
1. exact provider match
2. email match
3. candidate suggestion for ambiguous display-name matches
4. unresolved reference when no safe match exists

### Agent auth patterns

1. Platform-managed agents (workspace-scoped actor behavior)
2. User-local agents (act as extension of a human with scoped permissions)

### IAM rollout shape

1. Phase 1: core identity + authority enforcement
2. Phase 2: OAuth 2.1 MCP auth + richer identity linking + configurable authority UI
3. Phase 3: multi-user/team RBAC model

## Tech Stack

- Runtime: Bun + TypeScript
- Frontend: React + TanStack Router
- Agent orchestration: Vercel AI SDK
- Database: SurrealDB (document + graph + vector)
- Protocol: Model Context Protocol (MCP)

## Quickstart

### 1) Prerequisites

- Bun `>=1.3`
- Docker (for SurrealDB)
- Either:
  - OpenRouter credentials, or
  - Ollama runtime + local models

### 2) Install dependencies

```bash
bun install
```

### 3) Start SurrealDB

```bash
docker compose up -d surrealdb surrealdb-init
```

### 4) Configure environment

#### OpenRouter profile

```bash
OPENROUTER_API_KEY=your_openrouter_key
CHAT_AGENT_MODEL=<chat-model-id>
EXTRACTION_MODEL=<extraction-model-id>
ANALYTICS_MODEL=<analytics-model-id>
PM_AGENT_MODEL=<pm-model-id>
OPENROUTER_EMBEDDING_MODEL=<embedding-model-id>
EMBEDDING_DIMENSION=1536
EXTRACTION_STORE_THRESHOLD=0.6
EXTRACTION_DISPLAY_THRESHOLD=0.85
SURREAL_URL=ws://127.0.0.1:8000/rpc
SURREAL_USERNAME=root
SURREAL_PASSWORD=root
SURREAL_NAMESPACE=brain
SURREAL_DATABASE=app
PORT=3000
```

#### Ollama profile

```bash
INFERENCE_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
CHAT_AGENT_MODEL=<ollama-chat-model>
EXTRACTION_MODEL=<ollama-extraction-model>
ANALYTICS_MODEL=<ollama-analytics-model>
PM_AGENT_MODEL=<ollama-pm-model>
EMBEDDING_MODEL=<ollama-embedding-model>
EMBEDDING_DIMENSION=1536
EXTRACTION_STORE_THRESHOLD=0.6
EXTRACTION_DISPLAY_THRESHOLD=0.85
SURREAL_URL=ws://127.0.0.1:8000/rpc
SURREAL_USERNAME=root
SURREAL_PASSWORD=root
SURREAL_NAMESPACE=brain
SURREAL_DATABASE=app
PORT=3000
```

### 5) Apply migrations

```bash
bun migrate
```

### 6) Run the app

```bash
bun run dev
```

Open `http://localhost:3000`.

## API at a Glance

- `POST /api/workspaces` create workspace + bootstrap conversation
- `POST /api/chat/messages` send message (supports file attachments)
- `GET /api/chat/stream/:messageId` stream events
- `GET /api/workspaces/:workspaceId/feed` governance feed
- `GET /api/graph/:workspaceId` graph views
- `GET /api/entities/search` full-text entity search
- `POST /api/mcp/:workspaceId/context` intent-based MCP context resolution

## MCP + CLI

Build CLI:

```bash
bun run build:cli
# outputs ./brain
```

Initialize repo integration:

```bash
BRAIN_SERVER_URL=http://localhost:3000 \
BRAIN_WORKSPACE_ID=<workspace-id> \
brain init
```

`brain init` sets up:
- `~/.brain/config.json` auth entry
- `.mcp.json` server registration
- `.claude/settings.json` hooks
- `CLAUDE.md` integration block
- Brain slash commands and git hooks

Run MCP directly:

```bash
brain mcp
```

## Useful Scripts

```bash
bun run dev
bun run start
bun run typecheck
bun test tests/unit/
bun test --env-file=.env tests/smoke/
bun run eval
bun run eval:watch
bun migrate
```

## Repository Map

```text
app/
  server.ts                     # Bun entrypoint
  src/client/                   # chat/feed/graph UI
  src/server/                   # runtime, routes, agents, tools, graph/extraction domains
cli/                            # brain CLI + MCP server
schema/
  surreal-schema.surql          # base schema
  migrations/                   # versioned migrations
tests/
  unit/                         # deterministic unit tests
  smoke/                        # integration tests
evals/                          # model eval suites + scorers
```

## Contribution Principles

- Never emit/persist domain `null`; omit absent optional fields
- Fail fast on invalid state
- Use `RecordId` objects internally for Surreal IDs
- Keep schema changes in versioned migration files and apply with `bun migrate`

## Status

Early-stage and actively developed.
