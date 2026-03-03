import { tool } from "ai";
import { z } from "zod";
import { RecordId, type Surreal } from "surrealdb";

/** Known entity tables and the field that holds their display name. */
const ENTITY_NAME_FIELDS: Record<string, string> = {
  project: "name",
  feature: "name",
  person: "name",
  task: "title",
  decision: "summary",
  question: "text",
  observation: "text",
};

export type EntityRef = {
  entityId: string;
  kind: string;
  name: string;
  status?: string;
};

/**
 * Walk query result rows and extract unique entity references.
 * A reference is any RecordId whose table is a known entity type.
 * The display name and status are read from sibling fields in the same row.
 */
export function extractEntityRefs(rows: unknown[]): EntityRef[] {
  const seen = new Set<string>();
  const refs: EntityRef[] = [];

  for (const row of rows) {
    if (row == null || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;

    for (const value of Object.values(record)) {
      if (!(value instanceof RecordId)) continue;

      const table = value.table.name;
      if (!(table in ENTITY_NAME_FIELDS)) continue;

      const key = `${table}:${value.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const nameField = ENTITY_NAME_FIELDS[table];
      const name = typeof record[nameField] === "string"
        ? (record[nameField] as string)
        : key;

      const ref: EntityRef = { entityId: key, kind: table, name };
      if (typeof record.status === "string") {
        ref.status = record.status as string;
      }
      refs.push(ref);
    }
  }

  return refs;
}

export function createAnalyticsTools(analyticsSurreal: Surreal) {
  return {
    execute_analytics_query: tool({
      description:
        "Execute a read-only SurrealQL SELECT query against the knowledge graph. Use parameterized queries ($param syntax) for any dynamic values. Always include a LIMIT clause.",
      inputSchema: z.object({
        intent: z.string().min(1).describe("What you are trying to learn from this query"),
        query: z.string().min(1).describe("The SurrealQL SELECT query to execute"),
        parameters: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Query parameters as key-value pairs, referenced as $key in the query"),
      }),
      execute: async (input) => {
        console.log("[analytics] query:", input.query);
        if (input.parameters) console.log("[analytics] params:", JSON.stringify(input.parameters));
        try {
          const result = await analyticsSurreal.query(input.query, input.parameters ?? {});
          const rows = Array.isArray(result) ? result.flat() : [result];
          const referenced_entities = extractEntityRefs(rows);
          console.log("[analytics] result: %d rows, %d entity refs", rows.length, referenced_entities.length, JSON.stringify(rows).slice(0, 500));
          return {
            success: true as const,
            result: rows,
            row_count: rows.length,
            referenced_entities,
          };
        } catch (error) {
          console.log("[analytics] error:", error instanceof Error ? error.message : String(error));
          return {
            success: false as const,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    }),
  };
}
