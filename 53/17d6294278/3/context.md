# Session Context

## User Prompts

### Prompt 1

<system_instruction>
You are working inside Conductor, a Mac app that lets the user run many coding agents in parallel.
Your work should take place in the /Users/marcus/conductor/workspaces/brain-v1/karachi directory (unless otherwise directed), which has been set up for you to work in.
Each workspace has a .context directory (gitignored) where you can save files to collaborate with other agents.
The target branch for this workspace is main. Use this for actions like creating new PRs, bisecti...

### Prompt 2

The **Observer Agent** acts as the detective, but the **Learning Agent** acts as the judge. For the Observer to suggest a learning, it has to move from **Reporting** (what happened) to **Diagnostic** (why the gap between intent and reality exists).

In the architecture, the "Suggestion" is a **Learning Proposal Node** that acts as a bridge between a failed reality and a new policy.

---

### 1. The "Discrepancy" Logic

The Observer's suggestion is triggered by a **State Mismatch**. It compare...

