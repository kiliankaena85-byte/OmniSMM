# Progress Tracker

Last visited: 2026-06-05T06:46:00Z

- [/] Step 1: Create local sanitized database SQL dump (scripts/smmplan_lite_sanitized.sql) (In Progress - waiting for command approval)
- [ ] Step 2: Backup remote production database to /tmp/smmplan_lite_backup_before_migration.sql
- [ ] Step 3: Stop production containers (app, worker, bot)
- [ ] Step 4: Perform Docker system prune and flush Redis on the server
- [ ] Step 5: Transfer scripts/smmplan_lite_sanitized.sql to production /tmp
- [ ] Step 6: Replace remote database schema and restore dump
- [ ] Step 7: Restart production containers (app, worker, bot)
- [ ] Step 8: Verify Remote Status (logs of app, worker, bot)
- [ ] Step 9: Clean up temporary files locally and remotely
