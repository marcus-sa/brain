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
  console.log(`Running README import smoke against ${baseUrl}`);

  const readmeFile = Bun.file(new URL("../../README.md", import.meta.url));
  const readmeText = await readmeFile.text();
  assert(readmeText.trim().length > 0, "README.md is empty");

  const create = await fetchJson<{
    workspaceId: string;
    conversationId: string;
  }>(`${baseUrl}/api/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `README Smoke ${Date.now()}`,
      ownerDisplayName: "README Smoke Owner",
    }),
  });

  const workspaceRecord = new RecordId("workspace", create.workspaceId);

  const uploadForm = new FormData();
  uploadForm.set("clientMessageId", randomUUID());
  uploadForm.set("workspaceId", create.workspaceId);
  uploadForm.set("conversationId", create.conversationId);
  uploadForm.set("text", "Importing README.md for smoke validation.");
  uploadForm.set("file", new File([readmeText], "README.md", { type: "text/markdown" }));

  const uploadResponse = await fetchJson<{
    streamUrl: string;
  }>(`${baseUrl}/api/chat/messages`, {
    method: "POST",
    body: uploadForm,
  });

  const events = await collectSseEvents(`${baseUrl}${uploadResponse.streamUrl}`, requestTimeoutMs);
  assert(events.some((event) => event.type === "assistant_message"), "stream missing assistant_message");
  assert(events.some((event) => event.type === "done"), "stream missing done event");

  const surreal = new Surreal();
  await surreal.connect(surrealUrl);
  await surreal.signin({ username: surrealUsername, password: surrealPassword });
  await surreal.use({ namespace: surrealNamespace, database: surrealDatabase });

  try {
    const [documentRows] = await surreal
      .query<[Array<{ id: RecordId<"document", string> }>]>(
        "SELECT id FROM document WHERE workspace = $workspace AND name = $name ORDER BY uploaded_at DESC LIMIT 1;",
        {
          workspace: workspaceRecord,
          name: "README.md",
        },
      )
      .collect<[Array<{ id: RecordId<"document", string> }>]>();

    assert(documentRows.length > 0, "README.md document record was not created");

    const documentRecord = documentRows[0].id;
    const [chunkRows] = await surreal
      .query<[Array<{ id: RecordId<"document_chunk", string> }>]>(
        "SELECT id FROM document_chunk WHERE document = $document LIMIT 1;",
        {
          document: documentRecord,
        },
      )
      .collect<[Array<{ id: RecordId<"document_chunk", string> }>]>();

    assert(chunkRows.length > 0, "README.md document chunks were not created");
  } finally {
    await surreal.close();
  }

  console.log("README import smoke passed");
}

type SmokeStreamEvent =
  | {
      type: "assistant_message";
      messageId: string;
      text: string;
    }
  | {
      type: "done";
      messageId: string;
    }
  | {
      type: "error";
      messageId: string;
      error: string;
    }
  | {
      type: string;
      messageId: string;
    };

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

        if (event.type === "error" && "error" in event) {
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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
