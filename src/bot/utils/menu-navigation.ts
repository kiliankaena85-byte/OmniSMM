/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Centralized navigation router for Telegram Bot menus and scenes.
 * Handles seamless tab/screen switching even when user is deep inside a wizard.
 */
import type { BotContext } from '../types/bot-context';

export async function handleWizardMenuNavigation(ctx: BotContext, text: string): Promise<boolean> {
  const trimmed = (text || '').trim();
  if (!trimmed) return false;

  // 0. Dynamic menu buttons check configured in Admin Panel
  try {
    const { BotSettingsService } = await import('../services/bot-settings.service');
    const botTenantId = process.env.BOT_TENANT_ID || 'smmplan';
    const customBtn = await BotSettingsService.findButtonByText(trimmed, botTenantId);
    if (customBtn) {
      const { dispatchDynamicMenuAction } = await import('../index');
      return await dispatchDynamicMenuAction(ctx, trimmed);
    }
  } catch { /* proceed to standard patterns */ }

  // 0.1. Главное меню / Старт
  if (/^(🏠\s*Главное меню|Главная|Старт|\/start|\/menu)/i.test(trimmed)) {
    await ctx.scene.leave();
    const { sendMainMenu } = await import('../index');
    await sendMainMenu(ctx, false);
    return true;
  }

  // 1. Пополнение баланса
  if (/^(💰\s*Пополнить|Пополнить|Баланс|\/deposit|\/pay)/i.test(trimmed)) {
    await ctx.scene.leave();
    const { DEPOSIT_WIZARD } = await import('../scenes/deposit.wizard');
    await ctx.scene.enter(DEPOSIT_WIZARD);
    return true;
  }

  // 2. Каталог услуг
  if (/^(🛍\s*Каталог|Каталог|\/shop|\/catalog)/i.test(trimmed)) {
    await ctx.scene.leave();
    const { sendNetworkCatalogMenu } = await import('../index');
    await sendNetworkCatalogMenu(ctx, false);
    return true;
  }

  // 3. Личный кабинет / Профиль
  if (/^(👤\s*Профиль|Профиль|Личный кабинет|\/profile|\/me)/i.test(trimmed)) {
    await ctx.scene.leave();
    const { sendUserProfile } = await import('../index');
    await sendUserProfile(ctx);
    return true;
  }

  // 4. Реферальная система
  if (/^(👥\s*Рефералы|Рефералы|\/ref|\/referral)/i.test(trimmed)) {
    await ctx.scene.leave();
    const { REFERRAL_WIZARD } = await import('../scenes/referral.wizard');
    await ctx.scene.enter(REFERRAL_WIZARD);
    return true;
  }

  // 5. Мои заказы
  if (/^(📦\s*Мои заказы|Мои заказы|Заказы|\/orders)/i.test(trimmed)) {
    await ctx.scene.leave();
    const { sendUserOrders } = await import('../index');
    await sendUserOrders(ctx);
    return true;
  }

  // 6. Поддержка
  if (/^(🆘\s*Поддержка|Поддержка|Помощь|\/support|\/help)/i.test(trimmed)) {
    await ctx.scene.leave();
    const { sendSupportPrompt } = await import('../index');
    await sendSupportPrompt(ctx);
    return true;
  }

  // 7. Быстрый заказ по ссылке
  if (/^(🚀\s*Заказать по ссылке|Быстрый заказ|Заказать по ссылке)/i.test(trimmed)) {
    await ctx.scene.leave();
    const { sendFastOrderPrompt } = await import('../index');
    await sendFastOrderPrompt(ctx);
    return true;
  }

  // 8. Пульт овнера
  if (/^(👑\s*Пульт|Пульт Овнера|⚙️\s*Админка|\/owner)/i.test(trimmed)) {
    await ctx.scene.leave();
    await ctx.scene.enter('owner-hub');
    return true;
  }

  return false;
}
