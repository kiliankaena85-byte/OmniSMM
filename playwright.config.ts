import { defineConfig, devices } from '@playwright/test';

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

if (fs.existsSync(path.resolve(process.cwd(), '.env.test'))) {
  dotenv.config({ path: '.env.test' });
} else {
  dotenv.config();
}


export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/_legacy/**', '**/utils/**', '**/fixtures/**'],
  globalTeardown: './e2e/utils/db-cleaner.ts',
  timeout: 60 * 1000,
  expect: {
    timeout: 5000,
  },
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        channel: 'chrome',
      },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/playwright/.auth/user.json',
        channel: 'chrome',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npx dotenv-cli -e .env.test -- npx next dev --port 3001 --hostname 127.0.0.1',
    url: 'http://127.0.0.1:3001',
    reuseExistingServer: true,
    timeout: 120 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
