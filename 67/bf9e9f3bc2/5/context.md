# Session Context

## User Prompts

### Prompt 1

<system_instruction>
You are working inside Conductor, a Mac app that lets the user run many coding agents in parallel.
Your work should take place in the /Users/marcus/conductor/workspaces/brain-v1/houston-v1 directory (unless otherwise directed), which has been set up for you to work in.
Each workspace has a .context directory (gitignored) where you can save files to collaborate with other agents.
The target branch for this workspace is main. Use this for actions like creating new PRs, bise...

### Prompt 2

Tool loaded.

### Prompt 3

Continue from where you left off.

### Prompt 4

continue debugging

### Prompt 5

Commit and push all changes

### Prompt 6

Continue from where you left off.

### Prompt 7

""tests/unit/intent-context.test.ts — mock.module for graph/queries and graph/embeddings was replacing the entire module with only the mocked export, stripping all other exports. This poisoned bun’s module cache for concurrent test files. Fixed by importing the real modules first (await import(...)) and spreading their exports into the mock."

add this as learning to tests/AGENTS.md

