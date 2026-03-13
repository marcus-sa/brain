# Journey: Collision Detection and Resolution

## Journey Overview

```
Persona: Tomas (workspace owner)
Goal: Create or approve a learning without introducing contradictions
Trigger: New learning is about to be activated (human-created or agent-approved)

EMOTIONAL ARC:
  Unaware ---------> Alert ------------> Informed ---------> Confident
  "Let me add this"  "Wait, conflict!"  "I see the issue"  "Resolved safely"
```

## Flow Diagram

```
+-------------------+     +-------------------+
| 1. CREATION       |     | 2. COLLISION      |
| New learning      |---->| CHECK             |
| about to activate |     | Query graph for   |
|                   |     | similar/contrary  |
|                   |     | active learnings  |
+-------------------+     | + policies        |
                          | + decisions       |
                          +-------------------+
                                  |
                     +------------+------------+
                     |                         |
              +------v------+          +-------v------+
              | NO COLLISION |          | COLLISION    |
              | Activate    |          | DETECTED     |
              | immediately |          |              |
              +-------------+          +-------+------+
                                               |
                                               v
                          +-------------------+-------------------+
                          |                   |                   |
                   +------v------+    +-------v------+    +------v------+
                   | 3a. POLICY  |    | 3b. LEARNING |    | 3c. DECISION|
                   | COLLISION   |    | COLLISION    |    | COLLISION   |
                   | Hard block  |    | Warning with |    | Info with   |
                   | Cannot      |    | resolution   |    | reference   |
                   | override    |    | options      |    |             |
                   +-------------+    +--------------+    +-------------+
                                              |
                                 +------------+------------+
                                 |            |            |
                          +------v---+  +-----v-----+  +--v--------+
                          | OVERRIDE |  | EDIT NEW  |  | DISMISS   |
                          | Keep both|  | Merge or  |  | OLD       |
                          | with ack |  | refine    |  | Activate  |
                          +----------+  +-----------+  | new       |
                                                       +-----------+
```

## Step Details

### Step 1: Creation Trigger

Two paths trigger collision check:

**Path A: Human creates via chat**
```
+-- Chat Window ------------------------------------------------+
|                                                                |
| Tomas: "Never use synchronous database calls in route         |
|  handlers. Always use async/await."                            |
|                                                                |
| [Agent detects behavioral directive, prepares learning]        |
|                                                                |
+----------------------------------------------------------------+
```

**Path B: Human approves agent suggestion**
```
+-- Governance Feed --------------------------------------------+
|                                                                |
| Tomas clicks [Approve] on:                                    |
| "Prefer connection pooling over single connections for DB"     |
|                                                                |
+----------------------------------------------------------------+
```

---

### Step 2: Collision Check

```
+-- Collision Engine (Internal) --------------------------------+
|                                                                |
| Input: new learning text + target_agent + type                 |
|                                                                |
| Step 1: Compute embedding for new learning text                |
|                                                                |
| Step 2: Query active learnings for same target_agent           |
|   LET $candidates = SELECT id, text, type, status,            |
|     vector::similarity::cosine(embedding, $new_vec) AS sim     |
|   FROM learning                                                |
|   WHERE embedding <|10, COSINE|> $new_vec;                     |
|   SELECT * FROM $candidates                                    |
|   WHERE workspace = $ws AND target_agent = $agent              |
|     AND status = 'active' AND sim > 0.75;                      |
|                                                                |
| Step 3: Query active policies for same workspace               |
|   SELECT id, title, description, rules                         |
|   FROM policy                                                  |
|   WHERE workspace = $ws AND status = 'active'                  |
|   -- semantic comparison against learning text                 |
|                                                                |
| Step 4: Query confirmed decisions in workspace                 |
|   LET $dec_candidates = SELECT id, summary,                   |
|     vector::similarity::cosine(embedding, $new_vec) AS sim     |
|   FROM decision                                                |
|   WHERE embedding <|5, COSINE|> $new_vec;                      |
|   SELECT * FROM $dec_candidates                                |
|   WHERE workspace = $ws                                        |
|     AND status IN ['confirmed', 'provisional']                 |
|     AND sim > 0.80;                                            |
|                                                                |
| Output: collision_results[]                                    |
|   { entity_type, entity_id, text, similarity, collision_type } |
|                                                                |
+----------------------------------------------------------------+
```

**Note**: KNN queries use the two-step pattern required by SurrealDB v3.0 (KNN subquery, then filter by workspace/agent).

**Collision types**:
- `contradicts`: semantic opposition (sim > 0.75 AND sentiment polarity differs)
- `duplicates`: near-identical (sim > 0.90)
- `overlaps`: partial overlap (sim 0.75-0.90, same polarity)
- `reinforces`: same polarity, related to decision (informational)

---

### Step 3a: Policy Collision (Hard Block)

Policies are deterministic governance rules. Learnings cannot override policies.

```
+-- Chat Window ------------------------------------------------+
|                                                                |
| Agent: "I cannot create this learning because it conflicts     |
|  with an active policy:                                        |
|                                                                |
|   +-- Policy Collision (Red) --------------------------------+ |
|   | New learning:                                             | |
|   |   'Skip code review for small changes under 10 lines'    | |
|   |                                                           | |
|   | Conflicts with Policy: 'All Code Changes Require Review' | |
|   |   Rule: deny code_merge when review_count < 1            | |
|   |   Status: active, version 2                              | |
|   |                                                           | |
|   | Resolution: Modify or supersede the policy first,         | |
|   |   then create the learning.                               | |
|   |                                                           | |
|   | [View Policy]  [Cancel]                                   | |
|   +-----------------------------------------------------------+ |
|                                                                |
+----------------------------------------------------------------+
```

**Emotional state**: Alert, then informed -- user understands why it was blocked
**Resolution**: User must update the policy through the policy governance workflow first

---

### Step 3b: Learning-to-Learning Collision (Warning)

```
+-- Chat Window ------------------------------------------------+
|                                                                |
| Agent: "I found a potential conflict with an existing           |
|  learning:                                                     |
|                                                                |
|   +-- Learning Collision (Yellow) ----------------------------+ |
|   | New learning:                                             | |
|   |   'Always use Prisma ORM for database access'             | |
|   |   Type: instruction                                       | |
|   |                                                           | |
|   | Conflicts with active learning:                           | |
|   |   'Use raw SQL queries for performance-critical paths'    | |
|   |   Type: instruction, created 12 days ago                  | |
|   |   Similarity: 0.83                                        | |
|   |                                                           | |
|   | Priority: Both are instructions (equal weight)            | |
|   |                                                           | |
|   | [Create Anyway]  [Edit New]  [Dismiss Old]  [Cancel]      | |
|   +-----------------------------------------------------------+ |
|                                                                |
+----------------------------------------------------------------+
```

**Resolution options**:
- **Create Anyway**: Both learnings active. Agent receives both and must reconcile.
- **Edit New**: Refine new learning to avoid conflict (e.g., "Use Prisma ORM for non-performance-critical database access").
- **Dismiss Old**: Dismiss the old learning, activate the new one.
- **Cancel**: Abandon the new learning.

---

### Step 3c: Decision Collision (Informational)

```
+-- Chat Window ------------------------------------------------+
|                                                                |
| Agent: "Note: This learning relates to an existing decision:   |
|                                                                |
|   +-- Decision Reference (Blue) -----------------------------+ |
|   | New learning:                                             | |
|   |   'Prefer PostgreSQL over MySQL for new services'         | |
|   |   Type: instruction                                       | |
|   |                                                           | |
|   | Related decision:                                         | |
|   |   decision:d92 'Standardize on PostgreSQL' (confirmed)    | |
|   |   Similarity: 0.88                                        | |
|   |                                                           | |
|   | This learning reinforces the decision. Creating.          | |
|   +-----------------------------------------------------------+ |
|                                                                |
+----------------------------------------------------------------+
```

When the learning aligns with a decision, it is informational only (no block).
When it contradicts a decision, it is a warning (similar to 3b).

---

## Priority Weighting Rules

```
+-- Priority Resolution Rules ----------------------------------+
|                                                                |
| 1. Policy > Learning (always)                                  |
|    Policies are deterministic governance. Learnings cannot      |
|    override them.                                              |
|                                                                |
| 2. Human-created > Agent-suggested                             |
|    If a human learning contradicts an agent-suggested           |
|    learning, the human learning takes precedence.              |
|                                                                |
| 3. Constraint > Instruction > Precedent                        |
|    Within the same source (both human or both agent),          |
|    type determines priority.                                   |
|                                                                |
| 4. Newer > Older (same type, same source)                      |
|    When two learnings of the same type and source conflict,    |
|    the most recently created one takes precedence.             |
|                                                                |
+----------------------------------------------------------------+
```

---

## Error Paths

### E1: Embedding Service Unavailable

```
+-- Fallback Behavior -----------------------------------------+
|                                                                |
| If embedding computation fails:                                |
|   - Human-created: learning is created without collision check |
|   - Agent-suggested: learning stays pending (fail-closed)      |
|   - Observation logged: "Learning created without collision     |
|     check due to embedding service unavailability"             |
|   - Collision check runs asynchronously when service recovers  |
|   - If collision found post-hoc, governance feed card created  |
|                                                                |
+----------------------------------------------------------------+
```

### E2: High Similarity but Not Actually Conflicting

```
+-- False Positive Example -------------------------------------+
|                                                                |
| Learning A: "Always write TypeScript, never JavaScript"        |
| Learning B: "Always use strict TypeScript compiler settings"   |
| Similarity: 0.82 (above threshold)                             |
|                                                                |
| These do not conflict -- they reinforce each other.            |
| Collision type: "overlaps" (not "contradicts")                 |
| Displayed as info, not warning.                                |
|                                                                |
+----------------------------------------------------------------+
```
