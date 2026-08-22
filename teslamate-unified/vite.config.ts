import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.TESLAMATE_API_URL || "http://192.168.50.8:8080";
  const token = env.API_TOKEN || "";
  const tokenDisabled = env.API_TOKEN_DISABLE === "true";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
          configure(proxy) {
            if (tokenDisabled || !token) return;
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.setHeader("Authorization", `Bearer ${token}`);
            });
          },
        },
      },
    },
    build: {
      outDir: "dist",
    },
  };
});
