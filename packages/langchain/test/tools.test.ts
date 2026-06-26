import {
  type TabstackClient,
  extractPageContentSchema,
  extractStructuredDataSchema,
  researchQuestionSchema,
  toolDescriptions,
  toolNames,
} from "@tabstack/integrations-core";
import { describe, expect, it, vi } from "vitest";
import {
  createTabstackLangchainTools,
  extractPageContentTool,
  extractStructuredDataTool,
  researchQuestionTool,
  tabstackTools,
} from "../src/index.js";

/** An async-iterable stream of automate SSE events, like the SDK returns. */
async function* automateStream() {
  yield { event: "browser:navigated", data: { url: "https://example.com", title: "Example" } };
  yield { event: "agent:extracted", data: { extractedData: "the answer is 42" } };
  yield {
    event: "complete",
    data: {
      finalAnswer: "Done.",
      success: true,
      stats: { actions: 3, iterations: 2, durationMs: 1234 },
    },
  };
}

/** An async-iterable stream of research SSE events, like the SDK returns. */
async function* researchStream() {
  yield {
    event: "complete",
    data: {
      report: "The answer.",
      metadata: {
        citedPages: [{ url: "https://a.example", title: "A" }, { url: "https://b.example" }],
      },
    },
  };
}

/** Minimal mock of the Tabstack SDK client. No live API call is made. */
function mockClient() {
  return {
    extract: {
      json: vi.fn().mockResolvedValue({ ok: true }),
      markdown: vi.fn().mockResolvedValue({ content: "# Hello", url: "https://example.com" }),
    },
    generate: {
      json: vi.fn().mockResolvedValue({ summary: "short" }),
    },
    agent: {
      research: vi.fn().mockImplementation(() => researchStream()),
      automate: vi.fn().mockImplementation(() => automateStream()),
    },
  } as unknown as TabstackClient;
}

describe("@tabstack/langchain", () => {
  it("exposes all tools in lockstep with core names", () => {
    expect(tabstackTools).toHaveLength(5);
    expect(tabstackTools.map((t) => t.name)).toEqual([
      toolNames.extractStructuredData,
      toolNames.extractPageContent,
      toolNames.researchQuestion,
      toolNames.generateStructuredData,
      toolNames.automateBrowserTask,
    ]);
  });

  it("reuses core descriptions verbatim", () => {
    expect(extractStructuredDataTool.description).toBe(toolDescriptions.extractStructuredData);
    expect(extractPageContentTool.description).toBe(toolDescriptions.extractPageContent);
    expect(researchQuestionTool.description).toBe(toolDescriptions.researchQuestion);
  });

  it("uses the core Zod schema for each tool, catching drift", () => {
    expect(extractStructuredDataTool.schema).toBe(extractStructuredDataSchema);
    expect(extractPageContentTool.schema).toBe(extractPageContentSchema);
    expect(researchQuestionTool.schema).toBe(researchQuestionSchema);
  });

  it("routes execution through the injected SDK client and passes fetch options", async () => {
    const client = mockClient();
    const tools = createTabstackLangchainTools({ client });
    const pageContent = tools[1];
    if (!pageContent) throw new Error("expected extract_page_content tool");
    const result = await pageContent.invoke({
      url: "https://example.com",
      effort: "max",
      nocache: true,
      country: "GB",
    });
    expect(client.extract.markdown).toHaveBeenCalledWith({
      url: "https://example.com",
      effort: "max",
      nocache: true,
      geo_target: { country: "GB" },
    });
    expect(result).toBe("# Hello");
  });

  it("runs research and returns the report with cited sources", async () => {
    const client = mockClient();
    const tools = createTabstackLangchainTools({ client });
    const research = tools[2];
    if (!research) throw new Error("expected research_question tool");
    const result = await research.invoke({ query: "why?" });
    expect(client.agent.research).toHaveBeenCalledWith({ query: "why?", mode: "balanced" });
    expect(result).toEqual({
      answer: "The answer.",
      sources: [
        { title: "A", url: "https://a.example" },
        { title: "", url: "https://b.example" },
      ],
    });
  });

  it("runs generate and passes instructions plus fetch options", async () => {
    const client = mockClient();
    const tools = createTabstackLangchainTools({ client });
    const generate = tools[3];
    if (!generate) throw new Error("expected generate_structured_data tool");
    const result = await generate.invoke({
      url: "https://example.com",
      instructions: "summarize",
      json_schema_json: '{"type":"object"}',
      effort: "min",
    });
    expect(client.generate.json).toHaveBeenCalledWith({
      url: "https://example.com",
      instructions: "summarize",
      json_schema: { type: "object" },
      effort: "min",
    });
    expect(result).toEqual({ summary: "short" });
  });

  it("maps automate params to the SDK and aggregates the event stream", async () => {
    const client = mockClient();
    const tools = createTabstackLangchainTools({ client });
    const automate = tools[4];
    if (!automate) throw new Error("expected automate_browser_task tool");

    const result = await automate.invoke({
      task: "Look something up",
      url: "https://example.com",
      country: "US",
      max_iterations: 5,
      max_validation_attempts: 2,
    });

    expect(client.agent.automate).toHaveBeenCalledWith({
      task: "Look something up",
      url: "https://example.com",
      geo_target: { country: "US" },
      maxIterations: 5,
      maxValidationAttempts: 2,
    });
    expect(result).toMatchObject({
      answer: "Done.",
      success: true,
      iterations: 2,
      actions: 3,
      durationMs: 1234,
      extracted: ["the answer is 42"],
      pagesVisited: [{ url: "https://example.com", title: "Example" }],
    });
  });
});
