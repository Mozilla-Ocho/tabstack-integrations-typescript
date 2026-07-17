import {
  type TabstackClient,
  TabstackToolError,
  toolDescriptions,
  toolNames,
} from "@tabstack/integrations-core";
import { describe, expect, it, vi } from "vitest";
import { createTabstackEveTools, extractPageContentTool } from "../src/index.js";

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

describe("@tabstack/eve", () => {
  it("keys tools by their core names, in lockstep", () => {
    const tools = createTabstackEveTools({ client: mockClient() });
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

  it("reuses core descriptions verbatim", () => {
    const tools = createTabstackEveTools({ client: mockClient() });
    expect(tools[toolNames.extractStructuredData]?.description).toBe(
      toolDescriptions.extractStructuredData,
    );
    expect(tools[toolNames.extractPageContent]?.description).toBe(
      toolDescriptions.extractPageContent,
    );
    expect(tools[toolNames.researchQuestion]?.description).toBe(toolDescriptions.researchQuestion);
  });

  it("exposes each core Zod schema as a JSON Schema input", () => {
    const tools = createTabstackEveTools({ client: mockClient() });
    const schema = tools[toolNames.extractPageContent]?.inputSchema as Record<string, unknown>;
    expect(schema.type).toBe("object");
    expect((schema.properties as Record<string, unknown>).url).toBeDefined();
  });

  it("validates input and routes execution through the injected SDK client", async () => {
    const client = mockClient();
    const tools = createTabstackEveTools({ client });
    const result = await tools[toolNames.extractPageContent]?.execute(
      { url: "https://example.com" },
      // eve passes a ToolContext as the second arg; unused by the core body.
      {} as never,
    );
    expect(result).toBe("# Hello");
    expect(client.extract.markdown).toHaveBeenCalledWith({ url: "https://example.com" });
  });

  it("rejects schema-violating input as a normalized TabstackToolError", async () => {
    await expect(
      // Missing required `url`.
      extractPageContentTool.execute({} as never, {} as never),
    ).rejects.toBeInstanceOf(TabstackToolError);
  });
});
