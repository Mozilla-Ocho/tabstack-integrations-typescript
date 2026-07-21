import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";

// The OpenAI Agents SDK requires Zod 4, so this adapter is Zod 4 only. When the
// package is built, tsup bundles the (private) core package, so core's schemas
// are constructed with this adapter's Zod 4. Tests import core's published dist
// instead, which resolves `zod` from core's own install (Zod 3 in-repo), leaving
// two Zod majors that do not interoperate: `z.toJSONSchema` throws on a Zod 3
// schema. Aliasing `zod` to this package's single Zod 4 instance dedupes them,
// so core builds Zod 4 schemas at test time exactly as it does in the bundle.
const require = createRequire(import.meta.url);
const zodPath = require.resolve("zod");

export default defineConfig({
  resolve: {
    alias: { zod: zodPath },
  },
});
