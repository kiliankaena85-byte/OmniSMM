const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const brainDir = 'C:\\Users\\Артём\\.gemini\\antigravity\\brain\\ea87e47f-6c01-4f46-a059-22edfe85dc53';
const mdPath = path.join(brainDir, 'smmplan_support_legal_playbook.md');
const pdfPath = path.join(brainDir, 'smmplan_support_legal_playbook.pdf');
const htmlPath = path.join(__dirname, 'temp_presentation.html');

if (!fs.existsSync(mdPath)) {
  console.error('Error: Markdown playbook file not found at:', mdPath);
  process.exit(1);
}

const mdContent = fs.readFileSync(mdPath, 'utf8');

function parseCase(md, titleSearch) {
  const caseStart = md.indexOf(titleSearch);
  if (caseStart === -1) return null;
  let caseEnd = md.indexOf('### Кейс', caseStart + 10);
  if (caseEnd === -1) {
    caseEnd = md.indexOf('## 🛡️ РАЗДЕЛ 3', caseStart + 10);
  }
  return md.substring(caseStart, caseEnd).trim();
}

const casesTitles = [
  { key: "Кейс 1. Угроза полицией", slideNum: 3, title: "Слайд 3. Угроза полицией (ст. 159 УК РФ)" },
  { key: "Кейс 2. Угроза жалобами в ФНС", slideNum: 4, title: "Слайд 4. Угроза проверками ФНС и РКН (54-ФЗ / 152-ФЗ)" },
  { key: "Кейс 3. Шантаж DDoS-атаками", slideNum: 5, title: "Слайд 5. Шантаж DDoS, взломом и сливом (ст. 163 УК РФ)" },
  { key: "Кейс 4. Угроза судом за «незаконную накрутку»", slideNum: 6, title: "Слайд 6. Иски за «незаконную накрутку» (ОКВЭД 63.11)" },
  { key: "Кейс 5. Угроза судом по Закону о защите прав потребителей", slideNum: 7, title: "Слайд 7. Иски по ЗоЗПП и удержание ФПР (ст. 32 ЗоЗПП)" },
  { key: "Кейс 6. Оскорбления матом, капс и угроза расправой", slideNum: 8, title: "Слайд 8. Защита сотрудников при оскорблениях и матах" },
  { key: "Кейс 7. Отказ провайдера в гарантийном восстановлении", slideNum: 9, title: "Слайд 9. Отказ провайдера в восстановлении (Refill Default)" }
];

const renderedCases = [];

casesTitles.forEach((info) => {
  const caseText = parseCase(mdContent, info.key);
  if (!caseText) return;

  const lines = caseText.split('\n');
  const mainTitle = lines[0].replace('###', '').trim();
  
  let situationText = '';
  let lawText = '';
  let replyText = '';

  let section = '';
  lines.slice(1).forEach(line => {
    if (line.includes('*   **Суть инцидента:**') || line.includes('*   **Суть:**')) {
      section = 'situation';
      situationText += line.replace(/\*\s+\*\*Суть инцидента:\*\*|\*\s+\*\*Суть:\*\*/, '').trim() + ' ';
    } else if (line.includes('*   **Правовой комментарий:**') || line.includes('*   **Правовые основания:**') || line.includes('*   **Регламент:**') || line.includes('*   **Правило:**')) {
      section = 'law';
      lawText += line.replace(/\*\s+\*\*Правовой комментарий:\*\*|\*\s+\*\*Правовые основания:\*\*|\*\s+\*\*Регламент:\*\*|\*\s+\*\*Правило:\*\*/, '').trim() + ' ';
    } else if (line.includes('*   **Отработка:**')) {
      section = 'reply';
    } else {
      if (section === 'situation') {
        situationText += line.trim() + ' ';
      } else if (section === 'law') {
        lawText += line.trim() + ' ';
      } else if (section === 'reply') {
        replyText += line + '\n';
      }
    }
  });

  let badReply = '';
  let goodReply = '';
  if (replyText.includes('❌ Как НЕЛЬЗЯ:')) {
    const splitParts = replyText.split('✅ Как НАДО:');
    badReply = splitParts[0].replace('❌ Как НЕЛЬЗЯ:', '').replace(/>/g, '').trim();
    goodReply = splitParts[1] ? splitParts[1].replace(/>/g, '').trim() : '';
  } else {
    goodReply = replyText.replace(/>/g, '').trim();
  }

  renderedCases.push({
    title: info.title,
    slideNum: info.slideNum,
    mainTitle,
    situationText: situationText.trim(),
    lawText: lawText.trim(),
    badReply: badReply.trim(),
    goodReply: goodReply.trim()
  });
});

let caseSlidesHtml = '';
renderedCases.forEach((c) => {
  const badReplyBlock = c.badReply ? `
    <div class="p-3 rounded-lg bg-rose-950/20 border border-rose-900/30 text-rose-400 text-xs">
      <span class="font-bold text-rose-500">❌ ОШИБКА САППОРТА:</span> ${c.badReply}
    </div>
  ` : '';

  caseSlidesHtml += `
  <div class="slide">
    <div class="flex justify-between items-center border-b border-slate-800 pb-3">
      <div class="text-sm font-semibold tracking-wider text-brand uppercase">${c.title}</div>
      <div class="text-lg font-bold text-white tracking-widest">SMMPLAN</div>
    </div>
    
    <div class="grid grid-cols-12 gap-6 my-auto items-stretch">
      <div class="col-span-5 space-y-4 flex flex-col justify-center">
        <div class="p-5 rounded-xl bg-slate-900/50 border border-slate-800/80">
          <div class="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-1">Инцидент / Претензия</div>
          <p class="text-slate-200 text-sm leading-relaxed italic font-medium">«${c.situationText}»</p>
        </div>
        
        <div class="p-5 rounded-xl bg-slate-900/30 border border-slate-800/50">
          <div class="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-1">Юридическое обоснование</div>
          <p class="text-slate-300 text-xs leading-relaxed">${c.lawText}</p>
        </div>
      </div>
      
      <div class="col-span-7 flex flex-col justify-center gap-4">
        ${badReplyBlock}
        
        <div class="p-5 rounded-xl bg-emerald-950/10 border border-emerald-500/20 text-slate-100">
          <div class="text-xs font-semibold tracking-wider text-emerald-500 uppercase mb-2 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            Рекомендуемый ответ поддержки (Шаблон)
          </div>
          <div class="text-xs leading-relaxed font-mono whitespace-pre-line text-slate-300 max-h-[140mm] overflow-y-auto bg-slate-950/40 p-4 rounded-lg border border-slate-800/40">${c.goodReply}</div>
        </div>
      </div>
    </div>

    <div class="flex justify-between items-center border-t border-slate-800 pt-3 text-xs text-slate-500">
      <div>${c.mainTitle}</div>
      <div>Стр. ${c.slideNum} из 11</div>
    </div>
  </div>
  `;
});

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Smmplan Support Legal Playbook Presentation</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 landscape;
      margin: 0;
    }
    body {
      margin: 0;
      background-color: #080c14;
      color: #f1f5f9;
      font-family: 'Inter', sans-serif;
      -webkit-print-color-adjust: exact;
    }
    .slide {
      width: 297mm;
      height: 210mm;
      box-sizing: border-box;
      padding: 15mm 20mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
      position: relative;
      overflow: hidden;
      background: radial-gradient(circle at 10% 20%, rgba(15, 23, 42, 0.95) 0%, rgba(9, 12, 22, 1) 90%);
    }
    ::-webkit-scrollbar {
      display: none;
    }
    code {
      font-family: monospace;
      color: #38bdf8;
    }
    blockquote {
      border-left: 4px solid #6366f1;
      padding-left: 1rem;
      margin: 0.5rem 0;
      color: #cbd5e1;
      font-style: italic;
    }
    ul {
      list-style-type: disc;
      padding-left: 1.5rem;
      margin-bottom: 0.5rem;
    }
    li {
      margin-bottom: 0.25rem;
    }
  </style>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: '#6366f1',
            accent: '#3b82f6',
            success: '#10b981',
            danger: '#ef4444',
            warning: '#f59e0b',
          }
        }
      }
    }
  </script>
</head>
<body>
  <div id="presentation">
    <!-- Slide 1: Title Slide -->
    <div class="slide justify-center items-center text-center">
      <div class="space-y-6 max-w-4xl p-10 rounded-3xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-md">
        <div class="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider text-brand bg-brand/10 border border-brand/20 uppercase">
          Внутреннее обучение • 2026
        </div>
        <h1 class="text-5xl font-extrabold tracking-tight text-white leading-tight">
          Юридический и маркетинговый плейбук службы поддержки Smmplan
        </h1>
        <p class="text-xl text-slate-400 max-w-2xl mx-auto">
          Единый справочник по разрешению конфликтных ситуаций, работе с токсичными пользователями и противодействию угрозам
        </p>
        <div class="pt-8 text-sm text-slate-500">
          ИП Соколов А.А. • Конфиденциально
        </div>
      </div>
    </div>

    <!-- Slide 2: Philosophy (Section 1) -->
    <div class="slide">
      <div class="flex justify-between items-center border-b border-slate-800 pb-3">
        <div class="text-sm font-semibold tracking-wider text-brand uppercase">Слайд 2. Философия симбиоза</div>
        <div class="text-lg font-bold text-white tracking-widest">SMMPLAN</div>
      </div>
      
      <div class="grid grid-cols-2 gap-6 my-auto items-stretch">
        <div class="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60 flex flex-col justify-between">
          <div>
            <div class="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span class="p-1.5 rounded bg-brand/10 text-brand">🛡️</span>
              Приоритеты «Двойного Ядра»
            </div>
            <ul class="text-slate-300 text-sm space-y-4 list-none pl-0">
              <li class="flex gap-2">
                <span class="text-brand font-bold">1.</span>
                <span><strong>Юридическая безопасность (Legal Hardening)</strong>: Защита интересов платформы Исполнителя, исключение формулировок, которые могут трактоваться как признание вины или нарушение законов РФ.</span>
              </li>
              <li class="flex gap-2">
                <span class="text-brand font-bold">2.</span>
                <span><strong>Маркетинговая клиентоориентированность (Care & Conversion)</strong>: Сглаживание конфликтов, сохранение лояльности пользователей, удержание клиентов и минимизация репутационных рисков.</span>
              </li>
            </ul>
          </div>
          <div class="mt-4 p-3 rounded-xl bg-brand/5 border border-brand/10 text-xs text-brand/80">
            💡 <strong>Золотое правило:</strong> Эмпатия без признания вины Исполнителя.
          </div>
        </div>
        
        <div class="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60 flex flex-col justify-between">
          <div>
            <div class="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span class="p-1.5 rounded bg-accent/10 text-accent">🗣️</span>
              Профессиональный словарь (Замена терминов)
            </div>
            <div class="space-y-4 text-xs">
              <div class="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg text-rose-300">
                <span class="font-bold">❌ Токсично:</span> <span>накрутка ботов / списания / отписки</span>
              </div>
              <div class="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-emerald-300">
                <span class="font-bold">✅ Профессионально:</span> <span>автоматизация продвижения показателей / корректировка счетчиков</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-between items-center border-t border-slate-800 pt-3 text-xs text-slate-500">
        <div>Плейбук службы поддержки Smmplan</div>
        <div>Стр. 2 из 11</div>
      </div>
    </div>

    <!-- Slides 3-9: Cases -->
    ${caseSlidesHtml}

    <!-- Slide 10: Chargeback Protocol -->
    <div class="slide">
      <div class="flex justify-between items-center border-b border-slate-800 pb-3">
        <div class="text-sm font-semibold tracking-wider text-brand uppercase">Слайд 10. Чарджбэки — Chargeback Shield Protocol</div>
        <div class="text-lg font-bold text-white tracking-widest">SMMPLAN</div>
      </div>
      
      <div class="grid grid-cols-2 gap-6 my-auto items-stretch">
        <div class="p-6 rounded-xl bg-slate-900/50 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div class="text-md font-bold text-white mb-3 flex items-center gap-2">
              <span class="p-1 rounded bg-accent/15 text-accent text-sm">🔍</span>
              Чек-лист сбора улик (за 24 часа)
            </div>
            <ul class="text-xs text-slate-350 space-y-3 list-none pl-0">
              <li class="flex gap-2">
                <span class="text-brand font-bold">•</span>
                <span><strong>Поиск плательщика:</strong> По Payment ID/email находим пользователя в БД Smmplan.</span>
              </li>
              <li class="flex gap-2">
                <span class="text-brand font-bold">•</span>
                <span><strong>Сбор цифрового профиля:</strong> Выгружаем IP оплаты и IP последней авторизации.</span>
              </li>
              <li class="flex gap-2">
                <span class="text-brand font-bold">•</span>
                <span><strong>Логи выполнения:</strong> Фиксируем URL, Start Count, End Count, статус COMPLETED.</span>
              </li>
              <li class="flex gap-2">
                <span class="text-brand font-bold">•</span>
                <span><strong>API-логи провайдера:</strong> Точные таймстампы и ответы серверов с кодом 200 OK.</span>
              </li>
            </ul>
          </div>
          <div class="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs rounded-lg mt-2">
            ⚠️ Срок ответа комплаенсу шлюза составляет 3-5 рабочих дней. Задержка означает автоматический проигрыш.
          </div>
        </div>
        
        <div class="p-6 rounded-xl bg-slate-900/30 border border-slate-800/60 flex flex-col justify-between">
          <div>
            <div class="text-md font-bold text-white mb-2 flex items-center gap-2">
              <span class="p-1 rounded bg-brand/15 text-brand text-sm">✉️</span>
              Официальный шаблон ответа шлюзу (ЮKassa / Robokassa)
            </div>
            <div class="text-[10px] leading-relaxed font-mono whitespace-pre-line text-slate-400 bg-slate-950/50 p-4 rounded-lg border border-slate-800/60 max-h-[120mm] overflow-y-auto">
              Тема: Разъяснения по оспариваемому платежу № [Номер]
              Настоящим предоставляем мотивированные пояснения по транзакции № [Номер] (сумма [Сумма] руб.).
              Покупатель оплатил услугу информационно-технического характера по оптимизации показателей (заказ № [Номер]).
              Услуга считается оказанной в полном объеме в момент увеличения показателей. Просим отклонить требование чарджбэка.
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-between items-center border-t border-slate-800 pt-3 text-xs text-slate-500">
        <div>Протокол оспаривания транзакций</div>
        <div>Стр. 10 из 11</div>
      </div>
    </div>

    <!-- Slide 11: Escalation Diagram (Mermaid) -->
    <div class="slide">
      <div class="flex justify-between items-center border-b border-slate-800 pb-3">
        <div class="text-sm font-semibold tracking-wider text-brand uppercase">Слайд 11. Блок-схема эскалации инцидентов</div>
        <div class="text-lg font-bold text-white tracking-widest">SMMPLAN</div>
      </div>
      
      <div class="my-auto flex flex-col items-center justify-center">
        <div class="w-full max-w-4xl p-6 rounded-2xl bg-slate-900/30 border border-slate-800/60 flex flex-col items-center">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Блок-схема процессов</div>
          <pre class="mermaid text-center">
            graph TD
              A[Получена угроза/конфликт] --> B{Тип инцидента?}
              B -->|Обычный сбой| C[Решить через Refill / Возврат на баланс]
              B -->|Угроза полицией| D[Отработка по ст. 159 УК РФ]
              B -->|Угроза ФНС / РКН| E[Предоставление чеков 54-ФЗ / 152-ФЗ]
              B -->|Шантаж / DDoS| F[Запись IP и TG ID. Передача DevOps]
              B -->|Оскорбления / Мат| H[Предупреждение по ст. 119 УК / Закрытие тикета]
              B -->|Чарджбэк| J[Активация Chargeback Shield Protocol]
          </pre>
        </div>
        
        <div class="mt-4 grid grid-cols-2 gap-4 w-full max-w-4xl text-xs">
          <div class="p-3 bg-slate-900/40 rounded-xl border border-slate-800 flex justify-between items-center">
            <span class="text-slate-400">Служба технической поддержки:</span>
            <span class="font-mono text-brand font-semibold">devops@smmplan.pro</span>
          </div>
          <div class="p-3 bg-slate-900/40 rounded-xl border border-slate-800 flex justify-between items-center">
            <span class="text-slate-400">Юридический департамент (ИП Соколов):</span>
            <span class="font-mono text-emerald-500 font-semibold">legal-dep@smmplan.pro</span>
          </div>
        </div>
      </div>

      <div class="flex justify-between items-center border-t border-slate-800 pt-3 text-xs text-slate-500">
        <div>Контакты DevOps и Юридического отдела</div>
        <div>Стр. 11 из 11</div>
      </div>
    </div>
  </div>

  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      securityLevel: 'loose',
      themeVariables: {
        background: '#1e293b',
        primaryColor: '#6366f1',
        primaryTextColor: '#ffffff',
        lineColor: '#475569',
        nodeBorder: '#334155'
      }
    });
  </script>
</body>
</html>
`;

fs.writeFileSync(htmlPath, htmlContent, 'utf8');

async function main() {
  console.log('🚀 Starting Playwright PDF generation...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  const fileUrl = 'file:///' + htmlPath.replace(/\\\\/g, '/');
  console.log('Loading page:', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  
  console.log('Waiting for Mermaid and animations...');
  await page.waitForTimeout(4000);
  
  console.log('Printing to PDF...');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: {
      top: '0px',
      right: '0px',
      bottom: '0px',
      left: '0px'
    }
  });

  console.log('PDF successfully generated at:', pdfPath);
  await browser.close();
  
  fs.unlinkSync(htmlPath);
  console.log('Cleaned up temp HTML file.');
}

main().catch(err => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});
