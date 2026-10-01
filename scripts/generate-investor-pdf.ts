import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const htmlContent = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Медиаплан Яндекс.Директ — SMMplan</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1a202c;
      margin: 0;
      padding: 0;
      font-size: 10px;
      line-height: 1.35;
    }
    .header {
      border-bottom: 2px solid #2b6cb0;
      padding-bottom: 8px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header-title h1 {
      font-size: 16px;
      margin: 0 0 3px 0;
      color: #2b6cb0;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header-title p {
      margin: 0;
      font-size: 10.5px;
      color: #4a5568;
    }
    .header-meta {
      text-align: right;
      font-size: 9.5px;
      color: #718096;
    }
    h2 {
      font-size: 11px;
      margin: 10px 0 5px 0;
      color: #2d3748;
      border-left: 3px solid #2b6cb0;
      padding-left: 6px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      font-size: 9.2px;
    }
    th {
      background-color: #f7fafc;
      color: #4a5568;
      font-weight: 600;
      text-align: left;
      padding: 4px 6px;
      border: 1px solid #e2e8f0;
      font-size: 8.8px;
      text-transform: uppercase;
    }
    td {
      padding: 3.5px 6px;
      border: 1px solid #e2e8f0;
      color: #2d3748;
    }
    tr:nth-child(even) td {
      background-color: #fbfcfe;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .bold {
      font-weight: 600;
    }
    .highlight-row td {
      background-color: #edf2f7 !important;
      font-weight: 600;
    }
    .negative-box {
      background: #fff5f5;
      border: 1px solid #feb2b2;
      border-radius: 4px;
      padding: 6px 8px;
      font-size: 8.8px;
      color: #9b2c2c;
      margin-bottom: 8px;
      line-height: 1.35;
    }
    .info-box {
      background: #ebf8ff;
      border: 1px solid #bee3f8;
      border-radius: 4px;
      padding: 5px 8px;
      font-size: 8.8px;
      color: #2b6cb0;
      margin-bottom: 8px;
    }
    .footer {
      margin-top: 10px;
      border-top: 1px solid #e2e8f0;
      padding-top: 5px;
      display: flex;
      justify-content: space-between;
      color: #a0aec0;
      font-size: 8.5px;
    }
    .page-break {
      page-break-before: always;
    }
  </style>
</head>
<body>

  <!-- ==================== СТРАНИЦА 1 ==================== -->
  <div class="header">
    <div class="header-title">
      <h1>Медиаплан контекстной рекламы Яндекс.Директ</h1>
      <p>Проект: <strong>SMMplan (smmplan.pro)</strong> — Автоматизированная SMM-панель и B2B провайдер API</p>
    </div>
    <div class="header-meta">
      <div>Регион: <strong>РФ и СНГ (GeoID 225)</strong></div>
      <div>Период: <strong>2026–2027 гг.</strong> | Валюта: <strong>RUB (₽)</strong></div>
      <div>Страница: <strong>1 из 3</strong></div>
    </div>
  </div>

  <h2>1. Финансовые сценарии рекламного бюджета (на 30 дней)</h2>
  <table>
    <thead>
      <tr>
        <th>Сценарий масштабирования</th>
        <th class="num">Бюджет нетто</th>
        <th class="num">НДС 20%</th>
        <th class="num">Итого инвестиций</th>
        <th class="num">Клики</th>
        <th class="num">Средний CPC</th>
        <th class="num">Регистрации</th>
        <th class="num">Новых клиентов</th>
        <th class="num">CAC</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="bold">1. Стартовый (Тестирование и калибровка)</td>
        <td class="num">150 000 ₽</td>
        <td class="num">30 000 ₽</td>
        <td class="num bold">180 000 ₽</td>
        <td class="num">4 450</td>
        <td class="num">33,71 ₽</td>
        <td class="num">712</td>
        <td class="num bold">185</td>
        <td class="num">810 ₽</td>
      </tr>
      <tr class="highlight-row">
        <td class="bold">2. Оптимальный (Рабочий инвестиционный раунд)</td>
        <td class="num bold">450 000 ₽</td>
        <td class="num">90 000 ₽</td>
        <td class="num bold">540 000 ₽</td>
        <td class="num bold">15 300</td>
        <td class="num">29,41 ₽</td>
        <td class="num">2 600</td>
        <td class="num bold">793</td>
        <td class="num bold">567 ₽</td>
      </tr>
      <tr>
        <td class="bold">3. Масштабирование (Захват доли рынка)</td>
        <td class="num">1 200 000 ₽</td>
        <td class="num">240 000 ₽</td>
        <td class="num bold">1 440 000 ₽</td>
        <td class="num">46 500</td>
        <td class="num">25,80 ₽</td>
        <td class="num">8 370</td>
        <td class="num bold">2 611</td>
        <td class="num">459 ₽</td>
      </tr>
    </tbody>
  </table>

  <h2>2. Распределение бюджета по каналам Яндекс.Директ</h2>
  <table>
    <thead>
      <tr>
        <th>Канал размещения</th>
        <th class="num">Доля бюджета</th>
        <th>Целевое назначение</th>
        <th class="num">Прогнозный CPC</th>
        <th class="num">Ориентир CPA (Регистрация)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="bold">Поиск Яндекса (Search)</td>
        <td class="num bold">45%</td>
        <td>Горячий коммерческий спрос B2B, стриминг, Telegram, бренды конкурентов</td>
        <td class="num">32,00 – 72,00 ₽</td>
        <td class="num">190 – 290 ₽</td>
      </tr>
      <tr>
        <td class="bold">Рекламная сеть Яндекса (РСЯ)</td>
        <td class="num bold">35%</td>
        <td>Охват стримеров, блогеров, авторов каналов, ретаргетинг посетителей</td>
        <td class="num">11,50 – 22,00 ₽</td>
        <td class="num">120 – 190 ₽</td>
      </tr>
      <tr>
        <td class="bold">Единая перформанс-кампания (ЕПК)</td>
        <td class="num bold">20%</td>
        <td>Смарт-баннеры и автостратегии с оптимизацией на оплату первого заказа</td>
        <td class="num">18,00 – 30,00 ₽</td>
        <td class="num">160 – 230 ₽</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Юнит-экономика и когортная окупаемость (LTV & Payback)</h2>
  <table>
    <thead>
      <tr>
        <th>Показатель</th>
        <th class="num">Месяц 1</th>
        <th class="num">Месяц 2</th>
        <th class="num">Месяц 3</th>
        <th class="num">Месяц 6</th>
        <th class="num">Месяц 12</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Накопленный LTV на клиента</td>
        <td class="num">520 ₽</td>
        <td class="num">890 ₽</td>
        <td class="num bold">1 240 ₽</td>
        <td class="num">2 150 ₽</td>
        <td class="num bold">3 800 ₽</td>
      </tr>
      <tr>
        <td>Стоимость привлечения (CAC)</td>
        <td class="num">567 ₽</td>
        <td class="num">567 ₽</td>
        <td class="num">567 ₽</td>
        <td class="num">567 ₽</td>
        <td class="num">567 ₽</td>
      </tr>
      <tr class="highlight-row">
        <td>Окупаемость когорты (ROAS)</td>
        <td class="num">91,7%</td>
        <td class="num">156,9%</td>
        <td class="num bold">218,6% (Break-Even)</td>
        <td class="num">379,1%</td>
        <td class="num bold">670,1%</td>
      </tr>
    </tbody>
  </table>

  <h2>4. Семантическая матрица: B2B и API-реселлеры (Высокий LTV)</h2>
  <table>
    <thead>
      <tr>
        <th>Ключевой запрос</th>
        <th class="num">Спрос (Wordstat/мес)</th>
        <th class="num">Мин. ставка</th>
        <th class="num">Средний CPC</th>
        <th class="num">Макс. ставка</th>
        <th class="num">Прогноз бюджета/мес</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>smm панель</td>
        <td class="num">18 400</td>
        <td class="num">28,50 ₽</td>
        <td class="num bold">44,20 ₽</td>
        <td class="num">68,00 ₽</td>
        <td class="num">24 500 ₽</td>
      </tr>
      <tr>
        <td>smm panel</td>
        <td class="num">12 100</td>
        <td class="num">24,00 ₽</td>
        <td class="num bold">38,50 ₽</td>
        <td class="num">56,00 ₽</td>
        <td class="num">18 200 ₽</td>
      </tr>
      <tr>
        <td>smm api</td>
        <td class="num">4 200</td>
        <td class="num">21,00 ₽</td>
        <td class="num bold">32,00 ₽</td>
        <td class="num">48,00 ₽</td>
        <td class="num">12 000 ₽</td>
      </tr>
      <tr>
        <td>smm провайдер</td>
        <td class="num">3 800</td>
        <td class="num">26,00 ₽</td>
        <td class="num bold">41,00 ₽</td>
        <td class="num">62,00 ₽</td>
        <td class="num">14 500 ₽</td>
      </tr>
      <tr class="highlight-row">
        <td>ИТОГО ПО B2B СЕМАНТИКЕ:</td>
        <td class="num bold">38 500</td>
        <td class="num">24,88 ₽</td>
        <td class="num bold">38,93 ₽</td>
        <td class="num">58,50 ₽</td>
        <td class="num bold">69 200 ₽</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <div>Медиаплан подготовлен для инвесторов проекта SMMplan</div>
    <div>Конфиденциально | smmplan.pro</div>
    <div>Дата формирования: Октябрь 2026</div>
  </div>

  <div class="page-break"></div>

  <!-- ==================== СТРАНИЦА 2 ==================== -->
  <div class="header">
    <div class="header-title">
      <h1>Медиаплан Яндекс.Директ — Высокомаржинальные направления</h1>
      <p>Проект: <strong>SMMplan</strong> | Кластеры: Стриминг (Twitch/Kick), Мессенджер MAX, ВК и Видео</p>
    </div>
    <div class="header-meta">
      <div>Регион: <strong>РФ и СНГ (GeoID 225)</strong></div>
      <div>Период: <strong>2026–2027 гг.</strong> | Валюта: <strong>RUB (₽)</strong></div>
      <div>Страница: <strong>2 из 3</strong></div>
    </div>
  </div>

  <h2>5. Высокомаржинальный Стриминг: Twitch, Kick, Trovo, YouTube Live (Маржа 55–75%)</h2>
  <div class="info-box">
    <strong>Экономическая специфика направления:</strong> Высокая частота повторных заказов от стримеров (LTV выше среднего на 40%). За счет серверного пулинга и прямого протокола себестоимость онлайна минимальна, что обеспечивает устойчивую маржинальность 55–75%.
  </div>
  <table>
    <thead>
      <tr>
        <th>Ключевой запрос</th>
        <th class="num">Спрос (Wordstat/мес)</th>
        <th class="num">Мин. ставка</th>
        <th class="num">Средний CPC</th>
        <th class="num">Макс. ставка</th>
        <th class="num">Прогноз бюджета/мес</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>зрители на стрим твич</td>
        <td class="num">2 450</td>
        <td class="num">22,00 ₽</td>
        <td class="num bold">34,00 ₽</td>
        <td class="num">52,00 ₽</td>
        <td class="num">12 500 ₽</td>
      </tr>
      <tr>
        <td>купить зрителей на твич</td>
        <td class="num">1 890</td>
        <td class="num">26,00 ₽</td>
        <td class="num bold">39,50 ₽</td>
        <td class="num">58,00 ₽</td>
        <td class="num">9 800 ₽</td>
      </tr>
      <tr>
        <td>накрутка онлайна твич с удержанием</td>
        <td class="num">1 120</td>
        <td class="num">24,00 ₽</td>
        <td class="num bold">36,00 ₽</td>
        <td class="num">54,00 ₽</td>
        <td class="num">6 500 ₽</td>
      </tr>
      <tr>
        <td>чат боты для твича купить</td>
        <td class="num">840</td>
        <td class="num">18,50 ₽</td>
        <td class="num bold">28,00 ₽</td>
        <td class="num">42,00 ₽</td>
        <td class="num">4 200 ₽</td>
      </tr>
      <tr>
        <td>накрутка зрителей кик (kick)</td>
        <td class="num">960</td>
        <td class="num">16,00 ₽</td>
        <td class="num bold">24,50 ₽</td>
        <td class="num">38,00 ₽</td>
        <td class="num">4 500 ₽</td>
      </tr>
      <tr>
        <td>зрители на стрим ютуб онлайн</td>
        <td class="num">2 150</td>
        <td class="num">25,00 ₽</td>
        <td class="num bold">38,00 ₽</td>
        <td class="num">56,00 ₽</td>
        <td class="num">11 000 ₽</td>
      </tr>
      <tr>
        <td>продвижение стрима трово (trovo)</td>
        <td class="num">480</td>
        <td class="num">12,50 ₽</td>
        <td class="num bold">18,50 ₽</td>
        <td class="num">28,00 ₽</td>
        <td class="num">2 800 ₽</td>
      </tr>
      <tr class="highlight-row">
        <td>ИТОГО ПО СТРИМИНГУ:</td>
        <td class="num bold">9 890</td>
        <td class="num">20,57 ₽</td>
        <td class="num bold">31,21 ₽</td>
        <td class="num">46,86 ₽</td>
        <td class="num bold">51 300 ₽</td>
      </tr>
    </tbody>
  </table>

  <h2>6. Мессенджер MAX: Низкоконкурентный старт и DePIN-исполнение (Маржа 80%+)</h2>
  <div class="info-box">
    <strong>Преимущество платформы:</strong> Мессенджер MAX поддерживается в архитектуре чекаута SMMplan (валидаторы каналов и профилей max.ru). Исполнение заказов обеспечивается собственной распределенной сетью DePIN-узлов. Конкуренция в Директе минимальна, CAC — от 380 ₽.
  </div>
  <table>
    <thead>
      <tr>
        <th>Ключевой запрос</th>
        <th class="num">Спрос (Wordstat/мес)</th>
        <th class="num">Мин. ставка</th>
        <th class="num">Средний CPC</th>
        <th class="num">Макс. ставка</th>
        <th class="num">Прогноз бюджета/мес</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>продвижение канала в max</td>
        <td class="num">74</td>
        <td class="num">15,00 ₽</td>
        <td class="num bold">24,00 ₽</td>
        <td class="num">36,00 ₽</td>
        <td class="num">750 ₽</td>
      </tr>
      <tr>
        <td>накрутка подписчиков в max</td>
        <td class="num">55</td>
        <td class="num">16,50 ₽</td>
        <td class="num bold">26,50 ₽</td>
        <td class="num">38,00 ₽</td>
        <td class="num">700 ₽</td>
      </tr>
      <tr>
        <td>купить подписчиков в max</td>
        <td class="num">32</td>
        <td class="num">18,00 ₽</td>
        <td class="num bold">29,00 ₽</td>
        <td class="num">42,00 ₽</td>
        <td class="num">550 ₽</td>
      </tr>
      <tr>
        <td>накрутка просмотров max</td>
        <td class="num">43</td>
        <td class="num">11,00 ₽</td>
        <td class="num bold">16,00 ₽</td>
        <td class="num">24,00 ₽</td>
        <td class="num">300 ₽</td>
      </tr>
      <tr>
        <td>продвижение в max (РСЯ охват авторов)</td>
        <td class="num">185</td>
        <td class="num">8,50 ₽</td>
        <td class="num bold">12,00 ₽</td>
        <td class="num">18,00 ₽</td>
        <td class="num">8 500 ₽</td>
      </tr>
      <tr>
        <td>каналы в мессенджере max (РСЯ ретаргетинг)</td>
        <td class="num">949</td>
        <td class="num">7,00 ₽</td>
        <td class="num bold">10,50 ₽</td>
        <td class="num">15,00 ₽</td>
        <td class="num">5 150 ₽</td>
      </tr>
      <tr class="highlight-row">
        <td>ИТОГО ПО МЕССЕНДЖЕРУ MAX:</td>
        <td class="num bold">1 338</td>
        <td class="num">12,67 ₽</td>
        <td class="num bold">19,67 ₽</td>
        <td class="num">28,83 ₽</td>
        <td class="num bold">15 950 ₽</td>
      </tr>
    </tbody>
  </table>

  <h2>7. ВКонтакте и отечественные видеоплатформы (RuTube, YouTube, Дзен)</h2>
  <table>
    <thead>
      <tr>
        <th>Ключевой запрос</th>
        <th class="num">Спрос (Wordstat/мес)</th>
        <th class="num">Мин. ставка</th>
        <th class="num">Средний CPC</th>
        <th class="num">Макс. ставка</th>
        <th class="num">Прогноз бюджета/мес</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>продвижение группы вк</td>
        <td class="num">34 000</td>
        <td class="num">42,00 ₽</td>
        <td class="num bold">69,00 ₽</td>
        <td class="num">115,00 ₽</td>
        <td class="num">28 000 ₽</td>
      </tr>
      <tr>
        <td>купить подписчиков вк</td>
        <td class="num">8 600</td>
        <td class="num">36,00 ₽</td>
        <td class="num bold">58,00 ₽</td>
        <td class="num">92,00 ₽</td>
        <td class="num">12 000 ₽</td>
      </tr>
      <tr>
        <td>продвижение рутуб канала</td>
        <td class="num">8 900</td>
        <td class="num">17,50 ₽</td>
        <td class="num bold">28,00 ₽</td>
        <td class="num">46,00 ₽</td>
        <td class="num">8 500 ₽</td>
      </tr>
      <tr>
        <td>просмотры рутуб купить</td>
        <td class="num">3 200</td>
        <td class="num">20,00 ₽</td>
        <td class="num bold">32,50 ₽</td>
        <td class="num">52,00 ₽</td>
        <td class="num">6 800 ₽</td>
      </tr>
      <tr>
        <td>часы просмотров ютуб купить</td>
        <td class="num">2 800</td>
        <td class="num">35,00 ₽</td>
        <td class="num bold">55,00 ₽</td>
        <td class="num">88,00 ₽</td>
        <td class="num">7 900 ₽</td>
      </tr>
      <tr>
        <td>дочитывания дзен купить</td>
        <td class="num">1 850</td>
        <td class="num">18,00 ₽</td>
        <td class="num bold">29,50 ₽</td>
        <td class="num">48,00 ₽</td>
        <td class="num">4 600 ₽</td>
      </tr>
      <tr class="highlight-row">
        <td>ИТОГО ПО ВК И ВИДЕО:</td>
        <td class="num bold">59 350</td>
        <td class="num">28,08 ₽</td>
        <td class="num bold">45,33 ₽</td>
        <td class="num">73,50 ₽</td>
        <td class="num bold">67 800 ₽</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <div>Медиаплан подготовлен для инвесторов проекта SMMplan</div>
    <div>Конфиденциально | smmplan.pro</div>
    <div>Дата формирования: Октябрь 2026</div>
  </div>

  <div class="page-break"></div>

  <!-- ==================== СТРАНИЦА 3 ==================== -->
  <div class="header">
    <div class="header-title">
      <h1>Медиаплан Яндекс.Директ — Масштабирование и Защита инвестиций</h1>
      <p>Проект: <strong>SMMplan</strong> | Кластеры: Telegram, Перехват конкурентов, Минус-слова, KPI</p>
    </div>
    <div class="header-meta">
      <div>Регион: <strong>РФ и СНГ (GeoID 225)</strong></div>
      <div>Период: <strong>2026–2027 гг.</strong> | Валюта: <strong>RUB (₽)</strong></div>
      <div>Страница: <strong>3 из 3</strong></div>
    </div>
  </div>

  <h2>8. Telegram-экосистема (Массовый масштаб и высокая оборачиваемость)</h2>
  <table>
    <thead>
      <tr>
        <th>Ключевой запрос</th>
        <th class="num">Спрос (Wordstat/мес)</th>
        <th class="num">Мин. ставка</th>
        <th class="num">Средний CPC</th>
        <th class="num">Макс. ставка</th>
        <th class="num">Прогноз бюджета/мес</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>продвижение телеграм канала</td>
        <td class="num">42 000</td>
        <td class="num">52,00 ₽</td>
        <td class="num bold">84,00 ₽</td>
        <td class="num">138,00 ₽</td>
        <td class="num">45 000 ₽</td>
      </tr>
      <tr>
        <td>раскрутка тг канала</td>
        <td class="num">18 500</td>
        <td class="num">44,00 ₽</td>
        <td class="num bold">68,50 ₽</td>
        <td class="num">112,00 ₽</td>
        <td class="num">26 000 ₽</td>
      </tr>
      <tr>
        <td>купить подписчиков телеграм</td>
        <td class="num">14 200</td>
        <td class="num">48,00 ₽</td>
        <td class="num bold">72,00 ₽</td>
        <td class="num">115,00 ₽</td>
        <td class="num">22 000 ₽</td>
      </tr>
      <tr>
        <td>бусты телеграм канала купить</td>
        <td class="num">4 600</td>
        <td class="num">36,00 ₽</td>
        <td class="num bold">58,00 ₽</td>
        <td class="num">94,00 ₽</td>
        <td class="num">12 500 ₽</td>
      </tr>
      <tr>
        <td>просмотры на посты тг</td>
        <td class="num">6 300</td>
        <td class="num">24,00 ₽</td>
        <td class="num bold">39,00 ₽</td>
        <td class="num">64,00 ₽</td>
        <td class="num">9 800 ₽</td>
      </tr>
      <tr>
        <td>автопросмотры телеграм на месяц</td>
        <td class="num">2 100</td>
        <td class="num">21,00 ₽</td>
        <td class="num bold">34,50 ₽</td>
        <td class="num">56,00 ₽</td>
        <td class="num">5 400 ₽</td>
      </tr>
      <tr>
        <td>купить реакции в телеграм</td>
        <td class="num">3 800</td>
        <td class="num">23,00 ₽</td>
        <td class="num bold">36,80 ₽</td>
        <td class="num">59,00 ₽</td>
        <td class="num">6 200 ₽</td>
      </tr>
      <tr class="highlight-row">
        <td>ИТОГО ПО TELEGRAM:</td>
        <td class="num bold">91 500</td>
        <td class="num">35,43 ₽</td>
        <td class="num bold">56,11 ₽</td>
        <td class="num">91,14 ₽</td>
        <td class="num bold">126 900 ₽</td>
      </tr>
    </tbody>
  </table>

  <h2>9. Перехват брендового спроса конкурентов (Горячие покупатели)</h2>
  <table>
    <thead>
      <tr>
        <th>Бренд конкурента</th>
        <th class="num">Спрос по бренду</th>
        <th class="num">Средний CPC на поиске</th>
        <th>Позиционирование оффера SMMplan</th>
        <th class="num">Прогноз бюджета/мес</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="bold">smmprime</td>
        <td class="num">14 500</td>
        <td class="num bold">48,00 ₽</td>
        <td>Оптовый API без наценок, цены ниже на 20%</td>
        <td class="num">18 000 ₽</td>
      </tr>
      <tr>
        <td class="bold">doctorsmm</td>
        <td class="num">22 000</td>
        <td class="num bold">54,00 ₽</td>
        <td>Моментальный запуск от 60 секунд, гарантия без списаний</td>
        <td class="num">24 000 ₽</td>
      </tr>
      <tr>
        <td class="bold">smmlaba</td>
        <td class="num">11 200</td>
        <td class="num bold">42,00 ₽</td>
        <td>Прямой провайдер, современный кабинет, поддержка 24/7</td>
        <td class="num">14 000 ₽</td>
      </tr>
      <tr>
        <td class="bold">lowcostsmm</td>
        <td class="num">8 900</td>
        <td class="num bold">46,00 ₽</td>
        <td>Скидки на объемы до 25%, кэшбэк на баланс</td>
        <td class="num">11 000 ₽</td>
      </tr>
      <tr>
        <td class="bold">soc-service</td>
        <td class="num">6 400</td>
        <td class="num bold">38,00 ₽</td>
        <td>Быстрый импорт заказов, работа по API v2</td>
        <td class="num">8 500 ₽</td>
      </tr>
      <tr class="highlight-row">
        <td>ИТОГО ПО КОНКУРЕНТАМ:</td>
        <td class="num bold">63 000</td>
        <td class="num bold">45,60 ₽</td>
        <td>Перехват сформированной клиентской базы</td>
        <td class="num bold">75 500 ₽</td>
      </tr>
    </tbody>
  </table>

  <h2>10. Единый реестр минус-слов (Исключение нецелевого расхода)</h2>
  <div class="negative-box">
    <strong>Общие нецелевые запросы:</strong> бесплатно, бесплатный, бесплатная, даром, халява, своими руками, самостоятельно, инструкция, гайд, мануал, скачать, торрент, взлом, взломать, чит, скрипт, исходник, github, crack, слив, обучение, курсы, учеба, реферат, диплом, вакансия, работа, зарплата, резюме, отзывы сотрудников, форум, вред, забанят, опасно, разоблачение, мошенники, программа, софт, apk, автокликер, ботнет, спам, вирус, троян, python.<br>
    <strong>Защита от омонимов MAX (Исключение огромного мусорного трафика):</strong> -nike -найк -airmax -кроссовки -shoes -factor -фактор -тушь -крем -косметика -mara -мара -пальто -платье -imax -аймакс -кинотеатр -фильм -сериал -верстаппен -корж -барских -100500 -3ds -3d -vray -corona -iphone -promax -макслайн -казино.
  </div>

  <h2>11. Гарантии окупаемости и этапы контроля KPI инвестора</h2>
  <table>
    <thead>
      <tr>
        <th>Этап контроля</th>
        <th>Сроки</th>
        <th>Контрольная точка KPI</th>
        <th>Действие при отклонении</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="bold">Этап 1: Калибровка ставок</td>
        <td>Дни 1–14</td>
        <td>CPA (Регистрация) &le; 220 ₽, отказы на сайте &lt; 18%</td>
        <td>Ужесточение минус-слов, снижение ставок в позициях 3–4</td>
      </tr>
      <tr>
        <td class="bold">Этап 2: Фиксация конверсии</td>
        <td>Дни 15–30</td>
        <td>CR в первый заказ &ge; 22%, средний чек &ge; 450 ₽</td>
        <td>Активация когортного ретаргетинга в РСЯ, email-триггеры</td>
      </tr>
      <tr>
        <td class="bold">Этап 3: Возврат инвестиций</td>
        <td>Месяцы 2–3</td>
        <td>Повторные платежи &ge; 45%, выход когорты в безубыточность</td>
        <td>Масштабирование бюджета до 1 200 000 ₽ / мес</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <div>Медиаплан подготовлен для инвесторов проекта SMMplan</div>
    <div>Конфиденциально | smmplan.pro</div>
    <div>Дата формирования: Октябрь 2026</div>
  </div>

</body>
</html>
`;

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();

  await page.setContent(htmlContent, { waitUntil: 'networkidle' });

  const rootPdfPath = path.resolve('SMMplan_Investor_Keywords_and_Bids.pdf');
  const artifactPdfPath = path.resolve('C:/Users/Артем/.gemini/antigravity/brain/6c8d7649-2d03-41d5-8cd7-87415c545398/SMMplan_Investor_Keywords_and_Bids.pdf');

  await page.pdf({
    path: rootPdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '10mm',
      bottom: '10mm',
      left: '12mm',
      right: '12mm'
    }
  });

  fs.copyFileSync(rootPdfPath, artifactPdfPath);
  await browser.close();

  console.log(`Updated 3-page investor PDF successfully generated!`);
}

main().catch(console.error);
