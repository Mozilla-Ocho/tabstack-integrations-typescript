import { type TabstackClient, toolDescriptions, toolNames } from "@tabstack/integrations-core";
import { describe, expect, it, vi } from "vitest";
import piExtension, {
  createTabstackPiExtension,
  createTabstackPiTools,
  extractPageContentTool,
  researchQuestionTool,
} from "../src/index.js";

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

/** The shape of a tool captured from `pi.registerTool`, kept loose for the test. */
interface CapturedTool {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (
    toolCallId: string,
    params: unknown,
    signal?: AbortSignal,
  ) => Promise<{ content: { type: string; text: string }[]; details: unknown }>;
}

/**
 * A minimal fake Pi `ExtensionAPI` that captures every `registerTool` call, so we
 * can drive the extension factory and assert on the tools it registers.
 */
function fakePi() {
  const tools: CapturedTool[] = [];
  const pi = {
    registerTool: (tool: CapturedTool) => {
      tools.push(tool);
    },
  };
  return { pi, tools };
}

/** Register the extension against a mock client and return the captured tools. */
function registerTools(client: TabstackClient): CapturedTool[] {
  const { pi, tools } = fakePi();
  createTabstackPiExtension({ client })(pi as never);
  return tools;
}

/** Look a captured tool up by its core name. */
function byName(tools: CapturedTool[], name: string): CapturedTool {
  const found = tools.find((t) => t.name === name);
  if (!found) throw new Error(`tool ${name} not found`);
  return found;
}

describe("@tabstack/pi-agent", () => {
  it("registers the five tools by their core names, in lockstep", () => {
    const tools = registerTools(mockClient());
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

  it("reuses core descriptions verbatim and gives each tool a human label", () => {
    const tools = registerTools(mockClient());
    const extract = byName(tools, toolNames.extractStructuredData);
    expect(extract.description).toBe(toolDescriptions.extractStructuredData);
    expect(byName(tools, toolNames.extractPageContent).description).toBe(
      toolDescriptions.extractPageContent,
    );
    expect(extract.label).toBe("Extract Structured Data");
  });

  it("advertises each core schema as a Typebox-wrapped JSON Schema", () => {
    const tools = registerTools(mockClient());
    const params = byName(tools, toolNames.extractPageContent).parameters;
    // Type.Unsafe tags the raw JSON Schema object with a `~unsafe` marker.
    expect(params["~unsafe"]).toBeNull();
    expect(params.type).toBe("object");
    expect((params.properties as Record<string, unknown>).url).toBeDefined();
  });

  it("routes execution through the injected client and returns the Pi ToolResult shape", async () => {
    const client = mockClient();
    const tools = registerTools(client);
    const result = await byName(tools, toolNames.extractPageContent).execute("call-1", {
      url: "https://example.com",
    });
    // extract_page_content yields a string; it passes through as text content.
    expect(result.content).toEqual([{ type: "text", text: "# Hello" }]);
    expect(result.details).toBe("# Hello");
    expect(client.extract.markdown).toHaveBeenCalledWith({ url: "https://example.com" });
  });

  it("serializes object results to JSON text", async () => {
    const client = mockClient();
    const tools = registerTools(client);
    const result = await byName(tools, toolNames.extractStructuredData).execute("call-2", {
      url: "https://example.com",
      json_schema_json: JSON.stringify({ type: "object" }),
    });
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify({ ok: true }) }]);
    expect(client.extract.json).toHaveBeenCalledOnce();
  });

  it("rejects schema-violating input with TabstackToolError before touching the client", async () => {
    // Note: Pi validates params (TypeBox) and throws before execute in normal use,
    // so this drives execute directly to cover the wrapper's own re-parse guard,
    // not the error path a model hits. Missing required `url`.
    const client = mockClient();
    const tools = registerTools(client);
    await expect(
      byName(tools, toolNames.extractPageContent).execute("call-3", {}),
    ).rejects.toMatchObject({ name: "TabstackToolError" });
    expect(client.extract.markdown).not.toHaveBeenCalled();
  });

  it("rejects immediately when the abort signal is already aborted", async () => {
    const tools = registerTools(mockClient());
    await expect(
      byName(tools, toolNames.extractPageContent).execute(
        "call-4",
        { url: "https://example.com" },
        AbortSignal.abort(),
      ),
    ).rejects.toMatchObject({ name: "TabstackToolError" });
  });

  it("rejects when the signal aborts mid-call, unblocking the session", async () => {
    // A client whose call never settles, so only the abort can resolve the race.
    const client = {
      extract: { json: vi.fn(), markdown: vi.fn().mockReturnValue(new Promise(() => {})) },
      generate: { json: vi.fn() },
      agent: { research: vi.fn(), automate: vi.fn() },
    } as unknown as TabstackClient;
    const tools = registerTools(client);
    const controller = new AbortController();
    const pending = byName(tools, toolNames.extractPageContent).execute(
      "call-5",
      { url: "https://example.com" },
      controller.signal,
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "TabstackToolError" });
  });

  it("registers only the requested subset, in order, when `tools` is given", () => {
    const { pi, tools } = fakePi();
    createTabstackPiExtension({
      client: mockClient(),
      tools: ["research_question", "extract_page_content"],
    })(pi as never);
    expect(tools.map((t) => t.name)).toEqual([
      toolNames.researchQuestion,
      toolNames.extractPageContent,
    ]);
  });

  it("default export registers all five tools", () => {
    const { pi, tools } = fakePi();
    piExtension(pi as never);
    expect(tools).toHaveLength(5);
  });

  it("createTabstackPiTools returns every tool keyed by core name", () => {
    const defs = createTabstackPiTools({ client: mockClient() });
    expect(Object.keys(defs).sort()).toEqual(
      [
        toolNames.extractStructuredData,
        toolNames.extractPageContent,
        toolNames.researchQuestion,
        toolNames.generateStructuredData,
        toolNames.automateBrowserTask,
      ].sort(),
    );
  });

  it("exports individual default-client tool definitions", () => {
    expect(extractPageContentTool.name).toBe(toolNames.extractPageContent);
    expect(researchQuestionTool.name).toBe(toolNames.researchQuestion);
  });
});
