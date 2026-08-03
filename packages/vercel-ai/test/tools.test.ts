import {
  type TabstackClient,
  extractPageContentSchema,
  extractStructuredDataSchema,
  researchQuestionSchema,
  toolDescriptions,
  toolNames,
} from "@tabstack/integrations-core";
import { describe, expect, it, vi } from "vitest";
import { createTabstackAiTools, tabstackTools } from "../src/index.js";

/** Minimal mock of the Tabstack SDK client. No live API call is made. */
function mockClient() {
  return {
    extract: {
      json: vi.fn().mockResolvedValue({ ok: true }),
      markdown: vi.fn().mockResolvedValue({ content: "# Hello", url: "https://example.com" }),
    },
    agent: {
      research: vi.fn(),
    },
  } as unknown as TabstackClient;
}

describe("@tabstack/ai", () => {
  it("keys tools by their core names, in lockstep", () => {
    expect(Object.keys(tabstackTools).sort()).toEqual(
      [
        toolNames.extractStructuredData,
        toolNames.extractPageContent,
        toolNames.researchQuestion,
        toolNames.generateStructuredData,
        toolNames.automateBrowserTask,
      ].sort(),
    );
  });

  it("reuses core descriptions verbatim", () => {
    expect(tabstackTools[toolNames.extractStructuredData]?.description).toBe(
      toolDescriptions.extractStructuredData,
    );
    expect(tabstackTools[toolNames.extractPageContent]?.description).toBe(
      toolDescriptions.extractPageContent,
    );
    expect(tabstackTools[toolNames.researchQuestion]?.description).toBe(
      toolDescriptions.researchQuestion,
    );
  });

  it("uses the core Zod schema as inputSchema, catching drift", () => {
    expect(tabstackTools[toolNames.extractStructuredData]?.inputSchema).toBe(
      extractStructuredDataSchema,
    );
    expect(tabstackTools[toolNames.extractPageContent]?.inputSchema).toBe(extractPageContentSchema);
    expect(tabstackTools[toolNames.researchQuestion]?.inputSchema).toBe(researchQuestionSchema);
  });

  it("routes execution through the injected SDK client", async () => {
    const client = mockClient();
    const tools = createTabstackAiTools({ client });
    const execute = (
      tools[toolNames.extractPageContent] as {
        execute?: (input: { url: string }, options: unknown) => Promise<unknown>;
      }
    ).execute;
    if (!execute) throw new Error("expected execute on extract_page_content tool");
    const result = await execute(
      { url: "https://example.com" },
      { toolCallId: "test", messages: [] },
    );
    expect(client.extract.markdown).toHaveBeenCalledWith({ url: "https://example.com" }, undefined);
    expect(result).toBe("# Hello");
  });
});
