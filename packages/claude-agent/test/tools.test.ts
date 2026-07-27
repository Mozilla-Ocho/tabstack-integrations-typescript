import { type TabstackClient, toolDescriptions, toolNames } from "@tabstack/integrations-core";
import { describe, expect, it, vi } from "vitest";

// Mock the Claude Agent SDK so the tests exercise this adapter's wrapping logic
// (name, description, unwrapped schema, handler content shape, client routing)
// without depending on the SDK's internal `SdkMcpToolDefinition` runtime shape.
// `tool()` here simply captures its arguments; `createSdkMcpServer()` echoes its
// options so the server helpers can be asserted too.
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  tool: (
    name: string,
    description: string,
    inputSchema: unknown,
    handler: (args: unknown) => Promise<unknown>,
  ) => ({ name, description, inputSchema, handler }),
  createSdkMcpServer: (options: unknown) => ({ type: "sdk", options }),
}));

import {
  createTabstackClaudeAgentServer,
  createTabstackClaudeAgentTools,
  tabstackAllowedTools,
  tabstackMcpServerName,
  tabstackServer,
  tabstackTools,
} from "../src/index.js";

/** Shape captured by the mocked `tool()`. */
type CapturedTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: unknown) => Promise<{
    content: { type: string; text: string }[];
    isError?: boolean;
  }>;
};

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

function byName(tools: unknown[]): Record<string, CapturedTool> {
  const map: Record<string, CapturedTool> = {};
  for (const t of tools as CapturedTool[]) {
    map[t.name] = t;
  }
  return map;
}

describe("@tabstack/claude-agent", () => {
  it("carries the core tool names, in lockstep", () => {
    expect((tabstackTools as CapturedTool[]).map((t) => t.name).sort()).toEqual(
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
    const tools = byName(createTabstackClaudeAgentTools({ client: mockClient() }));
    expect(tools[toolNames.extractStructuredData]?.description).toBe(
      toolDescriptions.extractStructuredData,
    );
    expect(tools[toolNames.extractPageContent]?.description).toBe(
      toolDescriptions.extractPageContent,
    );
    expect(tools[toolNames.researchQuestion]?.description).toBe(toolDescriptions.researchQuestion);
  });

  it("passes the core schema's raw shape (not the z.object) as inputSchema", () => {
    const tools = byName(createTabstackClaudeAgentTools({ client: mockClient() }));
    const shape = tools[toolNames.extractPageContent]?.inputSchema;
    // A raw shape is a plain object of field schemas, so `url` is a key on it.
    // A z.object() would expose fields under `.shape` instead.
    expect(shape).toBeDefined();
    expect(shape && "url" in shape).toBe(true);
    expect(shape && "shape" in shape).toBe(false);
  });

  it("routes execution through the injected client and returns MCP text content", async () => {
    const client = mockClient();
    const tools = byName(createTabstackClaudeAgentTools({ client }));
    const result = await tools[toolNames.extractPageContent]?.handler({
      url: "https://example.com",
    });
    expect(client.extract.markdown).toHaveBeenCalledWith({ url: "https://example.com" });
    expect(result).toEqual({ content: [{ type: "text", text: "# Hello" }] });
  });

  it("JSON-encodes object results into the text content", async () => {
    const client = mockClient();
    const tools = byName(createTabstackClaudeAgentTools({ client }));
    const result = await tools[toolNames.extractStructuredData]?.handler({
      url: "https://example.com",
      json_schema_json: "{}",
    });
    expect(result).toEqual({ content: [{ type: "text", text: JSON.stringify({ ok: true }) }] });
  });

  it("returns a normalized error result (isError) when the SDK call fails", async () => {
    const client = mockClient();
    (client.extract.markdown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("boom"));
    const tools = byName(createTabstackClaudeAgentTools({ client }));
    const result = await tools[toolNames.extractPageContent]?.handler({
      url: "https://example.com",
    });
    expect(result?.isError).toBe(true);
    expect(result?.content[0]?.type).toBe("text");
    expect(typeof result?.content[0]?.text).toBe("string");
  });

  it("exposes fully qualified allowed tool names for query()", () => {
    expect(tabstackAllowedTools).toContain(
      `mcp__${tabstackMcpServerName}__${toolNames.researchQuestion}`,
    );
    expect(tabstackAllowedTools).toHaveLength(5);
  });

  it("builds an in-process MCP server named tabstack", () => {
    // The mocked createSdkMcpServer echoes its options as `{ type, options }`, so
    // assert against that shape. Cast through `unknown` because the static import
    // type is the real SDK's McpSdkServerConfigWithInstance, not the mock's shape.
    const server = createTabstackClaudeAgentServer({ client: mockClient() }) as unknown as {
      type: string;
      options: { name: string; tools: unknown[] };
    };
    expect(server.type).toBe("sdk");
    expect(server.options.name).toBe(tabstackMcpServerName);
    expect(server.options.tools).toHaveLength(5);
    // The default server is built eagerly at import with a lazy client.
    expect((tabstackServer as unknown as { options: { name: string } }).options.name).toBe(
      tabstackMcpServerName,
    );
  });
});
