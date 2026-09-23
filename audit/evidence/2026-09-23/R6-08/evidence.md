# Evidence for R6-08: Health Check Verification (Public Fast Liveness vs Deep Readiness Probe)

## 1. Defect Analysis
- **Defect ID**: R6-08
- **Priority**: Low / Observability & Deployment
- **Component**: `/api/health` route (`src/app/api/health/route.ts`)
- **Claim**: Public health check does not query PostgreSQL/Redis (returns 'healthy' even if database is down). The deployment pipeline should verify deep readiness `/api/health?detailed=1`.

## 2. Verification & Live Reproduction (Level E2/E3/E4)
1. **Public Probe Verification (Zero DB/Redis DDoS Shield)**:
   ```bash
   GET http://127.0.0.1:3000/api/health
   ```
   **Output**:
   ```json
   {
     "status": "healthy",
     "timestamp": "2026-09-23T13:49:18.158Z"
   }
   ```
   *Behavior*: Caches response for 5 seconds in memory. Protects the database connection pool from connection exhaustion during high-frequency load balancer polling or external HTTP floods.

2. **Unauthorized Deep Probe Rejection (Security Gate)**:
   ```bash
   GET http://127.0.0.1:3000/api/health?detailed=1
   ```
   **Output (HTTP 401)**:
   ```json
   {
     "error": "Unauthorized: Admin session or valid Bearer token required"
   }
   ```

3. **Authorized Deep Probe Execution (Live Database & Redis Verification)**:
   ```bash
   GET http://127.0.0.1:3000/api/health?detailed=1
   Authorization: Bearer <CRON_SECRET>
   ```
   **Output (HTTP 200 OK)**:
   ```json
   {
     "status": "healthy",
     "timestamp": "2026-09-23T13:49:35.084Z",
     "database": {
       "status": "connected",
       "latencyMs": 22
     },
     "redis": {
       "status": "connected",
       "latencyMs": 23
     },
     "memory": {
       "rssBytes": 195510272,
       "heapTotalBytes": 105533440,
       "heapUsedBytes": 95977376,
       "externalBytes": 3834915,
       "heapUsedMB": 91.53,
       "rssMB": 186.45
     },
     "uptimeSeconds": 9676
   }
   ```

4. **Automated Unit & Integration Test Suite**:
   ```bash
   npx vitest run src/app/api/health/__tests__/health-route.test.ts
   ```
   **Result**: 6/6 tests PASS.

## 3. Status
- **Verdict**: Verified & Compliant. The dual architecture (public liveness probe + protected deep readiness probe) meets production defense requirements.
