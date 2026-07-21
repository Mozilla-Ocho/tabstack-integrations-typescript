import { type TabstackClient, toolDescriptions, toolNames } from "@tabstack/integrations-core";
import { describe, expect, it, vi } from "vitest";
import { createTabstackMastraTools, extractPageContentTool, tabstackTools } from "../src/index.js";

/** Minimal mock of the Tabstack SDK client. No live API call is made. */
function mockClient() {
  return {
    extract: {
      json: vi.fn().mockResolvedValue({ ok: true }),
      markdown: vi.fn().mockResolvedValue({ content: "# Hello", url: "https://example.com" }),
    },
    generate: {
      json: vi.fn().mockResolvedValue({ ok: true }),
    },
    agent: {
      research: vi.fn(),
      automate: vi.fn(),
    },
  } as unknown as TabstackClient;
}

describe("@tabstack/mastra", () => {
  it("keys tools by their core names, in lockstep", () => {
    const tools = createTabstackMastraTools({ client: mockClient() });
    expect(Object.keys(tools).sort()).toEqual(
      [
        toolNames.extractStructuredData,
        toolNames.extractPageContent,
        toolNames.researchQuestion,
        toolNames.generateStructuredData,
        toolNames.automateBrowserTask,
      ].sort(),
    );
  });

  it("stamps each tool's id with its core name", () => {
    const tools = createTabstackMastraTools({ client: mockClient() });
    expect(tools[toolNames.extractPageContent]?.id).toBe(toolNames.extractPageContent);
    expect(tools[toolNames.researchQuestion]?.id).toBe(toolNames.researchQuestion);
  });

  it("reuses core descriptions verbatim", () => {
    const tools = createTabstackMastraTools({ client: mockClient() });
    expect(tools[toolNames.extractStructuredData]?.description).toBe(
      toolDescriptions.extractStructuredData,
    );
    expect(tools[toolNames.extractPageContent]?.description).toBe(
      toolDescriptions.extractPageContent,
    );
    expect(tools[toolNames.researchQuestion]?.description).toBe(toolDescriptions.researchQuestion);
  });

  it("exposes the core schema as a validating Standard Schema, catching drift", async () => {
    const tools = createTabstackMastraTools({ client: mockClient() });
    // Mastra's createTool wraps the Zod schema into a Standard Schema, so assert
    // the wrapped schema still enforces the core shape rather than reference
    // equality. A missing required `url` must produce validation issues.
    const inputSchema = tools[toolNames.extractPageContent]?.inputSchema as
      | { "~standard": { validate: (value: unknown) => unknown } }
      | undefined;
    expect(inputSchema?.["~standard"]).toBeDefined();
    const ok = (await inputSchema?.["~standard"].validate({ url: "https://example.com" })) as {
      issues?: unknown;
    };
    expect(ok.issues).toBeUndefined();
    const bad = (await inputSchema?.["~standard"].validate({})) as { issues?: unknown };
    expect(bad.issues).toBeDefined();
  });

  it("routes execution through the injected SDK client", async () => {
    const client = mockClient();
    const tools = createTabstackMastraTools({ client });
    const execute = tools[toolNames.extractPageContent]?.execute;
    if (!execute) throw new Error("expected execute on extract_page_content tool");
    // Mastra hands the validated input as the first positional arg; the second
    // is the execution context, unused by the core body.
    // The keyed tool object gives `execute` a union input type across all tools,
    // so cast the single-tool input to satisfy it.
    const result = await execute({ url: "https://example.com" } as never, undefined as never);
    expect(client.extract.markdown).toHaveBeenCalledWith({ url: "https://example.com" });
    expect(result).toBe("# Hello");
  });

  it("exposes lazily-resolved default-client tool constants", () => {
    expect(extractPageContentTool.id).toBe(toolNames.extractPageContent);
    expect(tabstackTools[toolNames.extractPageContent]).toBe(extractPageContentTool);
  });
});
