/**
 * Next.js Server Instrumentation (Runtime startup validation hook)
 * Runs once when Next.js server initializes.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const isTest = process.env.NODE_ENV === 'test' || process.env.APP_ENV === 'test';
    const isBuild = process.env.NEXT_PHASE === 'phase-production-build';

    if (!isTest && !isBuild) {
      const jwtSecret = process.env.JWT_SECRET;
      const appEncryptionKey = process.env.APP_ENCRYPTION_KEY;

      if (!jwtSecret) {
        console.error('[Instrumentation] FATAL: JWT_SECRET environment variable is not set.');
        if (process.env.NODE_ENV === 'production') process.exit(1);
      } else if (jwtSecret.length < 32) {
        console.error('[Instrumentation] FATAL: JWT_SECRET must be at least 32 characters long.');
        if (process.env.NODE_ENV === 'production') process.exit(1);
      }

      if (!appEncryptionKey) {
        console.error('[Instrumentation] FATAL: APP_ENCRYPTION_KEY environment variable is not set.');
        if (process.env.NODE_ENV === 'production') process.exit(1);
      } else if (appEncryptionKey.length !== 64) {
        console.error('[Instrumentation] FATAL: APP_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).');
        if (process.env.NODE_ENV === 'production') process.exit(1);
      }

      // Auto-launch Telegram Bot Daemon in Node runtime if not skipped
      if (process.env.SKIP_BOT !== 'true') {
        try {
          const { launchBot } = await import('@/bot');
          launchBot().catch((botErr) => {
            console.warn('[Instrumentation] Telegram bot startup error:', botErr);
          });
          const { multiBotManager } = await import('@/bot/manager/multi-bot-manager');
          multiBotManager.initPool().catch((poolErr) => {
            console.warn('[Instrumentation] Multi-bot pool init error:', poolErr);
          });
        } catch (botImportErr) {
          console.warn('[Instrumentation] Failed to load bot module:', botImportErr);
        }
      }

      // Auto-launch Queue & Worker Watchdog Daemon in Node runtime
      if (process.env.SKIP_WATCHDOG !== 'true') {
        try {
          const { startWatchdogDaemon } = await import('@/lib/daemons/watchdog-daemon');
          startWatchdogDaemon();
        } catch (watchdogImportErr) {
          console.warn('[Instrumentation] Failed to load watchdog daemon:', watchdogImportErr);
        }
      }
    }
  }
}
