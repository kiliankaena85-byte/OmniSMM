import { ReactNode } from 'react';
import { enforceSectionAccess } from '@/lib/server/rbac';

export default async function PagesLayout({ children }: { children: ReactNode }) {
  await enforceSectionAccess('content');
  return children;
}
