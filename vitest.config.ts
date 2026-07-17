import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// The extension imports modules that pi provides at runtime (typebox,
// @earendil-works/pi-ai). Tests stub them so the real extension module can be
// loaded and its tools driven in-process.
export default defineConfig({
  resolve: {
    alias: {
      typebox: fileURLToPath(new URL("./src/__tests__/stubs/typebox.ts", import.meta.url)),
      "@earendil-works/pi-ai": fileURLToPath(new URL("./src/__tests__/stubs/pi-ai.ts", import.meta.url)),
    },
  },
});
