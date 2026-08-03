import type { z } from "zod";
import type {
  automateBrowserTaskSchema,
  extractPageContentSchema,
  extractStructuredDataSchema,
  generateStructuredDataSchema,
  researchQuestionSchema,
} from "./schemas.js";

/** Input for the `extract_structured_data` tool. */
export type ExtractStructuredDataInput = z.infer<typeof extractStructuredDataSchema>;
/** Input for the `extract_page_content` tool. */
export type ExtractPageContentInput = z.infer<typeof extractPageContentSchema>;
/** Input for the `research_question` tool. */
export type ResearchQuestionInput = z.infer<typeof researchQuestionSchema>;
/** Input for the `generate_structured_data` tool. */
export type GenerateStructuredDataInput = z.infer<typeof generateStructuredDataSchema>;
/** Input for the `automate_browser_task` tool. */
export type AutomateBrowserTaskInput = z.infer<typeof automateBrowserTaskSchema>;

/** Structured data extracted from a page, keyed by the provided JSON Schema. */
export type ExtractStructuredDataResult = Record<string, unknown>;

/** Clean markdown content of a page. */
export type ExtractPageContentResult = string;

/** AI-transformed structured data, keyed by the provided JSON Schema. */
export type GenerateStructuredDataResult = Record<string, unknown>;

/** A page the automation agent navigated to during a task. */
export interface AutomateVisitedPage {
  url: string;
  title: string;
}

/** The outcome of a browser automation task. */
export interface AutomateBrowserTaskResult {
  /** The agent's final answer, or null if the task produced none. */
  answer: string | null;
  /** Whether the task completed successfully. */
  success: boolean;
  /** Number of agent iterations executed. */
  iterations: number;
  /** Number of browser actions executed. */
  actions: number;
  /** Total task duration in milliseconds. */
  durationMs: number;
  /** Data the agent explicitly extracted during the task, in emission order. */
  extracted: string[];
  /** Pages the agent navigated to, in visit order. */
  pagesVisited: AutomateVisitedPage[];
}

/** A single source cited by a research answer. */
export interface ResearchSource {
  title: string;
  url: string;
}

/** The synthesised result of a research query plus its cited sources. */
export interface ResearchResult {
  answer: string;
  sources: ResearchSource[];
}

/**
 * Per-call options threaded from an adapter into a tool body and on to the SDK.
 * `signal` cancels the underlying request; adapters pass the framework's own
 * `AbortSignal` here so a cancelled tool call aborts the network request (and
 * stops billing), not just the surrounding agent loop.
 */
export interface TabstackToolExecuteOptions {
  signal?: AbortSignal;
}

/**
 * A framework-agnostic Tabstack tool: its name, description, Zod input schema,
 * and an async execute body. Adapters map these straight onto a framework's own
 * tool primitive.
 */
export interface TabstackToolSpec<TInput, TOutput> {
  name: string;
  description: string;
  schema: z.ZodType<TInput>;
  execute: (input: TInput, options?: TabstackToolExecuteOptions) => Promise<TOutput>;
}
