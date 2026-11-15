import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";

// Specs de lógica pura (servicios, stores, modelos): sin plugins de Vue/Vuetify,
// entorno "node" (rápido). El plugin de Vue solo entra en juego para los specs
// que de verdad importan un .vue (ver environmentMatchGlobs más abajo); no
// afecta ni ralentiza el resto.
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
    // Convención: *.mount.spec.ts = specs que montan un componente Vue real
    // con @vue/test-utils (Vuetify incluido) y necesitan DOM de verdad. Van en
    // happy-dom; todo lo demás (la inmensa mayoría: lógica pura) sigue en
    // "node", sin jsdom/happy-dom, tal y como estaba. OJO: vitest resuelve
    // cada glob con path.resolve(root, glob) antes de matchearlo, así que un
    // patrón relativo sin "../" solo alcanza src/**; de ahí la entrada
    // explícita para packages/platform (mismo motivo que el "include" de abajo).
    // Nota: Vitest 3.2.7 marca environmentMatchGlobs como deprecado en favor
    // de `test.projects`; se mantiene esta opción (más simple para un único
    // patrón) mientras siga soportada — revisar si se migra el resto del
    // monorepo a `projects`.
    environmentMatchGlobs: [
      ["**/*.mount.spec.ts", "happy-dom"],
      ["../../packages/platform/**/*.mount.spec.ts", "happy-dom"],
    ],
    // packages/platform es "lógica pura... para poder probarla con vitest" (su propio
    // docblock, p.ej. navCatalog.ts) pero hasta ahora nada recogía sus *.spec.ts.
    include: ["src/**/*.spec.ts", "../../packages/platform/**/*.spec.ts"],
    server: {
      deps: {
        // `vuetify/components` (barrel usado por los *.mount.spec.ts) importa
        // un .css por componente; sin inline, Vitest externaliza el paquete y
        // Node intenta cargar ese .css con su loader nativo ESM y revienta
        // ("Unknown file extension .css"). Inline fuerza a pasarlo por Vite,
        // que sí sabe tratar CSS (no-op en los specs, ver test.css). No afecta
        // a los specs de lógica pura, que no importan vuetify.
        inline: ["vuetify"],
      },
    },
  },
});
