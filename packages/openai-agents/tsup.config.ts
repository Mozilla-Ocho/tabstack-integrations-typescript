import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  // The private core package is bundled in. @tabstack/sdk, @openai/agents, and
  // zod stay external (declared as dependency / peer dependencies).
  noExternal: ["@tabstack/integrations-core"],
});
