import { createCheckConstraintsTool } from "./check-constraints";
import { createConfirmDecisionTool } from "./confirm-decision";
import { createCreateProvisionalDecisionTool } from "./create-provisional-decision";
import { createGetConversationHistoryTool } from "./get-conversation-history";
import { createGetEntityDetailTool } from "./get-entity-detail";
import { createGetProjectStatusTool } from "./get-project-status";
import { createResolveDecisionTool } from "./resolve-decision";
import { createSearchEntitiesTool } from "./search-entities";
import type { ChatToolDeps } from "./types";

export function createChatTools(deps: ChatToolDeps) {
  return {
    search_entities: createSearchEntitiesTool(deps),
    get_entity_detail: createGetEntityDetailTool(deps),
    get_project_status: createGetProjectStatusTool(deps),
    get_conversation_history: createGetConversationHistoryTool(deps),
    resolve_decision: createResolveDecisionTool(deps),
    check_constraints: createCheckConstraintsTool(deps),
    create_provisional_decision: createCreateProvisionalDecisionTool(deps),
    confirm_decision: createConfirmDecisionTool(deps),
  };
}

export type { ChatToolDeps, ChatToolExecutionContext } from "./types";
