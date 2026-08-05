import { RunContext } from "@openai/agents";
import { type TabstackClient, toolDescriptions, toolNames } from "@tabstack/integrations-core";
import { describe, expect, it, vi } from "vitest";
import { createTabstackOpenAIAgentsTools } from "../src/index.js";

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

/** Look a tool up by its core name within the built array. */
function byName(tools: ReturnType<typeof createTabstackOpenAIAgentsTools>, name: string) {
  const found = tools.find((t) => t.name === name);
  if (!found) throw new Error(`tool ${name} not found`);
  return found;
}

describe("@tabstack/openai-agents", () => {
  it("names tools by their core names, in lockstep", () => {
    const tools = createTabstackOpenAIAgentsTools({ client: mockClient() });
    expect(tools.map((t) => t.name).sort()).toEqual(
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
    const tools = createTabstackOpenAIAgentsTools({ client: mockClient() });
    expect(byName(tools, toolNames.extractStructuredData).description).toBe(
      toolDescriptions.extractStructuredData,
    );
    expect(byName(tools, toolNames.extractPageContent).description).toBe(
      toolDescriptions.extractPageContent,
    );
    expect(byName(tools, toolNames.researchQuestion).description).toBe(
      toolDescriptions.researchQuestion,
    );
  });

  it("advertises each core schema as a non-strict JSON Schema input", () => {
    const tools = createTabstackOpenAIAgentsTools({ client: mockClient() });
    const tool = byName(tools, toolNames.extractPageContent);
    // Strict mode is off so the SDK accepts the core optionals and records.
    expect(tool.strict).toBe(false);
    const schema = tool.parameters as Record<string, unknown>;
    expect(schema.type).toBe("object");
    expect((schema.properties as Record<string, unknown>).url).toBeDefined();
  });

  it("validates input and routes execution through the injected SDK client", async () => {
    const client = mockClient();
    const tools = createTabstackOpenAIAgentsTools({ client });
    // invoke receives the raw JSON string; the adapter re-parses through Zod.
    const result = await byName(tools, toolNames.extractPageContent).invoke(
      new RunContext(),
      JSON.stringify({ url: "https://example.com" }),
    );
    expect(result).toBe("# Hello");
    expect(client.extract.markdown).toHaveBeenCalledWith({ url: "https://example.com" }, undefined);
  });

  it("rejects schema-violating input before touching the SDK client", async () => {
    const client = mockClient();
    const tools = createTabstackOpenAIAgentsTools({ client });
    // Missing required `url`. The SDK swallows tool errors into a model-visible
    // result string, so we assert the client was never reached and the failure
    // surfaced, rather than expecting a rejection.
    const result = await byName(tools, toolNames.extractPageContent).invoke(new RunContext(), "{}");
    expect(client.extract.markdown).not.toHaveBeenCalled();
    expect(String(result)).toMatch(/error/i);
  });
});
