import { db } from '../src/lib/db';

/** Транслитерация кириллических названий в безопасный латинский slug */
function transliterate(str: string): string {
  const ru: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };
  return str
    .toLowerCase()
    .split('')
    .map(char => ru[char] || char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function backfillServiceSlugs() {
  console.log('🚀 Начинаем backfill слагов для таблиц Service...');
  const services = await db.service.findMany({
    select: { id: true, name: true, numericId: true, slug: true, tenantId: true }
  });

  let updated = 0;
  for (const s of services) {
    if (!s.slug) {
      const baseSlug = transliterate(s.name);
      const uniqueSlug = `${baseSlug}-${s.numericId}`;
      await db.service.update({
        where: { id: s.id },
        data: { slug: uniqueSlug }
      });
      updated++;
    }
  }

  console.log(`✅ Backfill успешно завершен. Обновлено сервисов: ${updated}/${services.length}`);
}

backfillServiceSlugs()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Ошибка при выполнении backfill:', err);
    process.exit(1);
  });
