import * as dotenv from "dotenv";
dotenv.config();
import { db } from "@/lib/db";
import { isLinkServiceCompatible } from "@/constants/link-service-compatibility";
import { detectNetworkAndType } from "@/validators/link-mutators";

async function main() {
  console.log("=== VERIFY BOT ORDER LOGIC FOR https://t.me/smmMarket69 ===");
  const link = "https://t.me/smmMarket69";
  const detected = detectNetworkAndType(link);
  console.log("1. Detected link info:", detected);

  // 2. Check last 5 posts service
  const service5posts = await db.service.findFirst({
    where: { name: { contains: "5 последних постов" }, isActive: true }
  });
  console.log("\n2. Service (5 последних постов):", {
    id: service5posts?.id,
    name: service5posts?.name,
    targetType: service5posts?.targetType,
  });

  const isCompatible5 = isLinkServiceCompatible(detected.detectedType, service5posts?.targetType);
  console.log("   Is compatible with channel link?", isCompatible5 ? "✅ YES" : "❌ NO");

  // 3. Check subscribers service
  const serviceSubs = await db.service.findFirst({
    where: { name: "Telegram Подписчики", isActive: true }
  });
  console.log("\n3. Service (Подписчики):", {
    id: serviceSubs?.id,
    name: serviceSubs?.name,
    targetType: serviceSubs?.targetType,
  });

  const isCompatibleSubs = isLinkServiceCompatible(detected.detectedType, serviceSubs?.targetType);
  console.log("   Is compatible with channel link?", isCompatibleSubs ? "✅ YES" : "❌ NO");

  // 4. Check Circuit Breaker
  const settings = await db.systemSettings.findFirst({ where: { tenantId: "smmplan" } });
  const ageHours = settings?.exchangeRateUpdatedAt ? ((Date.now() - settings.exchangeRateUpdatedAt.getTime()) / (1000 * 3600)) : 999;
  console.log("\n4. SystemSettings for smmplan:", {
    exchangeRateUSD: settings?.exchangeRateUSD,
    exchangeRateUpdatedAt: settings?.exchangeRateUpdatedAt,
    ageHours: ageHours.toFixed(2)
  });

  if (ageHours > 48) {
    console.error("❌ CIRCUIT BREAKER ACTIVE! Rate is too old.");
  } else {
    console.log("✅ CIRCUIT BREAKER PASS! Exchange rate is fresh (<48h).");
  }

  process.exit(0);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });