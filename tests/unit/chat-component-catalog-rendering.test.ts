import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatContext, Markdown, chatTheme } from "reachat";
import { chatComponentCatalog } from "../../app/src/client/chat-component-catalog";

const fence = "```";

describe("chat component catalog rendering", () => {
  it("renders valid component specs", () => {
    const markdown = [
      `${fence}component`,
      '{"type":"EntityCard","props":{"kind":"decision","name":"Use TypeScript","confidence":0.9,"status":"captured"}}',
      fence,
    ].join("\n");

    const html = renderToStaticMarkup(
      React.createElement(
        ChatContext.Provider,
        { value: { sessions: [], activeSessionId: null, theme: chatTheme } as any },
        React.createElement(
          Markdown,
          {
            remarkPlugins: [chatComponentCatalog.remarkPlugin],
            customComponents: chatComponentCatalog.components,
          },
          markdown,
        ),
      ),
    );
    expect(html.includes("Use TypeScript")).toBe(true);
  });

  it("renders visible validation errors for malformed specs", () => {
    const markdown = [`${fence}component`, '{"type":"EntityCard","props":{"kind":"decision"}}', fence].join("\n");

    const html = renderToStaticMarkup(
      React.createElement(
        ChatContext.Provider,
        { value: { sessions: [], activeSessionId: null, theme: chatTheme } as any },
        React.createElement(
          Markdown,
          {
            remarkPlugins: [chatComponentCatalog.remarkPlugin],
            customComponents: chatComponentCatalog.components,
          },
          markdown,
        ),
      ),
    );
    expect(html.includes("Invalid props for")).toBe(true);
    expect(html.includes("EntityCard")).toBe(true);
  });
});
