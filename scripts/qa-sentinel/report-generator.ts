/**
 * scripts/qa-sentinel/report-generator.ts
 *
 * Генератор интерактивного автономного HTML-отчета и консольного резюме для Omni-Sentinel QA.
 */

import fs from 'fs';
import path from 'path';
import { QASentinelSummary, ScreenCheckResult } from './types';

/**
 * Печать красивого резюме в терминал
 */
export function printTerminalSummary(summary: QASentinelSummary): void {
  const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
  };

  console.log(`\n${c.bold}${c.cyan}======================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}       🛡️  OMNI-SENTINEL QA: СВОДНЫЙ АУДИТ КАЧЕСТВА ПЛАТФОРМЫ        ${c.reset}`);
  console.log(`${c.bold}${c.cyan}======================================================================${c.reset}\n`);

  console.log(`${c.bold}🎯 Целевой хост:${c.reset} ${summary.targetUrl}`);
  console.log(`${c.bold}⏱️  Время аудита:${c.reset} ${(summary.totalDurationMs / 1000).toFixed(1)} сек | ${summary.timestamp}`);
  console.log(`${c.bold}📊 Всего экранов:${c.reset} ${summary.totalScreens}`);

  const passBadge = `${c.green}${c.bold}PASS: ${summary.passedScreens}${c.reset}`;
  const warnBadge = `${c.yellow}${c.bold}WARN: ${summary.warnScreens}${c.reset}`;
  const failBadge = `${c.red}${c.bold}FAIL: ${summary.failedScreens}${c.reset}`;
  console.log(`\n${c.bold}Статус проверок:${c.reset} [ ${passBadge} | ${warnBadge} | ${failBadge} ]\n`);

  console.log(`${c.bold}Векторы инспекции:${c.reset}`);
  console.log(`  • Ошибки в консоли браузера: ${summary.totalConsoleErrors > 0 ? c.red : c.green}${summary.totalConsoleErrors}${c.reset}`);
  console.log(`  • Сетевые сбои (4xx / 5xx):  ${summary.totalFailedRequests > 0 ? c.yellow : c.green}${summary.totalFailedRequests}${c.reset}`);
  console.log(`  • Горизонтальный скролл DOM: ${summary.totalOverflowIssues > 0 ? c.red : c.green}${summary.totalOverflowIssues}${c.reset}`);

  console.log(`\n${c.bold}Детализация по экранам:${c.reset}`);
  summary.screens.forEach((s) => {
    let statusIcon = `${c.green}✅ PASS${c.reset}`;
    if (s.status === 'WARN') statusIcon = `${c.yellow}⚠️  WARN${c.reset}`;
    if (s.status === 'FAIL') statusIcon = `${c.red}❌ FAIL${c.reset}`;

    console.log(`  ${statusIcon} [${s.role}] ${c.bold}${s.name}${c.reset} (${s.viewport.name} - ${s.viewport.width}x${s.viewport.height})`);
    if (s.consoleErrors.length > 0) {
      console.log(`     ${c.red}↳ Console Errors (${s.consoleErrors.length}): ${s.consoleErrors[0].slice(0, 100)}...${c.reset}`);
    }
    if (s.domMetrics.hasHorizontalScroll) {
      console.log(`     ${c.red}↳ Horizontal Scroll: overflow +${s.domMetrics.overflowPixels}px (Селектор: ${s.domMetrics.overflowElements[0]?.selector || 'body'})${c.reset}`);
    }
    if (s.failedNetworkRequests.length > 0) {
      console.log(`     ${c.yellow}↳ Network Fails: ${s.failedNetworkRequests[0].status} ${s.failedNetworkRequests[0].url.slice(0, 70)}...${c.reset}`);
    }
  });

  console.log(`\n${c.bold}${c.cyan}----------------------------------------------------------------------${c.reset}`);
  if (summary.verdict === 'EXCELLENT') {
    console.log(`${c.bold}${c.green}🏆 ВЕРДИКТ: ПЛАТФОРМА ПОЛНОСТЬЮ СТАБИЛЬНА (EXCELLENT)${c.reset}`);
  } else if (summary.verdict === 'STABLE_WITH_WARNINGS') {
    console.log(`${c.bold}${c.yellow}⚠️  ВЕРДИКТ: СТАБИЛЬНО С ПРЕДУПРЕЖДЕНИЯМИ (STABLE WITH WARNINGS)${c.reset}`);
  } else {
    console.log(`${c.bold}${c.red}🚨 ВЕРДИКТ: ОБНАРУЖЕНЫ КРИТИЧЕСКИЕ ДЕФЕКТЫ (CRITICAL DEFECTS)${c.reset}`);
  }
  console.log(`${c.bold}${c.cyan}======================================================================${c.reset}\n`);
}

/**
 * Генерация интерактивного автономного HTML-отчета
 */
export function generateHtmlReport(summary: QASentinelSummary, outputDir: string): string {
  const reportPath = path.join(outputDir, 'index.html');

  const screensJson = JSON.stringify(summary.screens);

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Omni-Sentinel QA Report — ${summary.timestamp}</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --card-border: #1f293d;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --accent: #3b82f6;
      --green: #10b981;
      --yellow: #f59e0b;
      --red: #ef4444;
      --radius: 12px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 24px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 24px;
    }
    .logo-area h1 { font-size: 24px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .logo-area p { color: var(--text-muted); font-size: 14px; margin-top: 4px; }
    .verdict-badge {
      font-size: 14px;
      font-weight: 700;
      padding: 8px 16px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .verdict-EXCELLENT { background: rgba(16, 185, 129, 0.15); color: var(--green); border: 1px solid var(--green); }
    .verdict-STABLE_WITH_WARNINGS { background: rgba(245, 158, 11, 0.15); color: var(--yellow); border: 1px solid var(--yellow); }
    .verdict-CRITICAL_DEFECTS { background: rgba(239, 68, 68, 0.15); color: var(--red); border: 1px solid var(--red); }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      padding: 16px;
    }
    .stat-card .label { font-size: 12px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; }
    .stat-card .value { font-size: 28px; font-weight: 700; margin-top: 4px; }
    .stat-card.pass .value { color: var(--green); }
    .stat-card.warn .value { color: var(--yellow); }
    .stat-card.fail .value { color: var(--red); }

    .controls-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 24px;
      background: var(--card-bg);
      padding: 12px 16px;
      border-radius: var(--radius);
      border: 1px solid var(--card-border);
    }
    .filter-group { display: flex; gap: 6px; align-items: center; }
    .filter-label { font-size: 13px; color: var(--text-muted); margin-right: 4px; }
    .btn-filter {
      background: #1f2937;
      border: 1px solid #374151;
      color: var(--text);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-filter:hover { background: #374151; }
    .btn-filter.active { background: var(--accent); border-color: var(--accent); font-weight: 600; }

    .screens-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
      gap: 20px;
    }
    .screen-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.15s, border-color 0.15s;
    }
    .screen-card:hover { border-color: #3b82f6; }
    .screen-header {
      padding: 14px 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid var(--card-border);
    }
    .screen-title-area h3 { font-size: 15px; font-weight: 600; }
    .screen-meta { display: flex; gap: 8px; align-items: center; margin-top: 4px; font-size: 12px; color: var(--text-muted); }
    .role-badge {
      background: #1e293b;
      color: #94a3b8;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-status {
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
    }
    .badge-PASS { background: rgba(16, 185, 129, 0.2); color: var(--green); }
    .badge-WARN { background: rgba(245, 158, 11, 0.2); color: var(--yellow); }
    .badge-FAIL { background: rgba(239, 68, 68, 0.2); color: var(--red); }

    .screenshot-wrapper {
      position: relative;
      background: #000;
      height: 240px;
      overflow: hidden;
      cursor: pointer;
    }
    .screenshot-wrapper img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top;
      transition: opacity 0.2s;
    }
    .screenshot-wrapper:hover img { opacity: 0.9; }
    .zoom-hint {
      position: absolute;
      bottom: 8px;
      right: 8px;
      background: rgba(0,0,0,0.7);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      color: #fff;
    }

    .screen-details {
      padding: 14px 16px;
      font-size: 13px;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #0d131f;
    }
    .issue-box {
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 12px;
    }
    .issue-box.error { background: rgba(239, 68, 68, 0.1); border-left: 3px solid var(--red); }
    .issue-box.warn { background: rgba(245, 158, 11, 0.1); border-left: 3px solid var(--yellow); }
    .issue-box.success { background: rgba(16, 185, 129, 0.1); border-left: 3px solid var(--green); color: var(--green); }

    .code-snippet {
      font-family: monospace;
      background: #1f2937;
      padding: 4px 6px;
      border-radius: 4px;
      word-break: break-all;
      margin-top: 4px;
      display: inline-block;
    }

    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.85);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 20px;
    }
    .modal-backdrop.open { display: flex; }
    .modal-content {
      max-width: 95vw;
      max-height: 95vh;
      background: var(--card-bg);
      border-radius: var(--radius);
      overflow: auto;
      position: relative;
      border: 1px solid var(--card-border);
    }
    .modal-content img { width: 100%; height: auto; display: block; }
    .btn-close-modal {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(0,0,0,0.7);
      border: 1px solid #4b5563;
      color: #fff;
      font-size: 18px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo-area">
        <h1>🛡️ Omni-Sentinel QA Studio</h1>
        <p>Платформа: OmniSMM 1.0 | Хост: <strong>${summary.targetUrl}</strong> | Время: ${summary.timestamp}</p>
      </div>
      <div>
        <span class="verdict-badge verdict-${summary.verdict}">${summary.verdict.replace(/_/g, ' ')}</span>
      </div>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">Всего экранов</div>
        <div class="value">${summary.totalScreens}</div>
      </div>
      <div class="stat-card pass">
        <div class="label">Успешно (PASS)</div>
        <div class="value">${summary.passedScreens}</div>
      </div>
      <div class="stat-card warn">
        <div class="label">Предупреждения (WARN)</div>
        <div class="value">${summary.warnScreens}</div>
      </div>
      <div class="stat-card fail">
        <div class="label">Ошибки (FAIL)</div>
        <div class="value">${summary.failedScreens}</div>
      </div>
      <div class="stat-card ${summary.totalConsoleErrors > 0 ? 'fail' : 'pass'}">
        <div class="label">Console Errors</div>
        <div class="value">${summary.totalConsoleErrors}</div>
      </div>
      <div class="stat-card ${summary.totalOverflowIssues > 0 ? 'fail' : 'pass'}">
        <div class="label">Overflow DOM</div>
        <div class="value">${summary.totalOverflowIssues}</div>
      </div>
    </div>

    <div class="controls-bar">
      <div class="filter-group">
        <span class="filter-label">Статус:</span>
        <button class="btn-filter active" onclick="filterCards('status', 'ALL', this)">Все</button>
        <button class="btn-filter" onclick="filterCards('status', 'FAIL', this)">Только FAIL</button>
        <button class="btn-filter" onclick="filterCards('status', 'WARN', this)">Только WARN</button>
        <button class="btn-filter" onclick="filterCards('status', 'PASS', this)">Только PASS</button>
      </div>
      <div class="filter-group" style="margin-left: auto;">
        <span class="filter-label">Устройство:</span>
        <button class="btn-filter active" onclick="filterCards('device', 'ALL', this)">Все</button>
        <button class="btn-filter" onclick="filterCards('device', 'Desktop', this)">Desktop</button>
        <button class="btn-filter" onclick="filterCards('device', 'Mobile', this)">Mobile</button>
      </div>
    </div>

    <div class="screens-grid" id="screensContainer">
      ${summary.screens
        .map(
          (s) => `
        <div class="screen-card" data-status="${s.status}" data-device="${s.viewport.name.includes('Mobile') ? 'Mobile' : 'Desktop'}" data-role="${s.role}">
          <div class="screen-header">
            <div class="screen-title-area">
              <h3>${s.name}</h3>
              <div class="screen-meta">
                <span class="role-badge">${s.role}</span>
                <span>${s.path}</span>
                <span>(${s.viewport.width}x${s.viewport.height})</span>
              </div>
            </div>
            <span class="badge-status badge-${s.status}">${s.status}</span>
          </div>
          
          <div class="screenshot-wrapper" onclick="openModal('${s.screenshotPath}')">
            <img src="${s.screenshotPath}" alt="${s.name}" loading="lazy">
            <div class="zoom-hint">🔍 Увеличить</div>
          </div>

          <div class="screen-details">
            ${
              s.consoleErrors.length > 0
                ? `
              <div class="issue-box error">
                <strong>🚨 Ошибки консоли (${s.consoleErrors.length}):</strong>
                ${s.consoleErrors.map((err) => `<div class="code-snippet">${escapeHtml(err)}</div>`).join('')}
              </div>
            `
                : ''
            }

            ${
              s.domMetrics.hasHorizontalScroll
                ? `
              <div class="issue-box error">
                <strong>↔️ Горизонтальный скролл: +${s.domMetrics.overflowPixels}px</strong>
                ${
                  s.domMetrics.overflowElements.length > 0
                    ? `<div style="margin-top:4px;">Элемент-виновник: <div class="code-snippet">${escapeHtml(s.domMetrics.overflowElements[0].selector)} (+${s.domMetrics.overflowElements[0].overflowAmount}px)</div></div>`
                    : ''
                }
              </div>
            `
                : ''
            }

            ${
              s.failedNetworkRequests.length > 0
                ? `
              <div class="issue-box warn">
                <strong>⚠️ Сбои сети (${s.failedNetworkRequests.length}):</strong>
                ${s.failedNetworkRequests.map((r) => `<div class="code-snippet">${r.status} ${escapeHtml(r.url)}</div>`).join('')}
              </div>
            `
                : ''
            }

            ${
              s.domMetrics.smallTouchTargetsCount > 5
                ? `
              <div class="issue-box warn">
                <strong>⚠️ Touch targets &lt; 40px (${s.domMetrics.smallTouchTargetsCount}):</strong>
                Элементы интерфейса с зоной нажатия меньше стандарта W3C WCAG 2.2.
              </div>
            `
                : ''
            }

            ${
              s.consoleErrors.length === 0 && !s.domMetrics.hasHorizontalScroll && s.failedNetworkRequests.length === 0 && s.domMetrics.smallTouchTargetsCount <= 5
                ? `
              <div class="issue-box success">
                ✓ Консоль чиста, геометрия в норме, сетевых сбоев нет.
              </div>
            `
                : ''
            }
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  </div>

  <div class="modal-backdrop" id="imageModal" onclick="closeModal()">
    <div class="modal-content" onclick="event.stopPropagation()">
      <button class="btn-close-modal" onclick="closeModal()">&times;</button>
      <img id="modalImg" src="" alt="Full screenshot">
    </div>
  </div>

  <script>
    let activeFilters = { status: 'ALL', device: 'ALL' };

    function filterCards(type, val, btn) {
      activeFilters[type] = val;
      const group = btn.parentElement;
      group.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const cards = document.querySelectorAll('.screen-card');
      cards.forEach(card => {
        const matchStatus = activeFilters.status === 'ALL' || card.dataset.status === activeFilters.status;
        const matchDevice = activeFilters.device === 'ALL' || card.dataset.device === activeFilters.device;
        if (matchStatus && matchDevice) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    }

    function openModal(src) {
      document.getElementById('modalImg').src = src;
      document.getElementById('imageModal').classList.add('open');
    }

    function closeModal() {
      document.getElementById('imageModal').classList.remove('open');
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  </script>
</body>
</html>`;

  fs.writeFileSync(reportPath, html, 'utf-8');
  return reportPath;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
