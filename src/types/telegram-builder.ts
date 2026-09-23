/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * TypeScript definitions and presets for Telegram Bot Constructor & Multi-Bot Platform.
 */

import type { TelegramMenuButton } from './telegram';

export type TelegramBotRole =
  | 'STORE_FULL'       // Магазин SMM (Каталог, заказы, пополнение, профиль)
  | 'SUPPORT_ONLY'     // Только поддержка (Тикеты, диалог с саппортом, CSAT, FAQ)
  | 'NEWS_BROADCAST'   // Новости и рассылки (Канал, акции, промокоды)
  | 'STAFF_ADMIN'      // Пульт для сотрудников (DevOps, статус контейнеров, алерты)
  | 'CUSTOM_BUILDER';  // Свободный конструктор (Кастомные сценарии и флоу)

export interface BotFlowButton {
  id: string;
  label: string;
  action: 'next_step' | 'open_catalog' | 'open_orders' | 'call_operator' | 'open_deposit' | 'open_url' | 'command';
  targetStepId?: string;
  url?: string;
  command?: string;
  style?: 'default' | 'primary' | 'danger';
}

export interface BotFlowStep {
  id: string;
  title: string;
  triggerType: 'command' | 'text' | 'callback' | 'entry';
  triggerValue: string; // e.g. "/start", "help", "btn_click_1"
  messageText: string;
  buttons: BotFlowButton[];
  actionType: 'reply' | 'call_operator' | 'open_catalog' | 'open_orders' | 'open_deposit' | 'custom_url';
  actionUrl?: string;
}

export interface TelegramBotInstanceDTO {
  id: string;
  tenantId: string;
  name: string;
  username: string | null;
  tokenMasked: string;
  role: TelegramBotRole;
  description: string | null;
  isActive: boolean;
  maintenanceMode: boolean;
  welcomeMessage: string | null;
  menuConfig: TelegramMenuButton[];
  templates: Record<string, string>;
  flowConfig: BotFlowStep[];
  allowedUserIds: string[];
  createdAt: string;
  updatedAt: string;
  pingMs?: number;
  isOnline?: boolean;
}

export interface CreateTelegramBotInput {
  name: string;
  token: string;
  role: TelegramBotRole;
  tenantId?: string;
  description?: string;
  presetKey?: TelegramBotRole;
  welcomeMessage?: string;
}

export interface UpdateTelegramBotInput {
  name?: string;
  description?: string;
  role?: TelegramBotRole;
  token?: string; // Optional: only if updating token
  isActive?: boolean;
  maintenanceMode?: boolean;
  welcomeMessage?: string;
  menuConfig?: TelegramMenuButton[];
  templates?: Record<string, string>;
  flowConfig?: BotFlowStep[];
  allowedUserIds?: string[];
}

export interface BotPresetDefinition {
  role: TelegramBotRole;
  title: string;
  description: string;
  iconName: string;
  badge: string;
  welcomeMessage: string;
  menuConfig: TelegramMenuButton[];
  flowConfig: BotFlowStep[];
  templates: Record<string, string>;
}

export const BOT_PRESETS: Record<TelegramBotRole, BotPresetDefinition> = {
  STORE_FULL: {
    role: 'STORE_FULL',
    title: 'Магазин SMM (Каталог и продажи)',
    description: 'Полноценный магазин услуг: умный заказ по ссылке, витрина услуг, пополнение баланса, отслеживание заказов и рефералы.',
    iconName: 'ShoppingBag',
    badge: 'Рекомендуется',
    welcomeMessage:
      '👋 <b>{userName}, добро пожаловать в {siteName}!</b>\n\n' +
      'Платформа автоматического продвижения в социальных сетях.\n\n' +
      '💰 Ваш баланс: <b>{balance} ₽</b>\n\n' +
      '⚡ <b>Как сделать заказ за 2 простых шага:</b>\n' +
      '1️⃣ Нажмите <b>«🚀 Быстрый заказ по ссылке»</b> или просто <b>отправьте ссылку в чат</b>.\n' +
      '2️⃣ Выберите подходящий тариф и укажите количество.\n\n' +
      '<i>Либо воспользуйтесь разделами меню ниже:</i>',
    menuConfig: [
      { id: 'm1', label: '🚀 Заказать по ссылке', action: 'FAST_ORDER', row: 0, col: 0, isActive: true },
      { id: 'm2', label: '🛍 Каталог услуг', action: 'CATALOG', row: 0, col: 1, isActive: true },
      { id: 'm3', label: '💰 Пополнить', action: 'REFILL', row: 1, col: 0, isActive: true },
      { id: 'm4', label: '👤 Профиль', action: 'PROFILE', row: 1, col: 1, isActive: true },
      { id: 'm5', label: '🆘 Поддержка', action: 'SUPPORT', row: 2, col: 0, isActive: true },
      { id: 'm6', label: '👥 Рефералы', action: 'REFERRALS', row: 2, col: 1, isActive: true }
    ],
    flowConfig: [],
    templates: {
      welcome: '👋 <b>{userName}, добро пожаловать в {siteName}!</b>',
      ratingThanks: '⭐ <b>Спасибо за оценку!</b> Нам важно ваше мнение.',
      orderCreated: '✅ <b>Заказ #{orderId} успешно принят!</b>'
    }
  },

  SUPPORT_ONLY: {
    role: 'SUPPORT_ONLY',
    title: 'Бот Технической Поддержки',
    description: 'Выделенный бот только для обращений клиентов, ответов на частые вопросы (FAQ), сбора тикетов и CSAT-оценок качества.',
    iconName: 'Headphones',
    badge: 'Поддержка 24/7',
    welcomeMessage:
      '👋 <b>Здравствуйте, {userName}!</b>\n\n' +
      'Вы обратились в <b>Службу заботы о клиентах {siteName}</b>.\n\n' +
      'Наши специалисты готовы помочь вам решить любой вопрос по заказам, балансу или работе сервиса.\n\n' +
      '💬 <b>Просто напишите ваш вопрос прямо в этот чат</b> (можно прикрепить скриншот или чек), и первый освободившийся оператор сразу ответит вам!',
    menuConfig: [
      { id: 's1', label: '✍️ Написать оператору', action: 'SUPPORT', row: 0, col: 0, isActive: true },
      { id: 's2', label: '❓ Частые вопросы (FAQ)', action: 'TEXT_REPLY', value: 'ℹ️ <b>Частые вопросы:</b>\n\n• <b>Скорость запуска:</b> от 5 минут до 2 часов.\n• <b>Гарантия:</b> если заказ списался, напишите нам ссылку.\n• <b>Пополнение:</b> зачисление моментальное.', row: 0, col: 1, isActive: true },
      { id: 's3', label: '🌐 Перейти на сайт', action: 'URL', value: 'https://smmplan.pro', row: 1, col: 0, isActive: true },
      { id: 's4', label: '📦 Мои тикеты', action: 'SUPPORT', row: 1, col: 1, isActive: true }
    ],
    flowConfig: [],
    templates: {
      welcome: '👋 <b>Здравствуйте! Служба заботы {siteName} на связи.</b> Напишите ваш вопрос!',
      ticketClosedRating: '✅ <b>Ваш вопрос решён и тикет #{ticketId} закрыт.</b> Оцените качество работы поддержки:',
      ratingThanks: '⭐ <b>Спасибо за ваш отзыв!</b> Вы помогаете нам становиться лучше.'
    }
  },

  NEWS_BROADCAST: {
    role: 'NEWS_BROADCAST',
    title: 'Новостной и Маркетинговый Бот',
    description: 'Информационный бот для рассылок, оповещений об акциях, активации промокодов, ссылок на официальный канал и промо-конкурсов.',
    iconName: 'Megaphone',
    badge: 'Маркетинг',
    welcomeMessage:
      '📢 <b>Привет, {userName}!</b>\n\n' +
      'Это официальный информационный бот <b>{siteName}</b>.\n\n' +
      'Здесь вы первыми узнаете о:\n' +
      '🔥 Свежих скидках до -50% на топовые услуги\n' +
      '🎁 Секретных промокодах и бонусах к пополнению\n' +
      '⚡ Обновлениях алгоритмов соцсетей и новых тарифах\n\n' +
      'Подпишитесь на наш канал и используйте меню ниже:',
    menuConfig: [
      { id: 'n1', label: '📢 Наш Telegram-канал', action: 'URL', value: 'https://t.me/smmplan_news', row: 0, col: 0, isActive: true },
      { id: 'n2', label: '🎁 Ввести промокод', action: 'TEXT_REPLY', value: '🎁 Для активации промокода авторизуйтесь на сайте в личном кабинете в разделе «Бонусы».', row: 0, col: 1, isActive: true },
      { id: 'n3', label: '🔥 Топ акций недели', action: 'TEXT_REPLY', value: '🔥 <b>Акции этой недели:</b>\n1. Telegram подписчики — скидка 20%\n2. VK просмотры постов — бонус х2 при заказе от 5000 шт.', row: 1, col: 0, isActive: true },
      { id: 'n4', label: '🛍 Открыть магазин', action: 'URL', value: 'https://smmplan.pro', row: 1, col: 1, isActive: true }
    ],
    flowConfig: [],
    templates: {
      welcome: '📢 <b>Привет, {userName}! Будь в курсе новостей и акций {siteName}.</b>'
    }
  },

  STAFF_ADMIN: {
    role: 'STAFF_ADMIN',
    title: 'DevOps & Staff Admin Пульт',
    description: 'Закрытый бот для команды: проверка здоровья Docker-контейнеров, остатков балансов на шлюзах провайдеров и оперативных алертов.',
    iconName: 'ShieldCheck',
    badge: 'Только сотрудники',
    welcomeMessage:
      '👑 <b>Центр управления OmniSMM 1.0 (Staff & DevOps Hub)</b>\n\n' +
      '👤 Авторизован сотрудник: <b>{userName}</b>\n\n' +
      'Выберите нужный контур для инспекции или управления:',
    menuConfig: [
      { id: 'a1', label: '📊 Состояние контейнеров', action: 'COMMAND', value: '/health', row: 0, col: 0, isActive: true },
      { id: 'a2', label: '💳 Баланс провайдеров', action: 'COMMAND', value: '/balances', row: 0, col: 1, isActive: true },
      { id: 'a3', label: '🚨 Очередь алертов', action: 'COMMAND', value: '/alerts', row: 1, col: 0, isActive: true },
      { id: 'a4', label: '🔄 Проверить прокси', action: 'COMMAND', value: '/proxy', row: 1, col: 1, isActive: true }
    ],
    flowConfig: [],
    templates: {
      welcome: '👑 <b>Staff DevOps Hub авторизован.</b>'
    }
  },

  CUSTOM_BUILDER: {
    role: 'CUSTOM_BUILDER',
    title: 'Свободный Конструктор (С нуля)',
    description: 'Чистый холст: создайте собственного бота с произвольными кнопками, ветвлениями, сценариями переходов и ответами.',
    iconName: 'Layers',
    badge: 'Кастомный',
    welcomeMessage: '👋 <b>Здравствуйте, {userName}!</b>\n\nДобро пожаловать в нашего бота. Выберите действие из меню ниже:',
    menuConfig: [
      { id: 'c1', label: 'ℹ️ О нас', action: 'TEXT_REPLY', value: 'Мы предоставляем качественные услуги продвижения.', row: 0, col: 0, isActive: true },
      { id: 'c2', label: '🌐 Наш сайт', action: 'URL', value: 'https://smmplan.pro', row: 0, col: 1, isActive: true }
    ],
    flowConfig: [
      {
        id: 'step_welcome',
        title: 'Приветственный шаг',
        triggerType: 'entry',
        triggerValue: '/start',
        messageText: '👋 <b>Привет!</b> Я ваш кастомный бот. Чем я могу помочь?',
        actionType: 'reply',
        buttons: [
          { id: 'b_info', label: 'ℹ️ Узнать больше', action: 'next_step', targetStepId: 'step_info' },
          { id: 'b_site', label: '🌐 Перейти на сайт', action: 'open_url', url: 'https://smmplan.pro' }
        ]
      },
      {
        id: 'step_info',
        title: 'Информационный шаг',
        triggerType: 'callback',
        triggerValue: 'step_info',
        messageText: '💡 <b>Информация о сервисе:</b>\nМы работаем 24/7 и обеспечиваем мгновенное выполнение заказов.',
        actionType: 'reply',
        buttons: [
          { id: 'b_back', label: '⬅️ Назад', action: 'next_step', targetStepId: 'step_welcome' }
        ]
      }
    ],
    templates: {
      welcome: '👋 <b>Добро пожаловать в нашего бота!</b>'
    }
  }
};
