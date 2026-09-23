import { db } from "../src/lib/db";
import { revalidateTag } from "next/cache";

async function main() {
  const action = (process.argv[2] || "status").toLowerCase();

  console.log("\n🛑 ================================================================");
  console.log("   OMNISMM 1.0 — EMERGENCY KILLSWITCH & DISASTER RECOVERY CLI");
  console.log("================================================================\n");

  const settings = await db.systemSettings.findFirst();
  if (!settings) {
    console.error("❌ Error: No SystemSettings record found in database.");
    process.exit(1);
  }

  if (action === "status") {
    console.log("📡 Current Platform Status:");
    console.log("   - Active Tenant:            " + settings.id.toUpperCase());
    console.log("   - Environment Mode:         " + (settings.isTestMode ? "🟡 SANDBOX / TEST" : "🚀 PRODUCTION (LIVE)"));
    console.log("   - Web Maintenance Mode:     " + (settings.maintenanceMode ? "🔴 ACTIVE (BLOCKED)" : "🟢 NORMAL (LIVE)"));
    console.log("   - Telegram Bot Maintenance: " + (settings.telegramMaintenanceMode ? "🔴 ACTIVE (PAUSED)" : "🟢 NORMAL (LIVE)"));
    console.log("   - Tax Regime:               " + settings.usnScheme + " (" + settings.taxRate + "%)");
    console.log("   - Brand / Site Name:        " + settings.siteName);
    console.log("\nCommands available:");
    console.log("   npm run killswitch:on   -> Activate full emergency lockdown");
    console.log("   npm run killswitch:off  -> Restore full live production");
    console.log("================================================================\n");
    process.exit(0);
  }

  if (action === "on" || action === "enable" || action === "lock") {
    console.log("⚠️  ACTIVATING EMERGENCY KILLSWITCH LOCKDOWN...");
    await db.systemSettings.updateMany({
      data: {
        maintenanceMode: true,
        telegramMaintenanceMode: true,
      },
    });
    try {
      revalidateTag("system-settings");
    } catch {}

    console.log("✅ [KILLSWITCH ENGAGED] Web storefronts and Telegram bot are now in Maintenance Mode.");
    console.log("🛡️  All new orders are protected from external provider dispatch.");
    console.log("================================================================\n");
    process.exit(0);
  }

  if (action === "off" || action === "disable" || action === "unlock") {
    console.log("🚀 DISENGAGING KILLSWITCH — RESTORING PRODUCTION...");
    await db.systemSettings.updateMany({
      data: {
        maintenanceMode: false,
        telegramMaintenanceMode: false,
      },
    });
    try {
      revalidateTag("system-settings");
    } catch {}

    console.log("✅ [KILLSWITCH DISENGAGED] Platform restored to live operation.");
    console.log("================================================================\n");
    process.exit(0);
  }

  console.log("Unknown command. Use: status | on | off");
  process.exit(1);
}

main().catch((err) => {
  console.error("Killswitch execution error:", err);
  process.exit(1);
});
