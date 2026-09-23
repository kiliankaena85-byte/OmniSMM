import fetch from 'node-fetch';

const API_URL = 'http://localhost:8100/api/knowledge';

interface KnowledgeEntry {
  content: string;
  category: string;
  title: string;
  tags: string[];
  metadata?: Record<string, any>;
}

const entries: KnowledgeEntry[] = [
  {
    title: 'Legal Documents Migration to Individual Entrepreneur (ИП)',
    category: 'legal_and_compliance',
    tags: ['legal', 'terms', 'privacy', 'refund', 'cookie', 'ip', 'individual-entrepreneur'],
    content: `## Переход на ИП для SMM-панели (Legal & Compliance)
В рамках миграции с Самозанятости на ИП (Индивидуальный предприниматель) были обновлены следующие юридические документы:
1. **Агентская модель (Гл. 52 ГК РФ)**: Явно прописана в Оферте, что Администратор (ИП) выступает Агентом, действующим по поручению Пользователя (Принципала). Это легализует прием платежей и передачу заказов провайдерам.
2. **Возрастной ценз (18+)**: Добавлен во все документы. Лицам до 18 лет использование сервиса запрещено, что защищает от претензий родителей.
3. **Версионирование**: Добавлено версионирование документов (например, 'OFFER-v1-{{DATE}}').
4. **Интеллектуальная собственность**: В Оферту добавлен раздел, защищающий код, дизайн, базы данных и тексты сайта от копирования.
5. **Изменение условий**: Администратор имеет право менять оферту с уведомлением за 7 дней.
6. **Юридически значимый канал связи**: Email закреплен как официальный канал связи. Письмо считается полученным через 24 часа после отправки.
7. **Трансграничная передача**: В Политике конфиденциальности закреплено, что публичные данные (ссылки) передаются международным провайдерам для выполнения заказа, но остальные ПД (email, IP) хранятся в РФ.
8. **Хранение и удаление ПД (152-ФЗ)**: Срок хранения персональных данных составляет 3 года с момента последней активности. При запросе на удаление данные уничтожаются в течение 30 дней.
9. **Разрешение противоречий (Privacy vs Refund)**: Сделано исключение в Privacy Policy для передачи IP-адресов и email платежным шлюзам в случае оспаривания платежа (защита от Friendly Fraud).
10. **Минимальная сумма вывода**: Для возврата средств на карту установлен лимит в 500 ₽ для минимизации убытков на банковских комиссиях.
11. **Cookie Policy**: Добавлена прямая ссылка на Политику конфиденциальности для соответствия стандартам прозрачности.

Скрипт сидирования документов в БД: 'scripts/seed-legal.ts'. Документы рендерятся через 'ContentItem' с подстановкой плейсхолдеров ({{LEGAL_ENTITY}}, {{SUPPORT_EMAIL}}) из настроек приложения ('SettingsProvider').`
  }
];

async function run() {
  console.log('Seeding legal context to Vector DB / RAG...');
  
  for (const entry of entries) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      });
      
      if (response.ok) {
        console.log(`✅ Seeded: "${entry.title}"`);
      } else {
        const errText = await response.text();
        console.error(`❌ Failed to seed "${entry.title}": ${response.status} - ${errText}`);
      }
    } catch (error: any) {
      console.error(`❌ Network error seeding "${entry.title}": ${error.message}`);
    }
  }
  
  console.log('RAG Knowledge execution finished.');
}

run();
