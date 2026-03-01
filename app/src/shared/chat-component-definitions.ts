import { z } from "zod";
import { ENTITY_CATEGORIES } from "./contracts";

export const extractableKindSchema = z.enum(["project", "person", "feature", "task", "decision", "question"]);

export const entityCardPropsSchema = z.object({
  kind: extractableKindSchema,
  name: z.string().min(1),
  confidence: z.number().min(0).max(1),
  status: z.string().min(1),
  entityId: z.string().optional(),
  category: z.enum(ENTITY_CATEGORIES).optional(),
});

export const extractionSummaryPropsSchema = z.object({
  title: z.string().min(1),
  entities: z.array(entityCardPropsSchema).min(1),
  relationshipCount: z.number().int().min(0),
});

export const workItemSuggestionPropsSchema = z.object({
  kind: z.enum(["task", "feature"]),
  title: z.string().min(1),
  rationale: z.string().min(1),
  project: z.string().optional(),
  priority: z.string().optional(),
  category: z.enum(ENTITY_CATEGORIES).optional(),
  possibleDuplicateId: z.string().optional(),
  possibleDuplicateName: z.string().optional(),
  possibleDuplicateSimilarity: z.number().min(0).max(1).optional(),
});

export const workItemSuggestionListPropsSchema = z.object({
  title: z.string().min(1),
  items: z.array(workItemSuggestionPropsSchema).min(1),
});

export type ExtractableKind = z.infer<typeof extractableKindSchema>;
export type EntityCardProps = z.infer<typeof entityCardPropsSchema>;
export type ExtractionSummaryProps = z.infer<typeof extractionSummaryPropsSchema>;
export type WorkItemSuggestionProps = z.infer<typeof workItemSuggestionPropsSchema>;
export type WorkItemSuggestionListProps = z.infer<typeof workItemSuggestionListPropsSchema>;

export const chatComponentDefinitions = {
  EntityCard: {
    description: "Renders one extracted entity card with kind, name, status, and confidence.",
    props: entityCardPropsSchema,
  },
  ExtractionSummary: {
    description: "Renders a batch of extracted entities and the relationship count.",
    props: extractionSummaryPropsSchema,
  },
  WorkItemSuggestion: {
    description: "Renders one PM work-item suggestion card with Accept/Dismiss actions.",
    props: workItemSuggestionPropsSchema,
  },
  WorkItemSuggestionList: {
    description: "Renders a list of PM work-item suggestions with Accept All/Dismiss All controls.",
    props: workItemSuggestionListPropsSchema,
  },
} as const;
