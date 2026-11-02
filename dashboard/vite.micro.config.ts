import path from "node:path";
import react from "@vitejs/plugin-react";
import { qiankun } from "@qiankunjs/bundler-plugin/vite";
import {
  defaultAllowedOrigins,
  defineConfig,
  loadEnv,
  type UserConfig,
} from "vite";
import standaloneConfig from "./vite.config";

export default defineConfig(async (configEnv): Promise<UserConfig> => {
  const config = await standaloneConfig(configEnv);
  const env = loadEnv(configEnv.mode, process.cwd(), "");
  const port = Number(env.VITE_DEV_PORT || 7101);
  const apiBase =
    env.BASE_URL ||
    (configEnv.command === "serve" ? `http://localhost:${port}` : "");
  if (!/^https?:\/\//.test(apiBase)) {
    throw new Error(
      "Micro frontend builds require an absolute http(s) BASE_URL for the Octop API",
    );
  }
  const htmlEntry = path.resolve(__dirname, "micro.html");
  return {
    ...config,
    base: env.OCTOP_MICRO_BASE || "/",
    plugins: [
      react(),
      qiankun(),
      {
        name: "octop-micro-lifecycles",
        enforce: "post",
        apply: "build",
        transform(code, id) {
          // Vite 6's HTML facade otherwise drops the lifecycle exports.
          if (id === htmlEntry)
            return (
              code +
              '\nexport { bootstrap, mount, unmount } from "./src/micro-frontend.tsx";\n'
            );
        },
      },
    ],
    define: {
      ...config.define,
      BASE_URL: JSON.stringify(apiBase.replace(/\/$/, "")),
    },
    css: {
      ...config.css,
      postcss: {
        plugins: [
          {
            postcssPlugin: "octop-micro-document-selectors",
            Rule(rule) {
              rule.selector = rule.selector
                .replace(/(^|[\s,>+~])html\b/g, "$1#octop-micro-root")
                .replace(/(^|[\s,>+~])body\b/g, "$1.octop-micro-body")
                .replace(/:root\b/g, "#octop-micro-root");
            },
          },
        ],
      },
    },
    server: { ...config.server, port, strictPort: true },
    preview: {
      cors: { origin: [defaultAllowedOrigins, "http://zh-mac.local:8010"] },
    },
    build: {
      ...config.build,
      outDir: path.resolve(__dirname, "dist/micro"),
      rollupOptions: {
        ...config.build?.rollupOptions,
        input: htmlEntry,
        preserveEntrySignatures: "strict",
      },
    },
  };
});
