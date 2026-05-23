import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite";
import path from "node:path";
// Import vite-ssg to register the ssgOptions module augmentation on Vite's UserConfig
import type {} from "vite-ssg";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Build-time version + commit hash, surfaced to the runtime via `define`.
// Read package.json synchronously rather than importing it — `resolveJsonModule`
// is enabled but importing the package's own package.json upsets some tooling.
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, "package.json"), "utf8"),
) as { version: string };
const APP_VERSION = pkg.version;
const APP_COMMIT = (() => {
  // Honor env-injected values first so deploy environments without git
  // (Docker layers, sparse CI checkouts) can still stamp the build.
  const fromEnv = process.env.VITE_COMMIT_HASH ?? process.env.COMMIT_HASH;
  if (fromEnv && fromEnv.length > 0) return fromEnv.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", {
      cwd: __dirname,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
})();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_COMMIT__: JSON.stringify(APP_COMMIT),
  },
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
    // Prerender only the four real content pages. /book is a redirect;
    // /signin and /auth/verify are client-only flows that rely on URL
    // query params or live backend calls and should not be pre-rendered.
    includedRoutes(paths) {
      return paths.filter((p) => !["/book", "/signin", "/auth/verify"].includes(p));
    },
    script: "async",
    formatting: "minify",
    // Mock browser globals (window, document) during SSG prerender so that
    // packages like vue-echarts that access document at module load time do not
    // crash the Node.js SSR bundle evaluation.
    mock: true,
  },
});
