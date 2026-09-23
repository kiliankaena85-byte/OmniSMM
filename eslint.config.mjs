import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "no-unused-vars": "off",
      "no-undef": "off"
    }
  },
  {
    files: [
      "test/**/*.ts",
      "test/**/*.tsx",
      "e2e/**/*.ts",
      "scripts/**/*.ts",
      "scripts/**/*.js",
      "scripts/**/*.mjs",
      "prisma/**/*.ts",
      "*.ts",
      "*.mjs",
      "src/**/__tests__/**/*.ts",
      "src/**/__tests__/**/*.tsx",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/**/*.spec.ts",
      "src/**/*.spec.tsx"
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off"
    }
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "out/**",
      "build/**",
      "scratch/**",
      ".agents/**",
      ".agent/**",
      "dist_patch/**",
      "scripts/**",
      "test/**",
      "tests/**",
      "test-results/**",
      "playwright-report/**",
      "teamwork_projects/**",
      "test*.js",
      "test-async-throw.ts",
      "test-floating-promise.ts"
    ]
  }
);
