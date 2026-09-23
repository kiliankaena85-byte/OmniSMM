const fs = require('fs');
const path = require('path');

const requestText = `## Follow-up — 2026-06-09T12:01:25Z

## Расширенная спецификация аудита (v2)

Промпт был существенно расширен. Передай оркестратору следующие дополнения к текущему плану:

### 1. Полный перечень экранов (20 штук)
Кроме лендинга и мастера заказа, необходимо проверить:
- \`/login\` — авторизация
- \`/dashboard\` — дашборд пользователя (включая \`sidebar-nav.tsx\`)
- \`/dashboard/settings\` — настройки профиля и \`PasswordCard.tsx\`
- \`/dashboard/orders\` — история заказов
- \`/dashboard/add-funds\` — пополнение баланса
- \`/knowledge\`, \`/academy\` — база знаний
- Все модалы: \`PaymentGatewaySelectionModal\`, \`MassConfirmEmailModal\`, \`VisualLinkGuideModal\`
- Компоненты внутри лендинга: \`FAQ.tsx\`, \`Reviews.tsx\`, \`WhyUs.tsx\`, \`MegaFooter.tsx\`, \`TrustBar.tsx\`

### 2. Конкретные HOT SPOTS (зоны повышенного риска)
1. **\`MobileWizard.tsx\`** (950 строк / 46 КБ) — самый сложный компонент, высокий риск overflow и z-index конфликтов.
2. **\`StickyCheckoutBar.tsx\`** — проверить safe-area-inset для iPhone с вырезом, кнопка оплаты не должна перекрываться.
3. **\`PlatformLinkGuideDrawer.tsx\`** — недавно исправлен (скрыта mock-карта через \`hidden md:flex\`), подтвердить корректность.
4. **\`DynamicPayloadWarnings.tsx\`** (22 КБ) — длинные предупреждения могут overflow.
5. **\`VisualLinkGuideModal.tsx\`** (50 КБ) — модал визуального руководства, проверить viewport boundaries.
6. **Header.tsx** — три кнопки (Кабинет + Выйти + Бургер) должны помещаться в 320px.

### 3. Классификация дефектов
Каждый найденный баг — через severity:
- 🔴 P0 (Critical) — невозможно совершить действие
- 🟠 P1 (Major) — серьезная визуальная проблема
- 🟡 P2 (Minor) — косметика
- 🟢 P3 (Enhancement) — улучшение премиальности

### 4. Обязательные AI-скиллы для прочтения
Перед началом работы агенты должны прочитать SKILL.md следующих скиллов:
- \`gsd-premium-audit\` — аудит премиальности
- \`ru-cyrillic-typography\` — кириллическая типографика  
- \`ru-visual-culture\` — визуальная культура CIS
- \`gsd-ui-review\` — 6-pillar visual audit
- \`gsd-tailwind-v4-manifest\` — правила Tailwind 4

### 5. Три разрешения для тестирования
Все экраны проверить при: **320px** (iPhone SE), **390px** (iPhone 14), **430px** (iPhone 15 Pro Max).

### 6. Deliverables
- Markdown-отчёт со всеми дефектами (severity + скриншоты до/после + файл:строка)
- Код-фиксы всех P0 и P1 дефектов
- \`npm run lint\` = 0 errors, \`npx tsc --noEmit\` = clean`;

const paths = [
  path.join(__dirname, '..', '..', 'ORIGINAL_REQUEST.md'),
  path.join(__dirname, '..', 'original_prompt.md'),
  path.join(__dirname, 'ORIGINAL_REQUEST.md')
];

paths.forEach(p => {
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    if (!content.includes('## Follow-up — 2026-06-09T12:01:25Z')) {
      content += '\n\n' + requestText;
      fs.writeFileSync(p, content, 'utf8');
      console.log('Appended to ' + p);
    } else {
      console.log('Already exists in ' + p);
    }
  } else {
    fs.writeFileSync(p, '# Original User Request\n\n' + requestText, 'utf8');
    console.log('Created ' + p);
  }
});
