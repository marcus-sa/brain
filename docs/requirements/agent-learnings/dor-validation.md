# Definition of Ready Validation: Agent Learnings Stories

## US-AL-005: Learning Entity Schema

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "No structured entity to store, query, version, or inject behavioral learnings" -- clear domain language |
| User/persona identified | PASS | System (schema layer) -- infrastructure story linked to all user-facing stories |
| 3+ domain examples | PASS | 3 examples: human-created constraint, agent-suggested with evidence, superseded learning |
| UAT scenarios (3-7) | PASS | 5 scenarios: table creation, human record, agent record, status transition, supersession |
| AC derived from UAT | PASS | 9 AC items derived from scenarios covering schema, constraints, indexes, migration |
| Right-sized | PASS | 1-2 days effort (schema migration + indexes), 5 scenarios |
| Technical notes | PASS | Schema patterns, HNSW index, migration file naming, relation tables documented |
| Dependencies tracked | PASS | No dependencies (foundation). Enables: AL-001, AL-002, AL-003, AL-004 |

**DoR Status**: PASSED

---

## US-AL-001: Human Creates Persistent Learning

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "Exhausting to repeat same corrections... agents forget between sessions... 2-3 minutes per correction" |
| User/persona identified | PASS | Tomas Eriksson, workspace owner, 3-person team, corrected coding agent 12 times this month |
| 3+ domain examples | PASS | 3 examples: null-usage constraint, project-scoped precedent, duplicate detection |
| UAT scenarios (3-7) | PASS | 5 scenarios: save from chat, editor pre-fill, immediate active, duplicate, conflict |
| AC derived from UAT | PASS | 7 AC items covering detection, editor, status, schema, duplicate/conflict |
| Right-sized | PASS | 2-3 days effort (chat detection + editor + save flow), 5 scenarios |
| Technical notes | PASS | Schema patterns, embedding, KNN search, UI component, correction detection |
| Dependencies tracked | PASS | Depends on AL-005 (schema), AL-003 (injection). Enables AL-004 |

**DoR Status**: PASSED

---

## US-AL-002: Agent Suggests a Behavioral Learning

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "Observer can only log observations, cannot propose persistent behavioral changes" |
| User/persona identified | PASS | Observer agent + PM agent (system actors), Tomas Eriksson (approver) |
| 3+ domain examples | PASS | 3 examples: Observer correction pattern, cross-agent coaching, below-threshold skip |
| UAT scenarios (3-7) | PASS | 5 scenarios: pattern detection, skip covered, below threshold, cross-agent, feed card |
| AC derived from UAT | PASS | 7 AC items covering suggestion creation, threshold, dedup, cross-agent, feed |
| Right-sized | PASS | 2-3 days effort (pattern detection + suggestion creation + feed integration), 5 scenarios |
| Technical notes | PASS | Embedding clustering, Observer loop, feed card pattern, configurable thresholds |
| Dependencies tracked | PASS | Depends on AL-005 (schema), AL-004 (feed). Depends on Observer infrastructure |

**DoR Status**: PASSED

---

## US-AL-003: JIT Learning Injection into Agent Prompts

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "Agent prompts are static... every session starts from zero knowledge of workspace conventions" |
| User/persona identified | PASS | System (prompt builder), Tomas Eriksson (observer of behavior) |
| 3+ domain examples | PASS | 3 examples: 4 learnings injected, token budget exceeded, no learnings for agent type |
| UAT scenarios (3-7) | PASS | 5 scenarios: chat prompt injection, MCP packet, budget enforcement, empty, conflict |
| AC derived from UAT | PASS | 7 AC items covering shared function, sort, budget, formatting, injection points, empty, overflow |
| Right-sized | PASS | 2 days effort (query + sort + format + 4 injection points), 5 scenarios |
| Technical notes | PASS | Injection point files listed, token heuristic, query pattern, KNN bug, section placement |
| Dependencies tracked | PASS | Depends on AL-005 (schema), AL-001 or AL-002 (content). Independent of AL-004 |

**DoR Status**: PASSED

---

## US-AL-004: Learning Governance Feed Cards

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "Agent-suggested learnings pile up unreviewed... no way to see them in governance feed" |
| User/persona identified | PASS | Tomas Eriksson, workspace owner, reviews governance feed daily |
| 3+ domain examples | PASS | 3 examples: approve high-confidence, edit-and-approve, dismiss low-confidence |
| UAT scenarios (3-7) | PASS | 6 scenarios: feed card display, approve, edit, dismiss, filter, evidence drill-down |
| AC derived from UAT | PASS | 7 AC items covering card display, approve/edit/dismiss flows, filter, evidence |
| Right-sized | PASS | 2-3 days effort (feed query + card component + 3 actions), 6 scenarios |
| Technical notes | PASS | Feed infrastructure reuse, card pattern, status transitions, editor reuse |
| Dependencies tracked | PASS | Depends on AL-005 (schema), AL-002 (suggestions). Depends on feed infrastructure |

**DoR Status**: PASSED

---

## US-AL-006: Learning Conflict Detection

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "Two contradictory rules... neither noticed the conflict... agent behaves unpredictably" |
| User/persona identified | PASS | System (conflict detector), Tomas Eriksson (resolver) |
| 3+ domain examples | PASS | 3 examples: conflict at creation, non-conflicting similar, retrospective scan |
| UAT scenarios (3-7) | PASS | 5 scenarios: creation-time conflict, duplicate, non-conflicting, supersession, retrospective |
| AC derived from UAT | PASS | 7 AC items covering similarity thresholds, warnings, resolution options, supersession, scan |
| Right-sized | PASS | 2-3 days effort (similarity search + intent analysis + UI warnings), 5 scenarios |
| Technical notes | PASS | Embedding pipeline, LLM intent analysis, KNN pattern, Observer integration, thresholds |
| Dependencies tracked | PASS | Depends on AL-005 (schema). Optional enhancement for AL-001, AL-004 |

**DoR Status**: PASSED

---

## Summary

| Story | DoR Status | Effort Est. | Scenarios | Priority |
|-------|-----------|-------------|-----------|----------|
| US-AL-005: Learning Schema | PASSED | 1-2 days | 5 | Must Have (foundation) |
| US-AL-001: Human Creates Learning | PASSED | 2-3 days | 5 | Must Have |
| US-AL-003: Runtime Injection | PASSED | 2 days | 5 | Must Have |
| US-AL-004: Governance Feed Cards | PASSED | 2-3 days | 6 | Should Have |
| US-AL-002: Agent Suggests Learning | PASSED | 2-3 days | 5 | Should Have |
| US-AL-006: Conflict Detection | PASSED | 2-3 days | 5 | Should Have |

### Recommended Implementation Order
1. **US-AL-005** (Schema) -- foundation, no dependencies
2. **US-AL-001** (Human Creates) + **US-AL-003** (Injection) -- parallel, deliver core value together
3. **US-AL-004** (Feed Cards) -- enables governance for agent suggestions
4. **US-AL-002** (Agent Suggests) -- depends on feed cards for review
5. **US-AL-006** (Conflict Detection) -- enhancement layer
