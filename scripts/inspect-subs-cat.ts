import * as dotenv from "dotenv";
dotenv.config();
import { db } from "@/lib/db";
import { inferTargetTypeFromName } from "@/utils/target-type-mapper";
import { normalizeServiceTargetType, isLinkServiceCompatible } from "@/constants/link-service-compatibility";

async function main() {
  const cat = await db.category.findFirst({
    where: { name: { contains: "Подписчики на канал" } },
    include: { services: { where: { isActive: true, isQuarantined: false } } }
  });

  console.log(`Category: ${cat?.name}`);
  for (const s of cat!.services) {
    const rawTarget = s.targetType || inferTargetTypeFromName(s.name);
    const norm = normalizeServiceTargetType(rawTarget);
    const okForPost = isLinkServiceCompatible("post", norm);
    console.log(`- ${s.name}: targetType=${s.targetType}, inferred=${rawTarget}, norm=${norm}, okForPost=${okForPost}`);
  }
}
main().catch(console.error);