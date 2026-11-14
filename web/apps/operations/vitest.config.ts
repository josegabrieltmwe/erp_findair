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
    // packages/platform es "lógica pura... para poder probarla con vitest" (su propio
    // docblock, p.ej. navCatalog.ts) pero hasta ahora nada recogía sus *.spec.ts.
    include: ["src/**/*.spec.ts", "../../packages/platform/**/*.spec.ts"],
  },
});
