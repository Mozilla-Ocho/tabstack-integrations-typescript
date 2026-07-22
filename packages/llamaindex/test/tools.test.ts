import {
  type TabstackClient,
  TabstackToolError,
  toolDescriptions,
  toolNames,
} from "@tabstack/integrations-core";
import { describe, expect, it, vi } from "vitest";
import { createTabstackLlamaindexTools } from "../src/index.js";

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

describe("@tabstack/llamaindex", () => {
  it("returns one tool per core spec, named by their core names", () => {
    const tools = createTabstackLlamaindexTools({ client: mockClient() });
    expect(tools.map((t) => t.metadata.name).sort()).toEqual(
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
    const tools = createTabstackLlamaindexTools({ client: mockClient() });
    const byName = new Map(tools.map((t) => [t.metadata.name, t.metadata.description]));
    expect(byName.get(toolNames.extractStructuredData)).toBe(
      toolDescriptions.extractStructuredData,
    );
    expect(byName.get(toolNames.extractPageContent)).toBe(toolDescriptions.extractPageContent);
    expect(byName.get(toolNames.researchQuestion)).toBe(toolDescriptions.researchQuestion);
  });

  it("advertises each core Zod schema as a JSON Schema input", () => {
    const tools = createTabstackLlamaindexTools({ client: mockClient() });
    const spec = tools.find((t) => t.metadata.name === toolNames.extractPageContent);
    const schema = spec?.metadata.parameters as Record<string, unknown>;
    expect(schema.type).toBe("object");
    expect((schema.properties as Record<string, unknown>).url).toBeDefined();
  });

  it("routes execution through the injected SDK client", async () => {
    const client = mockClient();
    const tools = createTabstackLlamaindexTools({ client });
    const spec = tools.find((t) => t.metadata.name === toolNames.extractPageContent);
    // `tools` is a heterogeneous array, so `spec.call` is typed against the union
    // of every tool input; cast the single-tool input to satisfy it.
    const result = await spec?.call({ url: "https://example.com" } as never);
    expect(result).toBe("# Hello");
    expect(client.extract.markdown).toHaveBeenCalledWith({ url: "https://example.com" });
  });

  it("fails fast on invalid input without reaching the SDK client", async () => {
    // LlamaIndex only warns on a schema-validation failure and still calls
    // execute with the raw input, so the adapter re-parses and must throw before
    // the client is touched. Missing required `url`.
    const client = mockClient();
    const tools = createTabstackLlamaindexTools({ client });
    const spec = tools.find((t) => t.metadata.name === toolNames.extractPageContent);
    await expect(spec?.call({} as never)).rejects.toBeInstanceOf(TabstackToolError);
    expect(client.extract.markdown).not.toHaveBeenCalled();
  });
});
