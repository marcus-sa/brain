const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const requestTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? "120000");

await run();

export {};

async function run(): Promise<void> {
  console.log(`Running onboarding smoke against ${baseUrl}`);

  const create = await fetchJson<{
    workspaceId: string;
    workspaceName: string;
    conversationId: string;
    onboardingComplete: boolean;
  }>(`${baseUrl}/api/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Smoke Workspace ${Date.now()}`,
      ownerDisplayName: "Smoke Owner",
    }),
  });

  assert(typeof create.workspaceId === "string" && create.workspaceId.length > 0, "workspaceId missing");
  assert(create.onboardingComplete === false, "workspace should start with onboarding incomplete");

  const bootstrap = await fetchJson<{
    workspaceId: string;
    conversationId: string;
    onboardingState: string;
    messages: Array<{ role: string; text: string }>;
    seeds: Array<{ id: string }>;
  }>(`${baseUrl}/api/workspaces/${encodeURIComponent(create.workspaceId)}/bootstrap`);

  assert(bootstrap.workspaceId === create.workspaceId, "bootstrap workspace mismatch");
  assert(bootstrap.conversationId === create.conversationId, "bootstrap conversation mismatch");
  assert(bootstrap.messages.length > 0, "bootstrap starter message missing");

  const firstChat = await fetchJson<{
    messageId: string;
    userMessageId: string;
    conversationId: string;
    workspaceId: string;
    streamUrl: string;
  }>(`${baseUrl}/api/chat/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientMessageId: crypto.randomUUID(),
      workspaceId: create.workspaceId,
      conversationId: create.conversationId,
      text: "Project: Brain Platform. Decision: use TypeScript first. Question: how to handle SurrealDB scaling risk?",
    }),
  });

  const firstEvents = await collectSseEvents(`${baseUrl}${firstChat.streamUrl}`, requestTimeoutMs);
  assert(firstEvents.some((event) => event.type === "extraction"), "first stream missing extraction");

  const uploadForm = new FormData();
  uploadForm.set("clientMessageId", crypto.randomUUID());
  uploadForm.set("workspaceId", create.workspaceId);
  uploadForm.set("conversationId", create.conversationId);
  uploadForm.set("text", "Uploading initial plan document");
  uploadForm.set(
    "file",
    new File(
      [[
        "# Product Plan\n",
        "## Current Project\n",
        "We are building Brain Platform onboarding.\n",
        "## Decision\n",
        "Choose SurrealDB with strict schemafull discipline.\n",
        "## Bottleneck\n",
        "Unclear integration sequencing across tools.\n",
      ].join("")],
      "plan.md",
      { type: "text/markdown" },
    ),
  );

  const uploadResponse = await fetchJson<{
    messageId: string;
    userMessageId: string;
    conversationId: string;
    workspaceId: string;
    streamUrl: string;
  }>(`${baseUrl}/api/chat/messages`, {
    method: "POST",
    body: uploadForm,
  });

  const uploadEvents = await collectSseEvents(`${baseUrl}${uploadResponse.streamUrl}`, requestTimeoutMs);
  assert(uploadEvents.some((event) => event.type === "onboarding_seed"), "upload stream missing onboarding_seed");

  const confirm = await fetchJson<{
    messageId: string;
    userMessageId: string;
    conversationId: string;
    workspaceId: string;
    streamUrl: string;
  }>(`${baseUrl}/api/chat/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientMessageId: crypto.randomUUID(),
      workspaceId: create.workspaceId,
      conversationId: create.conversationId,
      text: "Looks good, let's go.",
    }),
  });

  await collectSseEvents(`${baseUrl}${confirm.streamUrl}`, requestTimeoutMs);

  const finalBootstrap = await fetchJson<{
    onboardingComplete: boolean;
    onboardingState: string;
    seeds: Array<{ sourceKind: string; sourceId: string }>;
  }>(`${baseUrl}/api/workspaces/${encodeURIComponent(create.workspaceId)}/bootstrap`);

  assert(finalBootstrap.seeds.length > 0, "expected seeded entities after onboarding");
  assert(
    finalBootstrap.seeds.some((seed) => seed.sourceKind === "document_chunk" || seed.sourceKind === "message"),
    "expected provenance sourceKind on seeds",
  );

  console.log("Onboarding smoke passed");
}

type SmokeStreamEvent =
  | {
      type: "token";
      messageId: string;
      token: string;
    }
  | {
      type: "assistant_message";
      messageId: string;
      text: string;
    }
  | {
      type: "extraction";
      messageId: string;
      entities: Array<{ id: string }>;
      relationships: Array<{ id: string }>;
    }
  | {
      type: "onboarding_seed";
      messageId: string;
      seeds: Array<{ id: string }>;
    }
  | {
      type: "onboarding_state";
      messageId: string;
      onboardingState: string;
    }
  | {
      type: "done";
      messageId: string;
    }
  | {
      type: "error";
      messageId: string;
      error: string;
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

        if (event.type === "error") {
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
