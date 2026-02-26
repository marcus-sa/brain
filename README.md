Right. People are workspace-level entities, not project-scoped. A person works across multiple projects — that's the whole point of cross-project intelligence. "Marcus is overcommitted" only works if you can see his tasks across all projects in the workspace.

The hierarchy is:

```
Workspace
  ├── Person (MEMBER_OF workspace)
  ├── Conversation (scoped to workspace, not project)
  └── Project
       └── Feature → Task / Decision / Question
```

People and conversations float at the workspace level. Entities extracted from conversations get linked *down* to projects by the extraction pipeline. People get linked *across* to whatever they touch — tasks, decisions, ownership — regardless of which project those live in.

This is already how the schema has `MEMBER_OF` (Person → Workspace) and `OWNS` (Person → Task/Project/Feature). Just need to make sure the plan is explicit that conversations follow the same pattern and that `projectId` is never a required scope on conversations or people.

Let me update.Now update the entity types table to clarify scoping:Updated. The key changes:

- **Entity hierarchy** now shows the two-tier structure: workspace-level (Person, Conversation, Meeting) and project-level (Feature, Task, Decision, Question) as visually distinct
- **Scoping rules** section is explicit: `workspaceId` required on every write, `projectId` never required on conversations or people, project assignment on extracted entities resolved by the pipeline
- **Entity types table** has a new Scope column making it immediately clear which entities float at workspace level vs. live inside projects
- Person and Conversation moved above Project in the table to reinforce they're peers at the workspace level, not children of projects