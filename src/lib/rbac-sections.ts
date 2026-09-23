export type RbacSectionId =
  | 'dashboard' | 'clients' | 'orders' | 'refills' | 'tickets'
  | 'catalog' | 'providers' | 'marketing' | 'content'
  | 'finance' | 'balance_requests' | 'balance_approvals' | 'balance_stats'
  | 'balance_policy' | 'analytics' | 'settings';

export const RBAC_SECTIONS: ReadonlyArray<{
  id: RbacSectionId;
  label: string;
  group: string;
  description: string;
}> = [
  { id: 'dashboard',        label: 'Дашборд',                group: 'Общее',    description: 'Главный экран метрик' },
  { id: 'clients',          label: 'Клиенты',                group: 'Операции', description: 'Карточки клиентов, бан, пароли, сессии' },
  { id: 'orders',           label: 'Заказы',                 group: 'Операции', description: 'Поток заказов, статусы, возвраты' },
  { id: 'refills',          label: 'Докрутки (Refills)',     group: 'Операции', description: 'Обработка докруток' },
  { id: 'tickets',          label: 'Поддержка (тикеты)',     group: 'Операции', description: 'Тикеты, ответы, Telegram-бинд' },
  { id: 'catalog',          label: 'Каталог услуг',          group: 'Каталог',  description: 'Услуги, категории, импорт, роутинг' },
  { id: 'providers',        label: 'Провайдеры API',         group: 'Каталог',  description: 'Подключения SMM-панелей' },
  { id: 'marketing',        label: 'Маркетинг',              group: 'Рост',     description: 'Промокоды, рефералы' },
  { id: 'content',          label: 'Контент',                group: 'Рост',     description: 'CMS-страницы, статьи блога' },
  { id: 'finance',          label: 'Финансы',                group: 'Деньги',   description: 'Касса, платежи, сверка' },
  { id: 'balance_requests', label: 'Заявки на баланс',       group: 'Деньги',   description: 'Создание/просмотр заявок на корректировку' },
  { id: 'balance_approvals',label: 'Согласование балансов',  group: 'Деньги',   description: 'Approve/reject заявок (роль Кассир)' },
  { id: 'balance_stats',    label: 'Статистика корректировок',group: 'Деньги',  description: 'Отчёт по операциям с балансами' },
  { id: 'balance_policy',   label: 'Политики балансов',      group: 'Деньги',   description: 'Лимиты безопасности на корректировки балансов' },
  { id: 'analytics',        label: 'Аналитика',              group: 'Аналитика',description: 'Воронки, LTV, прибыльность' },
  { id: 'settings',         label: 'Настройки и система',    group: 'Система',  description: 'Глобальные настройки, бренды, фичи, антифрод' },
];
