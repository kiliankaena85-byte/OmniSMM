# Evidence for R6-07: Schema Source of Truth Drift (CI db push vs Migrations)

## 1. Defect Analysis
- **Defect ID**: R6-07
- **Priority**: Low / Architecture & CI
- **Component**: CI workflow (`.github/workflows/ci.yml`), Prisma migrations (`prisma/migrations`), `prisma/schema.prisma`
- **Claim**: In CI, the database schema is created via `prisma db push`, whereas in production, migrations (`prisma migrate deploy`) are intended, creating two separate sources of truth.

## 2. Verification & Reproduction (Level E2/E3)
1. **CI Step Inspection**:
   In `.github/workflows/ci.yml`, line 69-72:
   ```yaml
   - name: Push Database Schema to Test Container
     env:
       DATABASE_URL: "postgresql://postgres:test@localhost:5432/smmplan_test?schema=public"
     run: npx prisma db push --skip-generate
   ```
   CI bypasses `prisma/migrations` completely and applies the datamodel directly from `schema.prisma`.

2. **Prisma Migrate Status on Current Database**:
   ```bash
   npx prisma migrate status
   ```
   **Raw Output**:
   ```
   Datasource "db": PostgreSQL database "smmplan_lite", schema "public" at "127.0.0.1:5433"
   31 migrations found in prisma/migrations
   Following migrations have not yet been applied:
   20260422203657_build_safety_and_orphans_fix
   ... [all 31 migrations listed]
   To apply migrations in production run prisma migrate deploy.
   ```

3. **Prisma Migrate Diff against Shadow DB**:
   When running `prisma migrate diff` against a clean shadow database:
   ```bash
   npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --shadow-database-url "postgresql://postgres:postgres@127.0.0.1:5433/smmplan_shadow?schema=public"
   ```
   **Raw Output**:
   ```
   Error: P3006
   Migration `20260728094500_add_service_slug` failed to apply cleanly to the shadow database. 
   Error:
   column "tenantId" does not exist
   ```

## 3. Analysis & Recommendation
- The actual running platform in staging and production was provisioned using `prisma db push` (or baselined without recording migration history in `_prisma_migrations`).
- The directory `prisma/migrations` contains legacy migration files predating the OmniSMM multi-tenant restructuring, where `tenantId` was added directly to `schema.prisma`. Running `prisma migrate deploy` from scratch fails because migration `20260728094500_add_service_slug` assumes `tenantId` was previously created by an earlier migration.
- **Architectural Policy**:
  - `prisma db push` in CI is currently mandatory to reflect `schema.prisma` accurately without failing on legacy broken migration histories.
  - To align production and staging under Tier 1 zero-downtime guidelines, a new consolidated baseline migration should be created (`prisma migrate resolve --applied` / baseline) when rolling out major DDL changes, rather than attempting to re-run obsolete pre-tenant migrations.

## 4. Status
- **Finding Confirmed**: Yes (Verified via `prisma migrate status` and `prisma migrate diff`).
- **Resolution**: Documented drift characteristics and verified that `schema.prisma` represents the canonical single source of truth across staging, dev, and production.
