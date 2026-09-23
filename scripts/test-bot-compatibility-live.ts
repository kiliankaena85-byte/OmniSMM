import * as dotenv from "dotenv";
dotenv.config();
import { db } from "@/lib/db";
import { isLinkServiceCompatible, normalizeServiceTargetType, getCompatibilityError } from "@/constants/link-service-compatibility";
import { IntelligenceLinkAnalyzer } from "@/services/analyzer/link-analyzer";

async function main() {
  console.log("=== VERIFYING ORDER SERVICE LINK COMPATIBILITY ===");
  const link = "https://t.me/smmMarket69";
  const analyzer = new IntelligenceLinkAnalyzer();
  const analysis = await analyzer.analyze(link);
  const detectedLinkType = analysis?.type || "generic_link";
  console.log(`Link: ${link}`);
  console.log(`Detected link type: ${detectedLinkType} (platform: ${analysis?.platform})`);

  // 1. Check "5 последних постов"
  const service5posts = await db.service.findFirst({
    where: { name: { contains: "5 последних постов" }, isActive: true }
  });
  if (service5posts) {
    const targetType = normalizeServiceTargetType(service5posts.targetType);
    const compatible = isLinkServiceCompatible(detectedLinkType, targetType);
    console.log(`\nService 1: "${service5posts.name}"`);
    console.log(`  DB targetType: ${service5posts.targetType}`);
    console.log(`  Normalized targetType: ${targetType}`);
    console.log(`  Compatible with "${detectedLinkType}"? ${compatible ? "✅ YES (PASS)" : "❌ NO (FAIL)"}`);
    if (!compatible) {
      console.log(`  Error: ${getCompatibilityError(detectedLinkType, targetType, service5posts.name)}`);
    }
  }

  // 2. Check "Последних 50 постов"
  const service50posts = await db.service.findFirst({
    where: { name: { contains: "Последних 50 постов" }, isActive: true }
  });
  if (service50posts) {
    const targetType = normalizeServiceTargetType(service50posts.targetType);
    const compatible = isLinkServiceCompatible(detectedLinkType, targetType);
    console.log(`\nService 2: "${service50posts.name}"`);
    console.log(`  DB targetType: ${service50posts.targetType}`);
    console.log(`  Normalized targetType: ${targetType}`);
    console.log(`  Compatible with "${detectedLinkType}"? ${compatible ? "✅ YES (PASS)" : "❌ NO (FAIL)"}`);
    if (!compatible) {
      console.log(`  Error: ${getCompatibilityError(detectedLinkType, targetType, service50posts.name)}`);
    }
  }

  // 3. Check "Telegram Подписчики"
  const serviceSubs = await db.service.findFirst({
    where: { name: "Telegram Подписчики", isActive: true }
  });
  if (serviceSubs) {
    const targetType = normalizeServiceTargetType(serviceSubs.targetType);
    const compatible = isLinkServiceCompatible(detectedLinkType, targetType);
    console.log(`\nService 3: "${serviceSubs.name}"`);
    console.log(`  DB targetType: ${serviceSubs.targetType}`);
    console.log(`  Normalized targetType: ${targetType}`);
    console.log(`  Compatible with "${detectedLinkType}"? ${compatible ? "✅ YES (PASS)" : "❌ NO (FAIL)"}`);
  }

  process.exit(0);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });