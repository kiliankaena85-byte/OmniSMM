# Admin Panel Mocks & Stubs Audit Report (Smmplan)
Date: June 2026

This document serves as a knowledge base entry for GraphRAG indexing to inform AI agents about known mocked/stubbed functionality in the Smmplan admin panel. DO NOT rely on these functions as working business logic.

## 1. Feature Flags (System)
- **File**: `src/services/system/feature-flag.service.ts`
- **Description**: Global feature toggles exist in the DB, but their state is ignored by the actual business logic. The `isEnabled()` method is functionally dead.

## 2. COP Usability Simulator
- **File**: `src/actions/admin/settings.ts` -> `runCopSimulation()`
- **Description**: The usability simulator does not perform UI tests. It returns hardcoded objects (`CLIENT_ORDER`, `SUPPORT_TICKET`, `ROLE_CHANGE`) with static `clicks` and `cognitiveLoad` values, pretending to do mathematical analysis.

## 3. Referral Economics Chart
- **File**: `src/app/admin/marketing/referral-chart.tsx`
- **Description**: Does not fetch historical transaction data. Uses hardcoded month names (Jan-May) and scales current total values by hardcoded percentages (0.15, 0.35, 0.60, 0.80, 1.0) to simulate an upward trend.

## 4. Bot/Quality Detector Processor
- **File**: `src/workers/processors/quality-detector.processor.ts` -> `scanSubscriberQuality()`
- **Description**: The silent subscriber quality detector is a completely random mock. It generates fake 8-byte hexadecimal IDs and randomly flags 12% of them as bots using `Math.random()`, assigning random reasons like `NO_PHOTO`. These fake events are then persisted into the `SmartDetectedUser` database table, polluting the database.
