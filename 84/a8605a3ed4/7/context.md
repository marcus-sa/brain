# Session Context

## User Prompts

### Prompt 1

<system_instruction>
You are working inside Conductor, a Mac app that lets the user run many coding agents in parallel.
Your work should take place in the /Users/marcus/conductor/workspaces/brain-v1/houston-v1 directory (unless otherwise directed), which has been set up for you to work in.
Each workspace has a .context directory (gitignored) where you can save files to collaborate with other agents.
The target branch for this workspace is main. Use this for actions like creating new PRs, bise...

### Prompt 2

# NW-REVIEW: Expert Critique and Quality Assurance

**Wave**: CROSS_WAVE
**Agent**: Dynamic (nw-*-reviewer)

## Overview

Dispatches expert reviewer agent to critique workflow artifacts. Takes base agent name, appends `-reviewer`, invokes with artifact. Reviewer agent owns all review methodology|criteria|output format.

## Review Philosophy: Radical Candor

Every review MUST embody Radical Candor — kind AND clear, specific AND sincere:

- **Care personally**: Acknowledge what works. Understan...

### Prompt 3

# NW-DISCUSS: Jobs-to-be-Done Analysis, UX Journey Design, and Requirements Gathering

**Wave**: DISCUSS (wave 2 of 6) | **Agent**: Luna (nw-product-owner) | **Command**: `/nw:discuss`

## Overview

Execute DISCUSS wave through Luna's integrated workflow: JTBD analysis|UX journey discovery|emotional arc design|shared artifact tracking|requirements gathering|user story creation|acceptance criteria definition. Luna uncovers jobs users accomplish, maps to journeys and requirements, handles compl...

### Prompt 4

# NW-DESIGN: Architecture Design

**Wave**: DESIGN (wave 3 of 6) | **Agents**: Morgan (nw-solution-architect) | **Command**: `*design-architecture`

## Overview

Execute DESIGN wave through discovery-driven architecture design. Morgan asks about business drivers and constraints first, then recommends architecture that fits. Analyzes existing codebase, evaluates open-source alternatives, produces C4 diagrams (Mermaid) as mandatory output.

## Context Files Required

- docs/feature/{feature-nam...

### Prompt 5

Stop hook feedback:
Prompt hook condition was not met: The Brain MCP tools are not available in this session. These tools would be needed to log decisions, observations, and suggestions to the project knowledge graph: mcp__plugin_claude-mem_mcp-search__* functions for querying and storing items. Cannot proceed with logging without access to the memory system.

### Prompt 6

create github issue for gap 2 and implement gap 1 with acceptance tests and evals

### Prompt 7

what about `isAlreadyObserved` ? i dont understand why this is doing text comparison in js?


i dont understand observationText and anomalyCandidates. explain to me why  these are hardcoded text/detail?

### Prompt 8

create gh issue for "It’s a pragmatic hack, not ideal. It could be replaced with a content hash stored on the observation record, or semantic dedup via embedding similarity. The 80-char prefix is brittle — if the LLM changes reasoning phrasing between scans, it won’t dedup."

### Prompt 9

Stop hook feedback:
Prompt hook condition was not met: Brain MCP tools are not available in this session. Cannot log decisions, questions, observations, or suggestions without access to the memory system.

