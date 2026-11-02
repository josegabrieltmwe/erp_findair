import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

// Specs de lógica pura (servicios, stores, modelos): sin plugins de Vue/Vuetify.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@cargo": fileURLToPath(
        new URL("./src/modules/cargo", import.meta.url),
      ),
      "@shipment": fileURLToPath(
        new URL("./src/modules/shipment", import.meta.url),
      ),
      "@shared": fileURLToPath(
        new URL("../../packages/platform", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});
