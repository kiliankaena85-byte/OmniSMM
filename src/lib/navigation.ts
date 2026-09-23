import { 
  LayoutDashboard, 
  PlusCircle, 
  ListOrdered, 
  Receipt,
  Wallet, 
  HelpCircle, 
  Settings,
  Users,
  type LucideIcon
} from 'lucide-react';

export interface NavItem {
  name: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  exact?: boolean;
}

export const MAIN_NAV_ITEMS: NavItem[] = [
  {
    name: 'Дашборд',
    label: 'Дашборд',
    href: '/dashboard',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    name: 'Создать заказ',
    label: 'Создать заказ',
    href: '/dashboard/new-order',
    icon: PlusCircle,
  },
  {
    name: 'Мои заказы',
    label: 'Заказы',
    href: '/dashboard/orders',
    icon: ListOrdered,
  },
  {
    name: 'Финансы',
    label: 'Финансы',
    href: '/dashboard/finance',
    icon: Wallet,
  },
  {
    name: 'Партнёрам',
    label: 'Партнёрам',
    href: '/dashboard/referrals',
    icon: Users,
  },
  {
    name: 'Поддержка',
    label: 'Поддержка',
    href: '/dashboard/tickets',
    icon: HelpCircle,
  },
  {
    name: 'Настройки',
    label: 'Настройки',
    href: '/dashboard/settings',
    icon: Settings,
  },
];

export const MOBILE_BOTTOM_NAV_ITEMS: NavItem[] = [
  {
    name: 'Дашборд',
    label: 'Дашборд',
    href: '/dashboard',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    name: 'Создать заказ',
    label: 'Заказ',
    href: '/dashboard/new-order',
    icon: PlusCircle,
  },
  {
    name: 'Мои заказы',
    label: 'Заказы',
    href: '/dashboard/orders',
    icon: ListOrdered,
  },
  {
    name: 'Финансы',
    label: 'Финансы',
    href: '/dashboard/finance',
    icon: Wallet,
  },
  {
    name: 'Поддержка',
    label: 'Помощь',
    href: '/dashboard/tickets',
    icon: HelpCircle,
  },
];

export const DOCK_NAV_ITEMS: NavItem[] = MAIN_NAV_ITEMS;

export const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    name: 'Панель администратора',
    label: 'Админка',
    href: '/admin',
    icon: Settings,
  },
  {
    name: 'Пользователи',
    label: 'Пользователи',
    href: '/admin/users',
    icon: Users,
  },
];
