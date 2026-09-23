import { ReactNode } from 'react';
import { enforceSectionAccess } from '@/lib/server/rbac';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await enforceSectionAccess('dashboard');
  return children;
}
