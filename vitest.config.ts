import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // The domain layer is pure, so it needs no DOM. Repository tests opt into
    // fake-indexeddb themselves via an import, and the route mount tests
    // (standards rule 14) opt into happy-dom via a `@vitest-environment`
    // docblock — per-file, because a DOM for the other 477 tests is waste.
    environment: 'node',
    // `.tsx` matters: without it the mount tests are silently collected as
    // nothing and the suite passes green having run none of them.
    include: ['src/**/*.test.{ts,tsx}', 'worker/**/*.test.ts'],
  },
})
