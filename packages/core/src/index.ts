export {
  createTabstackClient,
  getDefaultClient,
  type TabstackClient,
  type TabstackClientConfig,
} from "./client.js";
export { TabstackToolError, normalizeError } from "./errors.js";
export {
  automateBrowserTaskSchema,
  extractPageContentSchema,
  extractStructuredDataSchema,
  generateStructuredDataSchema,
  researchQuestionSchema,
} from "./schemas.js";
export {
  automateBrowserTask,
  createTabstackTools,
  extractPageContent,
  extractStructuredData,
  generateStructuredData,
  researchQuestion,
  type TabstackTools,
  toolDescriptions,
  toolNames,
} from "./tools.js";
export type {
  AutomateBrowserTaskInput,
  AutomateBrowserTaskResult,
  AutomateVisitedPage,
  ExtractPageContentInput,
  ExtractPageContentResult,
  ExtractStructuredDataInput,
  ExtractStructuredDataResult,
  GenerateStructuredDataInput,
  GenerateStructuredDataResult,
  ResearchQuestionInput,
  ResearchResult,
  ResearchSource,
  TabstackToolExecuteOptions,
  TabstackToolSpec,
} from "./types.js";
