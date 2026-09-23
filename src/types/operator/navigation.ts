export interface NavItem {
  href: string;
  label: string;
  icon: string;
  badgeKey?: string;
  badgeValue?: number;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}
