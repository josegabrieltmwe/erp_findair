import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

// Specs de lógica pura (servicios, stores, modelos): sin plugins de Vue/Vuetify,
// entorno "node" (rápido). Los specs de MONTAJE DOM (sufijo `.mount.spec.ts`,
// ver `environmentMatchGlobs` más abajo) sí necesitan el plugin de Vue para
// compilar los `.vue` montados; no afecta ni ralentiza el resto.
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
    // Convención del repo: `*.spec.ts` es lógica pura (entorno "node", rápido,
    // sin DOM). `*.mount.spec.ts` es un test de MONTAJE real con
    // `@vue/test-utils` (`mount()`) que necesita un DOM: solo esos ficheros
    // pagan el coste de happy-dom + los plugins de Vue/Vuetify. No usar
    // `environment: "happy-dom"` global: ralentizaría los ~150 specs de lógica
    // pura del paquete sin necesidad.
    //
    // OJO: vitest resuelve cada patrón contra `root` (esta carpeta,
    // apps/operations) con `path.resolve`, igual que `include` abajo — por
    // eso hace falta el prefijo `../../` para los specs de montaje que viven
    // en packages/platform (si el patrón fuera solo "**/*.mount.spec.ts" no
    // matchearía nada fuera de apps/operations y el test correría igualmente
    // en "node", fallando con "document is not defined").
    environmentMatchGlobs: [
      ["src/**/*.mount.spec.ts", "happy-dom"],
      ["../../packages/platform/**/*.mount.spec.ts", "happy-dom"],
    ],
    // packages/platform es "lógica pura... para poder probarla con vitest" (su propio
    // docblock, p.ej. navCatalog.ts) pero hasta ahora nada recogía sus *.spec.ts.
    include: ["src/**/*.spec.ts", "../../packages/platform/**/*.spec.ts"],
    server: {
      deps: {
        // Vuetify se externaliza por defecto (vive en node_modules): sin esto,
        // `vuetify/components` importa un .css por componente y Node (no Vite)
        // intenta cargarlo con su loader nativo ESM y revienta ("Unknown file
        // extension .css"). Inline fuerza a pasarlo por Vite, que sí sabe
        // tratar CSS (no-op en los specs). No afecta a los specs de lógica
        // pura, que no importan vuetify.
        inline: ["vuetify"],
      },
    },
    // Polyfills que solo hacen falta para montar componentes Vuetify bajo
    // happy-dom (p.ej. VOverlay/VDialog usan window.visualViewport, que
    // happy-dom no implementa). El guard `typeof window` del propio fichero lo
    // hace no-op en los specs de lógica pura, que corren en entorno "node".
    setupFiles: ["src/test/vuetifyMountPolyfills.ts"],
  },
});
