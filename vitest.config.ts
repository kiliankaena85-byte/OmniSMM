import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '**/.temp/**', '**/.git/**', '**/e2e/**', '**/.agents/**', '**/.planning/**'],
    include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)', '**/test_round_table.ts'],
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    maxWorkers: 1,
    minWorkers: 1,
    retry: 3,
    testTimeout: 120000,
    hookTimeout: 120000,
    setupFiles: ['./test/setup.ts'],
    globals: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './node_modules/server-only/empty.js'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
      include: ['src/services/core/**', 'src/services/financial/**', 'src/actions/order/**']
    },
    fileParallelism: false,
    sequence: {
      concurrent: false
    }
  } as any
});
