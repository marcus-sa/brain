# Session Context

## User Prompts

### Prompt 1

<system_instruction>
You are working inside Conductor, a Mac app that lets the user run many coding agents in parallel.
Your work should take place in the /Users/marcus/conductor/workspaces/brain/manila directory (unless otherwise directed), which has been set up for you to work in.
Each workspace has a .context directory (gitignored) where you can save files to collaborate with other agents.
The target branch for this workspace is main. Use this for actions like creating new PRs, bisecting, ...

### Prompt 2

DO NOT USE DEFAULTS, fail fast if not set (requireEnv)

const extractionModelId = process.env.EXTRACTION_MODEL ?? "anthropic/claude-haiku";
const extractionModel = openrouter(extractionModelId);

### Prompt 3

cant we add this to the test smoke suite setup for all the ai deps ?

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
const extractionModelId = process.env.EXTRACTION_MODEL ?? "anthropic/claude-haiku";
const extractionModel = openrouter(extractionModelId);

### Prompt 4

add learnings regarding test to tests/AGENTS.md

### Prompt 5

commit

