import { db } from "../src/lib/db";
import { getBaseUrlAsync } from "../src/utils/get-base-url";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Пожалуйста, укажите email в качестве аргумента.");
    process.exit(1);
  }

  const user = await db.user.findFirst({
    where: { email: email }
  });

  if (!user) {
    console.error(`Пользователь с email ${email} не найден.`);
    process.exit(1);
  }

  const token = await db.authToken.findFirst({
    where: { userId: user.id, used: false },
    orderBy: { createdAt: 'desc' }
  });

  if (!token) {
    console.error(`Активный токен для ${email} не найден. Запросите ссылку через форму входа.`);
    process.exit(1);
  }

  const baseUrl = await getBaseUrlAsync();
  const link = `${baseUrl}/api/auth/verify?token=${token.token}`;

  console.log(`\n[SUCCESS] Ссылка для входа для ${email}:`);
  console.log(link);
  console.log(`(Действительна до: ${token.expiresAt.toLocaleString("ru-RU")})\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
