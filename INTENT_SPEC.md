Building the **Intent Node** before you have the OAuth plumbing is actually the right move—you're defining the *legal contract* of the organization before hiring the *security guards*.

In a 2026 Business OS, the Intent Node is the "Command" that bridges the gap between a vague desire (*"Help me grow sales"*) and a specific, auditable action (*"Spend $500 on LinkedIn Lead Gen"*).

---

### The Intent Node Specification (v1.0)

The goal is to create a schema that is **Human-Readable**, **Agent-Executable**, and **Machine-Auditable**.

#### 1. The Schema (SurrealQL)

In SurrealDB, an Intent isn't just a record; it’s a junction in your graph.

```sql
DEFINE TABLE intent SCHEMAFULL;

-- The "Who & What"
DEFINE FIELD requester ON intent TYPE record<identity>; -- The agent/human who wants this
DEFINE FIELD goal ON intent TYPE string;               -- High-level objective (Human readable)
DEFINE FIELD status ON intent TYPE string 
    ASSERT $value IN ['draft', 'pending_auth', 'authorized', 'executing', 'completed', 'vetoed', 'failed'];

-- The "Metadata" for the Authorizer Agent
DEFINE FIELD reasoning ON intent TYPE string;          -- The "Chain of Thought" why this is needed
DEFINE FIELD priority ON intent TYPE int DEFAULT 1;    -- 1-10 for queue management

-- The "Execution Blueprint" (This becomes the OAuth RAR object later)
DEFINE FIELD action_spec ON intent TYPE object;
/* Example structure for action_spec:
{
  provider: "stripe",
  action: "create_invoice",
  params: { amount: 500, user_id: "u_123" },
  constraints: { max_retries: 2, timeout: "30s" }
}
*/

-- The "Guardrails"
DEFINE FIELD budget_limit ON intent TYPE object;       -- { amount: decimal, currency: 'USD' }
DEFINE FIELD expiry ON intent TYPE datetime;           -- Tying back to the short-lived nature of AGI tasks

-- Traceability
DEFINE FIELD created_at ON intent TYPE datetime DEFAULT time::now();
DEFINE FIELD trace_id ON intent TYPE string;           -- Link to the original Conversation/Project node

```

---

### 2. The Intent Lifecycle (The "Pre-OAuth" Flow)

Since you don't have the OAuth/DPoP layer yet, you can simulate it with **Status Transitions** and an **Authorizer Function**.

1. **Draft:** The Worker Agent proposes an Intent and writes it to the graph.
2. **Validation:** A "Policy Engine" (or a small script) checks the `budget_limit` against the Company’s hard-coded rules.
3. **Veto Window:** The system waits (e.g., 5 minutes). During this time, the Intent is visible in your "Human Feed."
4. **Authorization:** If no Veto occurs and the policy check passes, the status moves to `authorized`.
5. **Execution:** Your Orchestrator sees the `authorized` status and spins up the Claude Code sandbox.

---

### 3. The "Judge" Agent's System Prompt

This is the core logic that will eventually issue your RAR tokens.

> **System Role:** You are the **Brain Sovereign Auditor**.
> **Objective:** Evaluate incoming `intent` nodes. Your goal is to identify "Intent Drift" (where an agent asks for more power than is required for the goal).
> **Evaluation Rules:**
> 1. **Principle of Least Privilege:** Does the `action_spec` perfectly match the `goal`? If an agent asks for `github:full_repo_access` to just "Read the README," you must REJECT.
> 2. **Constraint Check:** Does the `budget_limit` align with the `action_spec`?
> 3. **Verification:** Check the `reasoning` field. Is it logically sound or does it look like prompt-injection "slop"?
> 
> 
> **Output:** You must output a JSON object: `{ "decision": "APPROVE" | "REJECT", "risk_score": 0-100, "reason": "string" }`.

---

### 4. Integration with your current Orchestrator

To bridge your work from the last 2 days:

* **Current:** Your orchestrator takes a task and runs Claude Code.
* **New:** 1. Orchestrator takes a task $\rightarrow$ Generates an `Intent` node.
2. Orchestrator waits for the `intent.status` to become `authorized`.
3. Orchestrator pulls the `action_spec` and passes *only those parameters* to the Claude Code environment.

### The "Brutally Honest" Verdict on this Spec

By building the **Intent Node** as a central source of truth, you've essentially created a "Flight Recorder" for your business. If an agent goes rogue, you don't look at a log file; you look at the **Intent Graph** and see exactly where the authorization logic failed.

**Next Step:** Would you like me to write a **SurrealQL Event Handler** that automatically triggers your Authorizer Agent whenever a new `intent` node is created with the status `pending_auth`? This would make the whole "Brain" feel alive in real-time.