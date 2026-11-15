import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

// Specs de lógica pura (servicios, stores, modelos): sin plugins de Vue/Vuetify.
// Los specs de MONTAJE DOM (sufijo `.mount.spec.ts`, ver `environmentMatchGlobs`
// más abajo) sí necesitan el plugin de Vue para compilar los `.vue` montados.
export default defineConfig({
  plugins: [vue()],
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
    // Convención del repo: `*.spec.ts` es lógica pura (entorno "node", rápido,
    // sin DOM). `*.mount.spec.ts` es un test de MONTAJE real con
    // `@vue/test-utils` (`mount()`) que necesita un DOM: solo esos ficheros
    // pagan el coste de happy-dom + los plugins de Vue/Vuetify. No usar
    // `environment: "happy-dom"` global: ralentizaría los ~150 specs de lógica
    // pura del paquete sin necesidad.
    //
    // OJO: vitest resuelve cada patrón contra `root` (esta carpeta,
    // apps/operations) con `path.resolve`, igual que `include` arriba — por
    // eso hace falta el prefijo `../../` para los specs de montaje que viven
    // en packages/platform (si el patrón fuera solo "**/*.mount.spec.ts" no
    // matchearía nada fuera de apps/operations y el test correría igualmente
    // en "node", fallando con "document is not defined").
    environmentMatchGlobs: [
      ["src/**/*.mount.spec.ts", "happy-dom"],
      ["../../packages/platform/**/*.mount.spec.ts", "happy-dom"],
    ],
    // Vuetify se externaliza por defecto (vive en node_modules): sin esto, sus
    // componentes importan .css directamente y Node (no Vite) intenta cargarlo,
    // lo que revienta con "Unknown file extension .css" en cuanto un test de
    // montaje importa `vuetify/components`.
    server: {
      deps: {
        inline: ["vuetify"],
      },
    },
    // Polyfills que solo hacen falta para montar componentes Vuetify bajo
    // happy-dom (ver el fichero: el guard `typeof window` lo hace no-op en
    // los specs de lógica pura, que corren en entorno "node").
    setupFiles: ["src/test/vuetifyMountPolyfills.ts"],
  },
});
