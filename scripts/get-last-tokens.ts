import { db } from "../src/lib/db";
import { getBaseUrlAsync } from "../src/utils/get-base-url";

async function main() {
  const tokens = await db.authToken.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { user: true }
  });

  const baseUrl = await getBaseUrlAsync();

  console.log("\n--- ПОСЛЕДНИЕ 5 ЗАПРОСОВ ВХОДА (MAGIC LINKS) ---");
  tokens.forEach((t) => {
    const link = `${baseUrl}/api/auth/verify?token=${t.token}`;
    console.log(`Email: ${t.user.email}`);
    console.log(`Ссылка: ${link}`);
    console.log(`Создано: ${t.createdAt.toLocaleString("ru-RU")}`);
    console.log(`Использовано: ${t.used ? "ДА" : "НЕТ"}`);
    console.log("------------------------------------------------");
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
