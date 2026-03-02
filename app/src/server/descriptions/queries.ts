import type { RecordId, Surreal } from "surrealdb";
import type { DescriptionEntry } from "./types";

export async function getDescriptionEntries(
  surreal: Surreal,
  entityRecord: RecordId,
): Promise<DescriptionEntry[]> {
  const [rows] = await surreal
    .query<[Array<{ description_entries?: DescriptionEntry[] }>]>(
      "SELECT description_entries FROM $record LIMIT 1;",
      { record: entityRecord },
    )
    .collect<[Array<{ description_entries?: DescriptionEntry[] }>]>();

  return rows[0]?.description_entries ?? [];
}
