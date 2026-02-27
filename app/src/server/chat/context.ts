import { RecordId, Surreal } from "surrealdb";
import {
  listConversationEntities,
  listWorkspaceOpenQuestions,
  listWorkspaceProjectSummaries,
  listWorkspaceRecentDecisions,
  type ConversationEntity,
  type WorkspaceDecisionSummary,
  type WorkspaceProjectSummary,
  type WorkspaceQuestionSummary,
} from "../graph/queries";
import { chatComponentSystemPrompt } from "./chat-component-system-prompt";

export type ChatContext = {
  conversationEntities: ConversationEntity[];
  workspaceSummary: {
    projects: WorkspaceProjectSummary[];
    recentDecisions: WorkspaceDecisionSummary[];
    openQuestions: WorkspaceQuestionSummary[];
  };
};

type ChatContextLoaders = {
  listConversationEntities: typeof listConversationEntities;
  listWorkspaceProjectSummaries: typeof listWorkspaceProjectSummaries;
  listWorkspaceRecentDecisions: typeof listWorkspaceRecentDecisions;
  listWorkspaceOpenQuestions: typeof listWorkspaceOpenQuestions;
};

export async function buildChatContext(input: {
  surreal: Surreal;
  conversationRecord: RecordId<"conversation", string>;
  workspaceRecord: RecordId<"workspace", string>;
  loaders?: ChatContextLoaders;
}): Promise<ChatContext> {
  const loaders = input.loaders ?? {
    listConversationEntities,
    listWorkspaceProjectSummaries,
    listWorkspaceRecentDecisions,
    listWorkspaceOpenQuestions,
  };

  const [conversationEntities, projects, recentDecisions, openQuestions] = await Promise.all([
    loaders.listConversationEntities({
      surreal: input.surreal,
      conversationRecord: input.conversationRecord,
      workspaceRecord: input.workspaceRecord,
      limit: 60,
    }),
    loaders.listWorkspaceProjectSummaries({
      surreal: input.surreal,
      workspaceRecord: input.workspaceRecord,
      limit: 20,
    }),
    loaders.listWorkspaceRecentDecisions({
      surreal: input.surreal,
      workspaceRecord: input.workspaceRecord,
      limit: 12,
    }),
    loaders.listWorkspaceOpenQuestions({
      surreal: input.surreal,
      workspaceRecord: input.workspaceRecord,
      limit: 12,
    }),
  ]);

  return {
    conversationEntities,
    workspaceSummary: {
      projects,
      recentDecisions,
      openQuestions,
    },
  };
}

function formatConversationEntities(entities: ConversationEntity[]): string {
  if (entities.length === 0) {
    return "- none";
  }

  return entities
    .slice(0, 20)
    .map((entity) => `- ${entity.kind}: ${entity.name} (confidence ${entity.confidence.toFixed(2)})`)
    .join("\n");
}

function formatProjectList(projects: WorkspaceProjectSummary[]): string {
  if (projects.length === 0) {
    return "- none";
  }

  return projects
    .slice(0, 15)
    .map((project) => `- ${project.name} [id: ${project.id}] active tasks: ${project.activeTaskCount}`)
    .join("\n");
}

function formatDecisionList(decisions: WorkspaceDecisionSummary[]): string {
  if (decisions.length === 0) {
    return "- none";
  }

  return decisions
    .slice(0, 15)
    .map((decision) => {
      const project = decision.project ? ` project: ${decision.project}` : "";
      return `- ${decision.name} [id: ${decision.id}] status: ${decision.status}${project}`;
    })
    .join("\n");
}

function formatQuestionList(questions: WorkspaceQuestionSummary[]): string {
  if (questions.length === 0) {
    return "- none";
  }

  return questions
    .slice(0, 15)
    .map((question) => {
      const project = question.project ? ` project: ${question.project}` : "";
      return `- ${question.name} [id: ${question.id}]${project}`;
    })
    .join("\n");
}

export function buildSystemPrompt(context: ChatContext): string {
  return [
    "You are an AI assistant helping manage business projects and decisions.",
    "You have access to a workspace-scoped knowledge graph stored in SurrealDB.",
    "Never assume data from other workspaces.",
    "",
    "## This Conversation",
    "Entities already extracted from this conversation:",
    formatConversationEntities(context.conversationEntities),
    "",
    "## Workspace Overview",
    "Projects:",
    formatProjectList(context.workspaceSummary.projects),
    "",
    "Recent decisions:",
    formatDecisionList(context.workspaceSummary.recentDecisions),
    "",
    "Open questions:",
    formatQuestionList(context.workspaceSummary.openQuestions),
    "",
    "## Tools",
    "Use tools for anything that needs deeper lookup, graph traversal, provenance, or decision actions.",
    "",
    "## UI Components",
    "When useful, render structured component blocks that match the available catalog.",
    chatComponentSystemPrompt,
    "",
    "## Behavior",
    "- Reference entities by name when relevant.",
    "- Check context first, then use tools when needed.",
    "- When inferring from graph data, explain rationale and cite source entity IDs.",
    "- Ask for explicit confirmation before calling confirm_decision.",
    "- Only call confirm_decision when the user clearly authorizes it in the current message.",
  ].join("\n");
}
