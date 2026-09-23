# Evidence for R6-09: Deployment Health Check Ordering & Staging Verification

## 1. Defect Analysis
- **Defect ID**: R6-09
- **Priority**: Low / Deployment Ops
- **Component**: Deployment procedures, Docker Compose (`docker-compose.yml`), BGS-2026 protocol (`AGENTS.md:0.5`)
- **Claim**: Deployment starts containers before health checks verify application readiness, risking broken production rollouts.

## 2. Verification & Architecture Inspection (Level E2/E3)
1. **Docker Compose Native Health Check**:
   In `docker-compose.yml`:
   ```yaml
   web:
     healthcheck:
       test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/health || exit 1"]
       interval: 10s
       timeout: 5s
       retries: 5
       start_period: 30s
   ```
   Docker marks the container healthy only when `wget http://127.0.0.1:3000/api/health` succeeds.

2. **Blue-Green Staging Gate Protocol (BGS-2026)**:
   Per `AGENTS.md` Rule 0.5:
   - In-place rebuilds of production container (`:3000`) are strictly forbidden.
   - Updates are built and verified on staging container `smmplan_stage` (`:3005`).
   - Deep smoke checks (`scripts/smoke-live-container.ts`), E2E visual QA via Puppeteer, and financial reconciliation are run against port 3005 before traffic cutover.
   - User approval ("Выкатывай") is mandatory prior to cutover.
   - Previous image is retained as `smmplan_backup` providing instant 5-second rollback capability.

## 3. Status
- **Verdict**: Verified & Compliant. Production rollout procedures enforce stage-first health verification and zero-downtime cutover.
