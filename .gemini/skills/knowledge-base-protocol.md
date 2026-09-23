# Knowledge Base Protocol Skill

This skill provides a protocol for query retrieval and decision tracking utilizing the local GraphRAG knowledge base service.

## Mandatory Pre-Flight Task Verification

Before starting ANY code edits, refactorings, or business logic adjustments:
1. **Fetch Full Context**: Call the MCP tool `get_full_context` with your current task description.
2. **Review Conventions**: Call `search_knowledge` querying about Smmplan conventions matching the modified area (e.g., "pricing model", "payment gateways", "target type mapping", "Base UI Select").
3. **Verify Existing ADRs**: Search in the `architecture_decisions` collection for any related choices.

## Mandatory Post-Task Decision Documentation

After finishing any engineering tasks:
1. **Document Architectural Decisions**: If you chose an implementation strategy (e.g., choosing a package, creating a state pattern, writing a new utility module):
   - Call the `log_decision` tool.
   - Detail the chosen approach, alternatives rejected, and rationale.
2. **Log Newly Discovered Technical Debt**: If you noticed legacy constructs, code duplication, or unhandled edge cases:
   - Call the `add_knowledge` tool with category `tech_debt`.
3. **Record Added conventions**: If you created new helper patterns or visual protocols:
   - Call the `add_knowledge` tool with category `coding_conventions`.

## Project-Specific Reference Quick Links

- **Pricing Model**: Price per unit (`₽ / шт`) is retail, stored in `pricePerUnitRub`. Never display `pricePer1kRub` directly to clients.
- **Link Analyzer**: Expected `targetType` resolves depending on category. Fall back to `inferTargetTypeFromCategory(categoryName)` from `src/utils/target-type.ts`.
- **Payment Gateways**: Do not mock payments locally if credentials exist. Auto-fallback to test mode if test settings are present.
- **Base UI Select**: Selected label values must resolve with children-function trigger formatting.
- **Workers**: Run background queues parallel to the Next.js server on production.
