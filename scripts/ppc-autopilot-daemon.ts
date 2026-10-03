/**
 * scripts/ppc-autopilot-daemon.ts
 *
 * Автономный фоновый демон запуска OODA-цикла PPC Growth Agent (SDD-TDD 2026).
 * Запуск: npx tsx scripts/ppc-autopilot-daemon.ts [--dry-run] [--once]
 *
 * Спецификация: docs/specs/SPEC-2026-10-01-AUTONOMOUS-PPC-GROWTH-AGENT.md
 */

import https from 'https';
import { AutonomousPpcAgent } from '../src/services/ppc/autonomous-ppc-agent';
import { PpcOodaCycleResult } from '../src/services/ppc/types';

interface CliArgs {
  dryRun: boolean;
  once: boolean;
  verbose: boolean;
  simulate: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run') || args.includes('--simulate'),
    once: args.includes('--once') || true, // Default to single run unless scheduled
    verbose: args.includes('--verbose'),
    simulate: args.includes('--simulate'),
  };
}

async function sendTelegramNotification(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_SUPPORT_CHAT_ID;

  if (!token || !chatId) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    const payload = JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
    });

    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        signal: AbortSignal.timeout(10000),
      },
      (res) => {
        resolve(res.statusCode === 200);
      }
    );

    req.on('error', () => resolve(false));
    req.write(payload);
    req.end();
  });
}

function formatTelegramReport(result: PpcOodaCycleResult): string {
  const modeBadge = result.dryRun ? '🛡️ [DRY RUN]' : '🚀 [LIVE APPLIED]';
  const lines = [
    `<b>🤖 SMMplan PPC Autopilot — OODA Cycle Report</b>`,
    `<b>Режим:</b> ${modeBadge}`,
    `<b>Время:</b> <code>${result.timestamp}</code>`,
    ``,
    `📊 <b>Метрики анализа:</b>`,
    `• Кампаний в аудите: <b>${result.campaignsAnalyzed}</b>`,
    `• Фраз из Метрики: <b>${result.phrasesAnalyzed}</b>`,
    `• Коммерческих запросов: <b>${result.commercialPhrasesCount}</b>`,
    `• Добавлено минус-слов: <b>${result.newMinusWordsIdentified.length}</b>`,
    `• Фрод-алертов: <b>${result.clickFraudAlerts.length}</b>`,
    ``,
    `📝 <b>Резюме:</b>`,
    `${result.summary}`,
  ];

  if (result.newMinusWordsIdentified.length > 0) {
    lines.push(``, `🚫 <b>Топ новых минус-слов:</b>`);
    lines.push(
      result.newMinusWordsIdentified
        .slice(0, 10)
        .map((w) => `• <code>${w}</code>`)
        .join('\n')
    );
  }

  if (result.clickFraudAlerts.length > 0) {
    lines.push(``, `⚠️ <b>Фрод-сигналы (Click-Fraud):</b>`);
    lines.push(
      result.clickFraudAlerts
        .slice(0, 5)
        .map((a) => `• [${a.severity}] ${a.phrase || 'Cluster'}: ${a.recommendedAction}`)
        .join('\n')
    );
  }

  return lines.join('\n');
}

async function main() {
  const args = parseArgs();

  console.log('====================================================');
  console.log('🤖 OmniSMM Autonomous PPC Growth Agent (Direct v5)');
  console.log(`   Standard: SDD-TDD 2026 | Mode: ${args.simulate ? 'SIMULATION' : args.dryRun ? 'DRY-RUN' : 'LIVE'}`);
  console.log('====================================================');

  let agent: AutonomousPpcAgent;

  if (args.simulate) {
    console.log('ℹ️  Simulation Mode Active: Initializing mock Direct & Metrika telemetry...');
    const { YandexDirectClient } = await import('../src/services/ppc/yandex-direct-client');
    const { YandexMetrikaClient } = await import('../src/services/ppc/yandex-metrika-client');
    const { CroRetentionWebhook } = await import('../src/services/ppc/cro-retention-webhook');

    const mockDirect = new YandexDirectClient({ token: 'simulated-token-smmplan-direct' });
    mockDirect.isAuthorized = () => true;
    mockDirect.getCampaigns = async () => [
      { Id: 101, Name: 'SMMplan Telegram Core Search', State: 'ON', Status: 'ACCEPTED' },
      { Id: 102, Name: 'SMMplan VK Communities Search', State: 'ON', Status: 'ACCEPTED' },
      { Id: 103, Name: 'SMMplan Competitors Intercept Search', State: 'ON', Status: 'ACCEPTED' },
      { Id: 104, Name: 'SMMplan MAX Messenger Search', State: 'ON', Status: 'ACCEPTED' },
    ];
    mockDirect.appendMinusKeywords = async (_id, words) => {
      if (args.verbose) {
        console.log(`  [SIMULATION-DIRECT] Campaign ${_id} <- Appended ${words.length} minus words`);
      }
      return true;
    };

    const mockMetrika = new YandexMetrikaClient({ token: 'simulated-token-smmplan-metrika' });
    mockMetrika.isAuthorized = () => true;
    mockMetrika.getSearchPhrasesWithBounceRate = async () => [
      { phrase: 'купить подписчиков телеграм дешево', visits: 38, bounceRate: 17.5, pageviews: 114, avgDurationSeconds: 125, isHighBounce: false },
      { phrase: 'продвижение сообщества вк панель', visits: 26, bounceRate: 19.0, pageviews: 78, avgDurationSeconds: 110, isHighBounce: false },
      { phrase: 'smm панель оптом api шлюз', visits: 18, bounceRate: 11.0, pageviews: 65, avgDurationSeconds: 210, isHighBounce: false },
      { phrase: 'продвижение в мессенджере max', visits: 7, bounceRate: 14.0, pageviews: 22, avgDurationSeconds: 150, isHighBounce: false },
      { phrase: 'скачать бесплатно взлом подписчиков apk', visits: 14, bounceRate: 93.0, pageviews: 14, avgDurationSeconds: 2, isHighBounce: true },
      { phrase: 'смотреть фильм безумный макс бесплатно', visits: 11, bounceRate: 100.0, pageviews: 11, avgDurationSeconds: 1, isHighBounce: true },
      { phrase: 'кроссовки nike airmax скидка купить', visits: 6, bounceRate: 100.0, pageviews: 6, avgDurationSeconds: 2, isHighBounce: true },
      { phrase: 'работа кликать лайки заработок без вложений', visits: 15, bounceRate: 87.0, pageviews: 16, avgDurationSeconds: 3, isHighBounce: true },
      { phrase: 'ботнет спам рассылка софт скачать', visits: 12, bounceRate: 92.0, pageviews: 12, avgDurationSeconds: 2, isHighBounce: true },
      { phrase: 'клик ферма боты накрутка crack', visits: 22, bounceRate: 98.0, pageviews: 22, avgDurationSeconds: 1, isHighBounce: true },
      { phrase: 'слив приватных баз каналов', visits: 8, bounceRate: 88.0, pageviews: 9, avgDurationSeconds: 3, isHighBounce: true },
    ];

    const mockCro = new CroRetentionWebhook();
    mockCro.findZeroBalanceRegistrations = async () => [
      { id: 'usr_lead_01', email: 'director@digitalagency.ru', createdAt: new Date(Date.now() - 35 * 60000), telegramId: '5421980' },
      { id: 'usr_lead_02', email: 'smm_master@mail.ru', createdAt: new Date(Date.now() - 50 * 60000) },
    ];

    agent = new AutonomousPpcAgent({
      directClient: mockDirect,
      metrikaClient: mockMetrika,
      croWebhook: mockCro,
      maxDailyBudgetRub: 4000,
    });
  } else {
    agent = new AutonomousPpcAgent({
      maxDailyBudgetRub: 4000,
    });
  }

  try {
    console.log('\n[1/4] Executing OODA Cycle...');
    const result = await agent.runOodaCycle({ dryRun: args.dryRun });

    console.log('\n[2/4] Cycle Results:');
    console.log(`  - Campaigns Analyzed: ${result.campaignsAnalyzed}`);
    console.log(`  - Phrases Analyzed: ${result.phrasesAnalyzed}`);
    console.log(`  - Commercial Phrases: ${result.commercialPhrasesCount}`);
    console.log(`  - Negative Keywords: ${result.newMinusWordsIdentified.length}`);
    console.log(`  - Click-Fraud Alerts: ${result.clickFraudAlerts.length}`);
    console.log(`  - Summary: ${result.summary}`);

    if (result.newMinusWordsIdentified.length > 0) {
      console.log('\n[3/4] New Negative Keywords Sample:');
      console.log(' ', result.newMinusWordsIdentified.slice(0, 15).join(', '));
    }

    console.log('\n[4/4] Sending Telegram Telemetry Dispatch...');
    const tgMessage = formatTelegramReport(result);
    const sent = await sendTelegramNotification(tgMessage);
    if (sent) {
      console.log('  ✓ Telegram notification successfully delivered to admin.');
    } else {
      console.log('  ℹ Telegram bot token not configured or chat unreachable (skipped).');
    }

    console.log('\n✅ PPC Autopilot Cycle finished with 100% success.');
    process.exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Critical Error in PPC Autopilot: ${message}`);
    process.exit(1);
  }
}

main();
