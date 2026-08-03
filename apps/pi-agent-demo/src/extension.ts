import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createTabstackPiExtension } from "@tabstack/pi-agent";

// A minimal Pi extension that gives the Pi coding agent web access through
// Tabstack. Pi loads this file and calls the default export with its extension
// API; this registers all five Tabstack tools (extract_page_content,
// research_question, extract_structured_data, generate_structured_data, and
// automate_browser_task) bound to the default client. The client reads
// TABSTACK_API_KEY from the environment on first tool call.
//
// Load it:
//   export TABSTACK_API_KEY=...
//   pi -e ./src/extension.ts
//
// The simplest possible extension is a one-line re-export:
//   export { default } from "@tabstack/pi-agent";
// This file uses createTabstackPiExtension so the client can be configured (an
// explicit apiKey or baseUrl) if you need something other than the defaults.
const extension = createTabstackPiExtension();

export default function (pi: ExtensionAPI): void {
  extension(pi);
}
