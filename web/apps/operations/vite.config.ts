import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import vueI18n from "@intlify/unplugin-vue-i18n/vite";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";

/**
 * Componentes de Vuetify que vite-plugin-vuetify importa uno a uno
 * (`vuetify/components/VBtn`, ...). En `vite dev`, si no se declaran, Vite los
 * descubre al navegar, re-optimiza las dependencias y fuerza una recarga: en ese
 * momento las peticiones a los chunks viejos fallan (504 "Outdated Optimize
 * Dep") y el navegador muestra decenas de .js/.ts en error. Declarandolos todos,
 * la optimizacion se hace una sola vez al arrancar.
 */
function vuetifyOptimizeDeps(): string[] {
  try {
    const dir = resolve(__dirname, "node_modules/vuetify/lib/components");
    // Algun componente publicado viene roto (p. ej. VOverflowBtn importa un
    // .css que el paquete no incluye) y tumbaria la optimizacion entera: se
    // descartan los que importan un CSS inexistente.
    const brokenCss = (name: string): boolean => {
      try {
        return readdirSync(resolve(dir, name))
          .filter((f) => f.endsWith(".js"))
          .some((f) =>
            [
              ...readFileSync(resolve(dir, name, f), "utf8").matchAll(
                /import\s+["'](\.\/[^"']+\.css)["']/g,
              ),
            ].some((m) => !existsSync(resolve(dir, name, m[1]))),
          );
      } catch {
        return false;
      }
    };
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^V[A-Z]/.test(d.name))
      .filter((d) => !brokenCss(d.name))
      .map((d) => `vuetify/components/${d.name}`)
      .concat("vuetify/directives");
  } catch {
    return [];
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isProd = mode === "production";

  return {
    base: "/",

    plugins: [
      vue(),
      vuetify({
        autoImport: true,
        styles: { configFile: "src/styles/vuetify-settings.scss" },
      }),
      vueI18n({
        // Shell locales (common/errors/platform) + every module's bundle.
        include: [
          resolve(__dirname, "src/locales/**"),
          resolve(__dirname, "src/modules/**/locales/**"),
        ],
        runtimeOnly: true,
        compositionOnly: true,
      }),
    ],

    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@shared": fileURLToPath(
          new URL("../../packages/platform", import.meta.url),
        ),
        // Módulos grandes integrados "tal cual" (sin fusionar): mantienen su
        // estructura interna original, con su propio alias en vez de reescribir
        // todos los @/ a rutas relativas. Ver plan §Fase 3.
        "@cargo": fileURLToPath(
          new URL("./src/modules/cargo", import.meta.url),
        ),
        "@shipment": fileURLToPath(
          new URL("./src/modules/shipment", import.meta.url),
        ),
      },
    },

    build: {
      outDir: "../../dist",
      emptyOutDir: true,
      manifest: true,
      sourcemap: "hidden",
      target: "es2022",
      cssCodeSplit: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          // Vendor chunks shared across all lazy domain chunks. Each domain
          // (modules/<x>) is auto-split by Vite via the dynamic import() in the
          // router, so no manual per-domain entry is needed here.
          manualChunks: {
            "vendor-vue": ["vue", "vue-router", "pinia"],
            "vendor-vuetify": ["vuetify"],
            "vendor-i18n": ["vue-i18n"],
            "vendor-utils": ["ofetch", "@vueuse/core"],
          },
        },
      },
    },

    // Solo afecta a `vite dev` (el build no usa optimizeDeps).
    optimizeDeps: {
      include: vuetifyOptimizeDeps(),
    },

    server: {
      // Precalienta todo el codigo de la app al arrancar: Vite descubre ahi
      // cualquier dependencia que falte por optimizar, antes de que entre
      // ningun navegador, en vez de hacerlo a mitad de una carga.
      warmup: {
        clientFiles: ["./src/main.ts", "./src/**/*.vue"],
      },
      // Recarga en caliente detras de Apache (sandbox.erp-dev.findair.it):
      // con VITE_DEV_PUBLIC_HOST definido, Vite escucha solo en 127.0.0.1,
      // acepta ese Host y el cliente HMR abre el websocket por wss://<host>:443
      // (Apache lo reenvia al 5190). Sin la variable, el `pnpm dev` local de
      // siempre. Ver deploy/apache/sandbox.erp-dev.findair.it.hmr.conf.
      ...(env.VITE_DEV_PUBLIC_HOST
        ? {
            host: "127.0.0.1",
            allowedHosts: [env.VITE_DEV_PUBLIC_HOST],
            origin: `https://${env.VITE_DEV_PUBLIC_HOST}`,
            hmr: {
              protocol: "wss",
              host: env.VITE_DEV_PUBLIC_HOST,
              clientPort: 443,
            },
          }
        : {}),
      cors: {
        origin: [
          /^https?:\/\/localhost(:\d+)?$/,
          /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
        ],
        credentials: true,
      },
      port: 5190,
      strictPort: true,
    },
  };
});
