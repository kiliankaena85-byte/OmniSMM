/**
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
export default {
  $schema: "https://raw.githubusercontent.com/stryker-mutator/stryker-js/master/packages/api/schema/stryker-core.json",
  packageManager: "npm",
  reporters: ["html", "clear-text", "progress", "dashboard"],
  testRunner: "vitest",
  testRunnerNodeArgs: ["--experimental-vm-modules"],
  coverageAnalysis: "perTest",
  mutate: [
    "src/services/financial/*.ts",
    "src/utils/refund.ts",
    "src/lib/financial-constants.ts",
    "!src/**/*.test.ts",
    "!src/**/*.spec.ts"
  ],
  vitest: {
    configFile: "vitest.config.ts"
  },
  thresholds: {
    high: 95,
    low: 85,
    break: 80 // Ошибка CI если Score падает ниже 80% (Финансовый код)
  },
  timeoutMS: 10000,
  concurrency: 4
};
