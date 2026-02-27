import { componentCatalog } from "reachat";
import { chatComponentDefinitions } from "../../shared/chat-component-definitions";

const noopComponent = (() => null) as any;

export const chatComponentSystemPrompt = componentCatalog({
  EntityCard: {
    ...chatComponentDefinitions.EntityCard,
    component: noopComponent,
  },
  ExtractionSummary: {
    ...chatComponentDefinitions.ExtractionSummary,
    component: noopComponent,
  },
}).systemPrompt();
