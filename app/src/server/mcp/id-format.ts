import type { RecordId } from "surrealdb";

export function toRawId(record: RecordId<string, string>): string {
  return record.id as string;
}

export function requireRawId(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${field} is required`);
  }
  if (normalized.includes(":")) {
    throw new Error(`${field} must be a raw id without table prefix`);
  }
  return normalized;
}
