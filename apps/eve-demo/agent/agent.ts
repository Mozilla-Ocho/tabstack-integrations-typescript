import { defineAgent } from "eve";

// Tools live in `agent/tools/*.ts`; eve auto-discovers them and derives each
// tool's name from its filename. The tool files re-export the pre-built
// Tabstack tools from `@tabstack/eve`, so this agent can browse and extract the
// web with no extra wiring. Set TABSTACK_API_KEY (and your model provider key)
// before running `eve dev`.
export default defineAgent({
  model: "anthropic/claude-sonnet-4-6",
});
