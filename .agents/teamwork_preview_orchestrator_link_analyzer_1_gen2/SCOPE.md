# Scope: Telegram Private Link Analyzer Verification

## Architecture
- `src/services/analyzer/link-analyzer.ts`: Performs link analysis, checks regexes and returns type and categories.
- `src/services/analyzer/link-rules.ts`: Defines rule configurations and patterns.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Static Code Audit | Audit current handling of t.me/c/ link formats in codebase | none | PLANNED |
| 2 | Unit Test Verification | Write and run Vitest test for private t.me/c/ link | M1 | PLANNED |
| 3 | Recommendation formulation | Define regex, rules, and UI changes | M2 | PLANNED |
| 4 | Final Reporting | Construct final report and hand off to parent | M3 | PLANNED |
