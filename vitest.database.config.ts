import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

/**
 * The tests that need a real Postgres. Kept out of `npm test` — which must run
 * on a laptop with nothing installed — and run by `npm run test:db` against a
 * server holding the migrations. See supabase/tests/seed.database.test.ts.
 */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    globals: true,
    include: ['supabase/tests/**/*.test.ts'],
  },
});
