import { NavGroup } from '@/types/operator/navigation';

export const OPERATOR_NAVIGATION: NavGroup[] = [
  {
    group: 'Операционная панель',
    items: [
      {
        href: '/operator/dashboard',
        label: 'Дашборд',
        icon: 'LayoutDashboard',
      },
      {
        href: '/operator/orders',
        label: 'Заказы',
        icon: 'Package',
      },
      {
        href: '/operator/tickets',
        label: 'Тикеты',
        icon: 'MessageSquare',
        badgeKey: 'openTickets',
      },
    ],
  },
  {
    group: 'Управление',
    items: [
      {
        href: '/operator/users',
        label: 'Пользователи',
        icon: 'Users',
      },
      {
        href: '/operator/transactions',
        label: 'Транзакции',
        icon: 'CreditCard',
      },
    ],
  },
];
