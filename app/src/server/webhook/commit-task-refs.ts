const SINGLE_TASK_REGEX = /\btask:([A-Za-z0-9_-]+)\b/gi;
const TASK_LIST_REGEX = /\btasks:\s*([^\n\r;]+)/gi;
const TASK_TOKEN_REGEX = /^[A-Za-z0-9_-]+$/;

function isLikelyTaskId(value: string): boolean {
  if (!TASK_TOKEN_REGEX.test(value)) return false;
  if (value.length < 4) return false;
  return /\d/.test(value);
}

export function extractReferencedTaskIds(message: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  const add = (raw: string): void => {
    const id = raw.trim();
    if (!isLikelyTaskId(id)) return;
    if (id.includes(":")) return;
    if (seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };

  for (const match of message.matchAll(SINGLE_TASK_REGEX)) {
    add(match[1] as string);
  }

  for (const match of message.matchAll(TASK_LIST_REGEX)) {
    const segment = (match[1] as string).trim();
    if (segment.length === 0) continue;
    for (const token of segment.split(/[,\s]+/)) {
      add(token);
    }
  }

  return ids;
}
