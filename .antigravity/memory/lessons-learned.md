# AEARH Lessons Learned

1. **Sprint 01 Baseline Cleanliness:** Audit packs submitted with uncommitted baseline state lead to non-deterministic verification results. Baseline tree state must be clean or explicitly accepted with `--allow-dirty`.
2. **Automated Evidence Validation:** Relying on human manual review of claims causes overclaiming of evidence levels. Automated schema and validator enforcement ensures integrity.
3. **Continuous Reconciliation:** Running SQL reconciliation queries on non-empty seed datasets is essential to catch edge-case anomalies before production deployment.
