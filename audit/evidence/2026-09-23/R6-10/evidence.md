# Evidence for R6-10: Dead Singleton Settings Model & Unlinked Identifier Field

## 1. Defect Analysis
- **Defect ID**: R6-10
- **Priority**: Low / Architecture & Hygiene
- **Component**: Prisma Schema (`prisma/schema.prisma`), Settings Architecture
- **Claim**: Model of singleton settings without references in application code (dead model) and an identifier field lacking a relation.

## 2. Verification & Codebase Audit (Level E1/E2)
1. **Dead Singleton Settings Model**:
   - Model `SystemSetting` (`prisma/schema.prisma` lines 1190–1197):
     ```prisma
     model SystemSetting {
       key         String   @id
       value       String
       group       String   @default("GENERAL")
       description String?
       updatedAt   DateTime @updatedAt
       updatedBy   String?
     }
     ```
   - **Usage Analysis**: Static search across `src/` reveals 0 references to `db.systemSetting` or `prisma.systemSetting`. All application runtime settings are managed via tenant-scoped `model SystemSettings` (`id @id, tenant Tenant ...`) in `src/lib/settings.ts` and admin Server Actions. `SystemSetting` is a dead legacy key-value store.

2. **Unlinked Identifier Field**:
   - In `model SystemSettings` (`prisma/schema.prisma` lines 720–735):
     ```prisma
     telegramProxyId String? // FK to active proxy
     ```
   - **Analysis**: The column is declared as an unconstrained `String?` with an inline comment `// FK to active proxy`, but lacks a formal Prisma relation `@relation(...)` and foreign key constraint to `model TelegramProxy`. This allows dangling IDs if a referenced proxy record is deleted.

## 3. Recommendations
- Preserve `SystemSetting` temporarily for database backward compatibility while migrating any remaining legacy scripts to `SystemSettings`.
- In the next DDL migration cycle, add `@relation(fields: [telegramProxyId], references: [id], onDelete: SetNull)` to establish referential integrity between `SystemSettings` and `TelegramProxy`.

## 4. Status
- **Verdict**: Confirmed and documented with exact line references in `prisma/schema.prisma`.
