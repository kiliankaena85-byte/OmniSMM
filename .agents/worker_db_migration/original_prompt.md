## 2026-06-05T06:43:22Z
You are `worker_db_migration` (role: Database Migration Worker). Your working directory is d:\SMM_plan_2\.agents\worker_db_migration.
Your task is to dump the local sanitized database, transfer it to the production server `smmplan.pro`, perform system cleanups, replace the production database schema, and restart the production application services safely.

Please execute the following steps:
1. Create a SQL dump of the local sanitized database:
   - Run a command to dump the local PostgreSQL database to `scripts/smmplan_lite_sanitized.sql` using docker:
     `docker exec -t smmplan_lite_db pg_dump -U postgres smmplan_lite > scripts/smmplan_lite_sanitized.sql`
     (Or use another command if that doesn't capture the stdout correctly in the shell).
   - Verify that the generated file `scripts/smmplan_lite_sanitized.sql` exists and is non-empty.
2. Backup the production database:
   - Run pg_dump on the remote server via SSH to create a fallback backup before dropping anything:
     `ssh root@smmplan.pro "docker exec smmplan_lite_prod_db pg_dump -U postgres smmplan_lite > /tmp/smmplan_lite_backup_before_migration.sql"`
   - Confirm the remote backup file was successfully created.
3. Stop production containers to prevent race conditions during DB replacement:
   - Stop the app, worker, and bot containers on the production server:
     `ssh root@smmplan.pro "cd /opt/smmplan_lite && docker compose -f docker-compose.prod.yml stop app worker bot"`
4. Perform Docker and Redis cleanups on the server:
   - Prune stopped/unused Docker resources:
     `ssh root@smmplan.pro "docker system prune -a -f"`
   - Flush all Redis cache data:
     `ssh root@smmplan.pro "docker exec smmplan_lite_prod_redis redis-cli flushall"`
5. Transfer the sanitized database dump:
   - Copy `scripts/smmplan_lite_sanitized.sql` to the production server:
     `scp scripts/smmplan_lite_sanitized.sql root@smmplan.pro:/tmp/smmplan_lite_sanitized.sql`
6. Replace the remote database:
   - Copy the SQL file inside the remote database container:
     `ssh root@smmplan.pro "docker cp /tmp/smmplan_lite_sanitized.sql smmplan_lite_prod_db:/tmp/smmplan_lite_sanitized.sql"`
   - Drop and recreate the public schema inside the remote database to ensure a clean restoration:
     `ssh root@smmplan.pro "docker exec smmplan_lite_prod_db psql -U postgres -d smmplan_lite -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'"`
   - Restore the SQL dump into the remote database:
     `ssh root@smmplan.pro "docker exec smmplan_lite_prod_db psql -U postgres -d smmplan_lite -f /tmp/smmplan_lite_sanitized.sql"`
   - Clean up temp files inside the remote db container:
     `ssh root@smmplan.pro "docker exec smmplan_lite_prod_db rm /tmp/smmplan_lite_sanitized.sql"`
7. Restart the production containers:
   - Start the app, worker, and bot containers on the production server:
     `ssh root@smmplan.pro "cd /opt/smmplan_lite && docker compose -f docker-compose.prod.yml up -d"`
8. Verify Remote Status:
   - Retrieve and verify the last 50 lines of logs for the `app`, `worker`, and `bot` containers to confirm there are no startup crashes or Prisma connection errors:
     `ssh root@smmplan.pro "docker logs --tail 50 smmplan_lite_prod_app"`
     `ssh root@smmplan.pro "docker logs --tail 50 smmplan_lite_prod_worker"`
     `ssh root@smmplan.pro "docker logs --tail 50 smmplan_lite_prod_bot"`
   - Verify that the admin login works on production (this can be checked by verifying logs do not show errors, or performing a curl check, but focus on verifying no errors in app container logs).
9. Clean up local and remote files:
   - Delete the local SQL dump file `scripts/smmplan_lite_sanitized.sql`.
   - Delete the remote `/tmp/smmplan_lite_sanitized.sql` file on the server.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Save your results, command outputs, and the status of each step in a handoff report at `d:\SMM_plan_2\.agents\worker_db_migration\handoff.md` following the Handoff Protocol. Send a message to me with the path to the handoff and a summary of your results when you are done.
