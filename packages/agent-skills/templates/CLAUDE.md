# Claude Code Contract for OmniSMM Platform
## Core Guidelines
- Read AGENTS.md at the start of every session.
- Respect .agents/skills/INDEX.md for architectural patterns:
  * Financial integrity: WalletOps + Ledger-First + ExactMath (BigInt kopecks).
  * Concurrency: P2002 idempotencyKey, Row-level locking.
  * Resilience: Redis Circuit Breaker, Bulkhead, AbortSignal timeouts.
  * Database: Zero-downtime expand/contract migrations.
- Always run `tsc --noEmit` and security checks before finalizing tasks.
