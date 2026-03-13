# Journey: Agent Suggests a Learning (Cross-Agent Coaching Flow)

## Overview
The Observer agent scans the knowledge graph and detects that coding agents have been corrected about the same pattern across three separate sessions. It suggests a learning, which surfaces in the governance feed for Tomas to approve.

## Emotional Arc
- **Start**: Unaware (human) / Analytical (Observer)
- **Middle**: Surprised, intrigued ("the system noticed a pattern I missed")
- **End**: Impressed, trusting ("the system is getting smarter on its own")

Pattern: **Discovery Joy** (Curious -> Exploring -> Delighted)

---

## Flow Diagram

```
  [Observer scans graph]
          |
          v
  +-------------------------+
  | Detects pattern:        |
  | 3 corrections about     |
  | "null vs undefined"     |
  | across sessions         |
  +-------------------------+
          |
          v
  +-------------------------+
  | Check: similar active   |
  | learning exists?        |
  +-------------------------+
       |            |
    [Yes]        [No]
       |            |
       v            v
   (skip --     +-------------------------+
    already     | Create suggestion:      |
    covered)    | status: pending_approval |
                | suggested_by: observer   |
                | target_agents: [code_agent] |
                | evidence: [session refs] |
                +-------------------------+
                         |
                         v
                +-------------------------+
                | Governance feed card    |
                | appears for Tomas       |
                | (yellow tier)           |
                +-------------------------+
                         |
              +----------+----------+
              |          |          |
         [Approve]  [Edit &    [Dismiss]
              |     Approve]       |
              v          |         v
         +--------+     |    +---------+
         | active |     |    |dismissed|
         +--------+     |    +---------+
                        v
                 +-------------+
                 | Edit modal  |
                 | then active |
                 +-------------+
```

---

## Step-by-Step with Emotional Annotations

### Step 1: Pattern Detection (Background)
**Emotional state**: N/A (automated process)
**Actor**: Observer agent during scheduled graph scan

```
+-- Observer Internal Process -----------------------------------+
|                                                                |
|  Graph scan: correction patterns                               |
|                                                                |
|  Pattern detected:                                             |
|    Topic: "null vs undefined in domain data"                   |
|    Occurrences: 3 corrections across 3 sessions                |
|    Sessions:                                                   |
|      - agent_session:a1b2c3 (Mar 5) -- Tomas corrected code   |
|      - agent_session:d4e5f6 (Mar 8) -- Tomas corrected code   |
|      - agent_session:g7h8i9 (Mar 11) -- Tomas corrected code  |
|    Target agents: code_agent                                   |
|    Confidence: 0.89                                            |
|                                                                |
|  Check existing learnings: no match found                      |
|  Action: create pending learning suggestion                    |
+----------------------------------------------------------------+
```

**Design notes**:
- Observer uses embedding similarity to cluster corrections by topic
- Threshold: 3+ corrections on same topic before suggesting
- Checks existing active learnings to avoid duplicates
- Evidence refs link to specific sessions for provenance

### Step 2: Governance Feed Card
**Emotional state**: Surprised, intrigued
**Action**: Tomas sees the suggestion in the governance feed

```
+-- Governance Feed ---------------------------------------------+
|                                                                |
|  +----------------------------------------------------------+ |
|  | SUGGESTED LEARNING                           pending      | |
|  |                                                           | |
|  | "Never use null for domain data values. Represent         | |
|  |  absence with omitted optional fields (field?: Type)."    | |
|  |                                                           | |
|  | Suggested by: Observer | Confidence: 89%                  | |
|  | For: code_agent                                           | |
|  | Based on: 3 corrections across 3 sessions (Mar 5-11)      | |
|  |                                                           | |
|  | Evidence:                                                 | |
|  |   Session Mar 5: "don't use null, use undefined"          | |
|  |   Session Mar 8: "we never use null in domain data"       | |
|  |   Session Mar 11: "null is a contract violation, fix it"  | |
|  |                                                           | |
|  | [Approve]   [Edit & Approve]   [Dismiss]                  | |
|  +----------------------------------------------------------+ |
|                                                                |
|  +----------------------------------------------------------+ |
|  | SUGGESTED LEARNING                           pending      | |
|  |                                                           | |
|  | "Use RecordId objects for Surreal identifiers, never      | |
|  |  raw table:id strings in internal logic."                 | |
|  |                                                           | |
|  | Suggested by: Observer | Confidence: 82%                  | |
|  | For: code_agent, architect                                | |
|  | Based on: 2 corrections, 1 observation (Feb 28 - Mar 10)  | |
|  |                                                           | |
|  | [Approve]   [Edit & Approve]   [Dismiss]                  | |
|  +----------------------------------------------------------+ |
+----------------------------------------------------------------+
```

**Design notes**:
- Yellow-tier feed card (same visual treatment as pending suggestions)
- Shows evidence -- the actual correction quotes from sessions
- Confidence score from Observer's semantic analysis
- Three actions: Approve (as-is), Edit & Approve (refine text), Dismiss

### Step 3a: Direct Approval
**Emotional state**: Confident, efficient
**Action**: Tomas approves the learning as-is

```
+-- Approval Confirmation ---------------------------------------+
|                                                                |
|  Learning approved and activated.                              |
|                                                                |
|  "Never use null for domain data values..."                    |
|                                                                |
|  Status: Active | Applies to: code_agent                      |
|  Source: Observer suggestion (approved by Tomas Eriksson)       |
|                                                                |
|  Will be injected into code_agent prompts from next session.   |
+----------------------------------------------------------------+
```

### Step 3b: Edit and Approve
**Emotional state**: Engaged, precise
**Action**: Tomas refines the suggested text before approving

```
+-- Edit Learning -----------------------------------------------+
|                                                                |
|  Rule text (suggested by Observer):                            |
|  +----------------------------------------------------------+ |
|  | Never use null for domain data values (Surreal records,   | |
|  | API payloads, events, UI state). Represent absence with   | |
|  | omitted optional fields (field?: Type) only. If null      | |
|  | appears in domain data, treat it as a contract violation  | |
|  | and fix the producer. Do NOT sanitize/coerce it at        | |
|  | consumers.                                                | |
|  +----------------------------------------------------------+ |
|                                                                |
|  Type:  (*) Constraint   ( ) Instruction   ( ) Precedent      |
|                                                                |
|  Applies to:                                                   |
|  [x] code_agent    [x] chat_agent   [ ] pm_agent              |
|  [ ] architect     [ ] observer     [ ] design_partner         |
|                                                                |
|              [Cancel]   [Save & Activate]                      |
+----------------------------------------------------------------+
```

### Step 3c: Dismiss
**Emotional state**: Decisive
**Action**: Tomas dismisses a low-quality suggestion

```
+-- Dismiss Learning --------------------------------------------+
|                                                                |
|  Dismiss this learning suggestion?                             |
|                                                                |
|  Reason (optional):                                            |
|  +----------------------------------------------------------+ |
|  | This is too specific to one project, not workspace-wide.  | |
|  +----------------------------------------------------------+ |
|                                                                |
|  [Cancel]   [Dismiss]                                          |
+----------------------------------------------------------------+
```

**Design notes**:
- Dismissal reason is optional but helps Observer learn
- Dismissed learnings are retained in history, not deleted
- Dismissal feeds back into Observer's suggestion quality

---

## Cross-Agent Coaching Detail

### Agent A suggests learning for Agent B

```
  [PM Agent notices pattern]
          |
          v
  "Coding agents keep creating tasks without
   linking to the parent feature. This causes
   orphaned work items."
          |
          v
  +-------------------------------+
  | Learning suggestion:          |
  | suggested_by: pm_agent        |
  | target_agents: [code_agent]   |
  | type: instruction             |
  | text: "When creating tasks,   |
  |  always link to parent feature|
  |  via belongs_to relation."    |
  +-------------------------------+
          |
          v
  [Governance feed for Tomas]
```

**Design notes**:
- Any agent can suggest learnings for any other agent
- The governance feed shows who suggested and who it targets
- Human always approves cross-agent coaching

---

## Error Paths

### E1: Low-Confidence Suggestion
Observer detects a pattern with only 2 occurrences (below threshold).

- Suggestion is NOT created
- Observer logs an observation instead: "Emerging pattern: null usage corrections (2 occurrences). Monitoring for recurrence."
- If pattern reaches threshold later, suggestion is created with full evidence chain

### E2: Existing Active Learning Covers Pattern
Observer detects a pattern but an active learning already addresses it.

- Observer skips suggestion creation
- Optionally creates an observation: "Active learning already covers this pattern. Agent may not be applying it correctly."
- This surfaces a different problem -- learning injection failure rather than missing learning
