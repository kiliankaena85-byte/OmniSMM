import type { BotContext } from '../types/bot-context';
/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Created by Artem (http://artmspektr.ru)
 * Unauthorized copying of this file is strictly prohibited.
 *
 * MIGRATED TO SMMPLAN LITE CORE (April 2026)
 */
import { Scenes, Markup } from 'telegraf';
import { db } from '@/lib/db';
import { UnifiedPaymentService } from '@/services/financial/unified-payment.service';

export const DEPOSIT_WIZARD = 'deposit-wizard';

/**
 * Resolve Lite User from Telegram context.
 */
const botTenantId = process.env.BOT_TENANT_ID || 'smmplan';

async function resolveUser(tgId: number) {
  return db.user.findFirst({
    where: { telegramId: String(tgId), tenantId: botTenantId }
  });
}

import { handleWizardMenuNavigation } from '../utils/menu-navigation';

// ──────────────────────────────────────────────────────────────
// WIZARD DEFINITION
// ──────────────────────────────────────────────────────────────
export const depositWizard = new Scenes.WizardScene<BotContext>(
  DEPOSIT_WIZARD,

  // ШАГ 1: Запрос суммы
  
  async (ctx: BotContext) => {
    (ctx.wizard.state as Record<string, unknown>).depositData = {};
    await ctx.reply('💰 <b>Пополнение баланса</b>\n\nВведите сумму пополнения в рублях (от 100 до 500 000):', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'cancel_deposit')]])
    });
    return ctx.wizard.next();
  },

  // ШАГ 2: Обработка суммы и выбор метода
  
  async (ctx: BotContext) => {
    const msgText = (ctx.message && "text" in ctx.message && typeof ctx.message.text === "string") ? ctx.message.text : "";
    if (await handleWizardMenuNavigation(ctx, msgText)) {
      return;
    }
    if (!msgText) {
      return ctx.reply('❌ Пожалуйста, введите число.');
    }
    
    const amount = parseInt(msgText.replace(/\D/g, ""), 10);
    if (isNaN(amount) || amount < 100 || amount > 500000) {
      return ctx.reply(
        '⚠️ <b>Некорректная сумма</b>\n\n' +
        'Сумма пополнения должна быть от <b>100</b> до <b>500 000 ₽</b>.\n' +
        'Пожалуйста, введите сумму числом (например: <code>500</code>):',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Отмена', 'cancel_deposit'), Markup.button.callback('🆘 Поддержка', 'support')]
          ])
        }
      );
    }

    const depositData = ((ctx.wizard.state as Record<string, unknown>).depositData || {}) as { amount?: number };
    depositData.amount = amount;
    (ctx.wizard.state as Record<string, unknown>).depositData = depositData;

    await ctx.reply(
      `Вы указали сумму: <b>${amount.toLocaleString('ru-RU')} ₽</b>\n\nВыберите способ оплаты:`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💳 Банковская карта / СБП', 'pay_yookassa')],
          [Markup.button.callback('🪙 Криптовалюта (USDT, TON...)', 'pay_cryptobot')],
          [Markup.button.callback('❌ Отмена', 'cancel_deposit')]
        ])
      }
    );
    return ctx.wizard.next();
  },

  // ШАГ 3: Заглушка, обрабатываемая через .action()
    async () => { return; }
);

// ──────────────────────────────────────────────────────────────
// SCENE GUARD & ACTIONS
// ──────────────────────────────────────────────────────────────

depositWizard.use(async (ctx, next) => {
  if (ctx.callbackQuery && 'data' in ctx.callbackQuery && typeof ctx.callbackQuery.data === 'string') {
    const data = ctx.callbackQuery.data;
    if (['pay_yookassa', 'pay_cryptobot', 'cancel_deposit'].includes(data)) {
      return next();
    }
  }
  const msgText = ctx.message && 'text' in ctx.message && typeof ctx.message.text === 'string' ? ctx.message.text : '';
  if (msgText.startsWith('/') && msgText !== '/cancel') {
    await ctx.scene.leave();
    return next();
  }
  return next();
});


depositWizard.action('cancel_deposit', async (ctx: BotContext) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('❌ <b>Пополнение отменено.</b>', {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Пополнить снова', 'deposit'), Markup.button.callback('🏠 В главное меню', 'nav_start')]
    ])
  }).catch(() => {});
  return ctx.scene.leave();
});


depositWizard.action(/pay_(yookassa|cryptobot)/, async (ctx: BotContext) => {
  if (!ctx.match || !ctx.from) return ctx.scene.leave();
  await ctx.answerCbQuery().catch(() => {});
  const gateway = ctx.match[1] as 'yookassa' | 'cryptobot';
  const depositData = (ctx.wizard.state as Record<string, unknown>).depositData as { amount?: number } | undefined;
    const amount = depositData?.amount;
  if (!ctx.from) return ctx.scene.leave();
    const tgId = ctx.from.id;

  if (!amount) {
    await ctx.reply('❌ Ошибка сессии. Попробуйте снова.');
    return ctx.scene.leave();
  }

  try {
    const user = await resolveUser(tgId);
    if (!user) {
      await ctx.reply('❌ Пользователь не найден. Используйте /start для регистрации.');
      return ctx.scene.leave();
    }

    await ctx.editMessageText('🔄 Создаю платеж, подождите...');

    const siteName = (botTenantId === 'flux' || botTenantId === 'lovable') ? 'SMMflux' : 'SMMplan';
    const res = await UnifiedPaymentService.createPayment(
      undefined,
      user.id,
      amount,
      `Пополнение баланса ${siteName} (TG)`,
      { source: 'BOT', type: 'deposit' },
      gateway
    );

    if (res.success && res.confirmationUrl) {
      await ctx.editMessageText(
        `💳 <b>ССЫЛКА ДЛЯ ОПЛАТЫ</b>\n────────────────────\n` +
        `Сумма: <b>${amount.toLocaleString('ru-RU')} ₽</b>\n` +
        `Шлюз: <b>${gateway === 'yookassa' ? 'YooKassa' : 'CryptoBot'}</b>\n\n` +
        `<i>Нажмите кнопку ниже для перехода к оплате. Баланс будет пополнен автоматически.</i>`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.url('↗️ ОПЛАТИТЬ', res.confirmationUrl)],
            [Markup.button.callback('❌ Отмена', 'cancel_deposit')]
          ])
        }
      );
    } else {
      const errorText = res.error || 'Попробуйте позже.';
      await ctx.editMessageText(
        `❌ <b>Ошибка при создании платежа</b>\n────────────────────\n${errorText}\n\n` +
        `<i>Если проблема повторяется, напишите в нашу поддержку — мы поможем вам прямо сейчас:</i>`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🆘 Написать в поддержку', 'support')],
            [Markup.button.callback('🔄 Попробовать снова', 'deposit'), Markup.button.callback('🏠 В главное меню', 'nav_start')]
          ])
        }
      );

      try {
        const { sendAdminAlert } = await import('@/lib/notifications');
        sendAdminAlert(
          `💳 <b>[BOT ALERT: Не удалось пополнить баланс]</b>\n\n` +
          `👤 <b>TG ID:</b> <code>${tgId}</code> (@${ctx.from.username || '—'})\n` +
          `🆔 <b>User ID:</b> <code>${user.id}</code>\n` +
          `💰 <b>Сумма:</b> <b>${amount.toLocaleString('ru-RU')} ₽</b>\n` +
          `🏛️ <b>Шлюз:</b> <b>${gateway}</b>\n` +
          `⚠️ <b>Ошибка:</b> <code>${errorText}</code>`,
          'WARNING',
          botTenantId
        );
      } catch { /* alert must not throw */ }
    }
  } catch (e: unknown) {
    console.error('[DepositWizard] Error:', e);
    const errText = e instanceof Error ? e.message : String(e);
    await ctx.reply(
      '❌ <b>Произошла техническая ошибка</b>\n────────────────────\n' +
      'Пожалуйста, свяжитесь с поддержкой, если средства списались или возникла задержка:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🆘 Написать в поддержку', 'support')],
          [Markup.button.callback('🏠 В главное меню', 'nav_start')]
        ])
      }
    );

    try {
      const { sendAdminAlert } = await import('@/lib/notifications');
      sendAdminAlert(
        `💥 <b>[BOT CRITICAL: Исключение в DepositWizard]</b>\n\n` +
        `👤 <b>TG ID:</b> <code>${ctx.from?.id || '—'}</code> (@${ctx.from?.username || '—'})\n` +
        `⚠️ <b>Ошибка:</b> <code>${errText}</code>`,
        'CRITICAL',
        botTenantId
      );
    } catch { /* alert must not throw */ }
  }
  return ctx.scene.leave();
});

depositWizard.action('cancel_deposit', async (ctx: BotContext) => {
  await ctx.answerCbQuery('Пополнение отменено');
  await ctx.reply('❌ Пополнение баланса отменено.');
  return ctx.scene.leave();
});

depositWizard.command('cancel', async (ctx: BotContext) => {
  await ctx.reply('❌ Пополнение баланса отменено.');
  return ctx.scene.leave();
});

depositWizard.hears(/(.+)/, async (ctx: BotContext, next) => {
  const text = (ctx.message && 'text' in ctx.message && typeof ctx.message.text === 'string') ? ctx.message.text : '';
  if (await handleWizardMenuNavigation(ctx, text)) {
    return;
  }
  return next();
});
