import { randomUUID } from "node:crypto";
import { RecordId, Surreal } from "surrealdb";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const requestTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? "120000");

const surrealUrl = process.env.SURREAL_URL ?? "ws://127.0.0.1:8000/rpc";
const surrealUsername = process.env.SURREAL_USERNAME ?? "root";
const surrealPassword = process.env.SURREAL_PASSWORD ?? "root";
const surrealNamespace = process.env.SURREAL_NAMESPACE ?? "brain";
const surrealDatabase = process.env.SURREAL_DATABASE ?? "app";

await run();

export {};

async function run(): Promise<void> {
  console.log(`Running extraction quality smoke against ${baseUrl}`);

  const create = await fetchJson<{
    workspaceId: string;
    conversationId: string;
  }>(`${baseUrl}/api/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Extraction Quality Smoke ${Date.now()}`,
      ownerDisplayName: "Marcus Stone",
    }),
  });

  const workspaceRecord = new RecordId("workspace", create.workspaceId);
  const surreal = new Surreal();
  await surreal.connect(surrealUrl);
  await surreal.signin({ username: surrealUsername, password: surrealPassword });
  await surreal.use({ namespace: surrealNamespace, database: surrealDatabase });

  try {
    const initialPeople = await loadWorkspacePeople(surreal, workspaceRecord);
    assert(initialPeople.length === 1, "workspace owner should be the only initial person");

    const placeholderEvents = await sendChatAndCollectEvents({
      workspaceId: create.workspaceId,
      conversationId: create.conversationId,
      text: "I'll describe my project",
    });

    const placeholderExtraction = placeholderEvents.find(isExtractionEvent);
    assert(Boolean(placeholderExtraction), "placeholder turn missing extraction event");
    if (placeholderExtraction && placeholderExtraction.type === "extraction") {
      const hasPlaceholderProject = placeholderExtraction.entities.some(
        (entity) => entity.kind === "project" && normalizeName(entity.text) === "my project",
      );
      assert(!hasPlaceholderProject, "placeholder phrase was extracted as a project");
    }

    const projects = await loadWorkspaceProjects(surreal, workspaceRecord);
    const persistedPlaceholderProject = projects.some((project) => normalizeName(project.name) === "my project");
    assert(!persistedPlaceholderProject, "placeholder project name was persisted");

    const unknownPersonEvents = await sendChatAndCollectEvents({
      workspaceId: create.workspaceId,
      conversationId: create.conversationId,
      text: "Person: Sarah. Decision: Use TypeScript for backend implementation.",
    });
    assert(unknownPersonEvents.some((event) => event.type === "assistant_message"), "unknown-person turn missing assistant_message");

    const peopleAfterUnknown = await loadWorkspacePeople(surreal, workspaceRecord);
    const hasSarahNode = peopleAfterUnknown.some((person) => normalizeName(person.name) === "sarah");
    assert(!hasSarahNode, "chat inference created a person node for unresolved mention");
    assert(peopleAfterUnknown.length === initialPeople.length, "person count increased from chat inference");

    const knownPersonEvents = await sendChatAndCollectEvents({
      workspaceId: create.workspaceId,
      conversationId: create.conversationId,
      text: "Marcus decided to use SurrealDB for graph persistence.",
    });

    const assistantEvent = knownPersonEvents.find(isAssistantMessageEvent);
    assert(Boolean(assistantEvent), "known-person turn missing assistant_message");
    if (assistantEvent && assistantEvent.type === "assistant_message") {
      const questionCount = [...assistantEvent.text].filter((char) => char === "?").length;
      assert(questionCount === 1, "onboarding assistant reply must contain exactly one follow-up question");
    }

    const peopleAfterKnown = await loadWorkspacePeople(surreal, workspaceRecord);
    assert(peopleAfterKnown.length === initialPeople.length, "known person mention created duplicate person node");
  } finally {
    await surreal.close();
  }

  console.log("Extraction quality smoke passed");
}

async function loadWorkspacePeople(
  surreal: Surreal,
  workspaceRecord: RecordId<"workspace", string>,
): Promise<Array<{ id: RecordId<"person", string>; name: string }>> {
  const [rows] = await surreal
    .query<[Array<{ id: RecordId<"person", string>; name: string }>]>(
      "SELECT id, name FROM person WHERE id IN (SELECT VALUE `in` FROM member_of WHERE out = $workspace);",
      {
        workspace: workspaceRecord,
      },
    )
    .collect<[Array<{ id: RecordId<"person", string>; name: string }>]>();
  return rows;
}

async function loadWorkspaceProjects(
  surreal: Surreal,
  workspaceRecord: RecordId<"workspace", string>,
): Promise<Array<{ id: RecordId<"project", string>; name: string }>> {
  const [rows] = await surreal
    .query<[Array<{ id: RecordId<"project", string>; name: string }>]>(
      "SELECT id, name FROM project WHERE id IN (SELECT VALUE out FROM has_project WHERE `in` = $workspace);",
      {
        workspace: workspaceRecord,
      },
    )
    .collect<[Array<{ id: RecordId<"project", string>; name: string }>]>();
  return rows;
}

async function sendChatAndCollectEvents(input: {
  workspaceId: string;
  conversationId: string;
  text: string;
}): Promise<SmokeStreamEvent[]> {
  const message = await fetchJson<{
    streamUrl: string;
  }>(`${baseUrl}/api/chat/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientMessageId: randomUUID(),
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      text: input.text,
    }),
  });

  return collectSseEvents(`${baseUrl}${message.streamUrl}`, requestTimeoutMs);
}

type AssistantMessageEvent = {
  type: "assistant_message";
  messageId: string;
  text: string;
};

type ExtractionEvent = {
  type: "extraction";
  messageId: string;
  entities: Array<{ kind: string; text: string }>;
  relationships: Array<{ kind: string }>;
};

type DoneEvent = {
  type: "done";
  messageId: string;
};

type ErrorEvent = {
  type: "error";
  messageId: string;
  error: string;
};

type UnknownEvent = {
  type: string;
  messageId: string;
};

type SmokeStreamEvent = AssistantMessageEvent | ExtractionEvent | DoneEvent | ErrorEvent | UnknownEvent;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed (${response.status}) ${url}: ${body}`);
  }
  return (await response.json()) as T;
}

async function collectSseEvents(streamUrl: string, timeoutMs: number): Promise<SmokeStreamEvent[]> {
  const response = await fetch(streamUrl, { headers: { Accept: "text/event-stream" } });
  if (!response.ok) {
    throw new Error(`Failed to open SSE stream (${response.status})`);
  }
  if (!response.body) {
    throw new Error("SSE stream response had no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: SmokeStreamEvent[] = [];
  let buffer = "";

  const timeout = setTimeout(() => {
    void reader.cancel();
  }, timeoutMs);

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const segments = buffer.split("\n\n");
      buffer = segments.pop() ?? "";

      for (const segment of segments) {
        const dataLine = segment
          .split("\n")
          .find((line) => line.startsWith("data: "));
        if (!dataLine) {
          continue;
        }

        const payload = dataLine.slice("data: ".length);
        const event = JSON.parse(payload) as SmokeStreamEvent;
        events.push(event);

        if (event.type === "done") {
          return events;
        }

        if (isErrorEvent(event)) {
          throw new Error(`SSE error event: ${event.error}`);
        }
      }
    }
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }

  return events;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isExtractionEvent(event: SmokeStreamEvent): event is ExtractionEvent {
  return event.type === "extraction";
}

function isAssistantMessageEvent(event: SmokeStreamEvent): event is AssistantMessageEvent {
  return event.type === "assistant_message";
}

function isErrorEvent(event: SmokeStreamEvent): event is ErrorEvent {
  return event.type === "error";
}
