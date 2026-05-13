import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite";
import path from "node:path";
// Import vite-ssg to register the ssgOptions module augmentation on Vite's UserConfig
import type {} from "vite-ssg";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [
    vue(),
    VueI18nPlugin({
      include: [path.resolve(__dirname, "src/i18n/locales/**.json")],
      // runtimeOnly: true keeps only the runtime (no compiler) in the bundle.
      runtimeOnly: true,
      // jitCompilation: false compiles messages to actual JS functions instead
      // of AST objects. This is required for SSG: the SSR bundle externalises
      // vue-i18n (pre-built with __INTLIFY_JIT_COMPILATION__=false), so AST
      // objects fail at render time. Pre-compiled functions always work.
      jitCompilation: false,
      strictMessage: false,
      escapeHtml: false,
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  ssgOptions: {
    // Prerender only the four real pages; /book is a redirect and must be excluded.
    includedRoutes(paths) {
      return paths.filter((p) => p !== "/book");
    },
    script: "async",
    formatting: "minify",
    // Mock browser globals (window, document) during SSG prerender so that
    // packages like vue-echarts that access document at module load time do not
    // crash the Node.js SSR bundle evaluation.
    mock: true,
  },
});
