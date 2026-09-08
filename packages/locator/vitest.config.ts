import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'locator', include: ['test/**/*.test.ts'] },
});
