# Scope: Telegram Private Link Analyzer Investigation

## Architecture
- **Target Files**:
  - `src/services/analyzer/link-analyzer.ts`: Performs classification of links using rules defined in `link-rules.ts`.
  - `src/services/analyzer/link-rules.ts`: Defines rule patterns, categories, and attributes of various types of links (e.g. YouTube, Telegram, Instagram).
- **Test Infrastructure**:
  - Vitest-based unit tests to verify the classification and output of the analyzer.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | Static Analysis | Examine regexes and rules in `link-analyzer.ts` and `link-rules.ts` to locate how `t.me/c/ID/ID` is processed. | None | PLANNED |
| 2 | Current Unit Test | Write and run a Vitest test demonstrating the behavior of the current code on `https://t.me/c/2341882599/1046`. | M1 | PLANNED |
| 3 | Recommendations | Design the new regex, rule configurations for `link-rules.ts`, and specify UI handling logic for private channels. | M2 | PLANNED |
| 4 | Final Reporting | Consolidate findings, code structures, test outputs, and recommendation details into the final report. | M3 | PLANNED |

## Interface Contracts
- `IntelligenceLinkAnalyzer.analyze(url: string)` returns an object describing the link type, validity, suggested categories, etc.
- Private links configuration: `type: "private_post"`, `isPrivate: true`, `suggestedCategories: []`.
