import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  // `noExternal` bundles core into the JS output but tsup's declaration
  // pipeline does not honor it, so the emitted .d.ts kept a bare import of
  // the private core package. `dts.resolve` inlines its types to match.
  dts: { resolve: ["@tabstack/integrations-core"] },
  clean: true,
  sourcemap: true,
  // The private core package is bundled in. @tabstack/sdk, @openai/agents, and
  // zod stay external (declared as dependency / peer dependencies).
  noExternal: ["@tabstack/integrations-core"],
});
