## Current Status
Last visited: 2026-06-12T00:13:30+03:00
- [x] Investigate existing codebase for Compensation Loss Function requirements.
- [x] Examine `src/workers/processors/sync.processor.ts`.
- [x] Locate and analyze the database models in `prisma/schema.prisma` related to orders, providers, transactions, and refunds.
- [x] Design the structure of `CompensationService` (`src/services/financial/compensation.service.ts`) to compute the real margin delta.
- [x] Plan how to integrate it asynchronously into the sync processor.
