import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [
      ["tests/generateTour.test.tsx", "jsdom"],
      ["tests/onboardingFlow.test.tsx", "jsdom"],
      ["tests/onboardingMotion.test.tsx", "jsdom"],
    ],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    testTimeout: 180_000,
    hookTimeout: 120_000,
  },
});
