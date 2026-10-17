import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import vueI18n from "@intlify/unplugin-vue-i18n/vite";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

    server: {
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
