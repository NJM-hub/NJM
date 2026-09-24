import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // 테스트에서는 서버 전용 가드를 비활성화
      "server-only": path.resolve(import.meta.dirname, "src/test/empty.ts"),
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
