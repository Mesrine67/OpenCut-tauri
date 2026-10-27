import { defineConfig } from 'vitest/config'

// Keep unit tests independent from the Cloudflare Worker SSR environment used
// by vite.config.ts. The application currently has no test files, so the
// repository CI can still validate the test command without failing on an
// empty suite.
export default defineConfig({
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
  },
})
