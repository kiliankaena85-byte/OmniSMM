'use client';

import { AdminSectionError } from '@/components/admin/section-error';

export default function RolesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminSectionError error={error} reset={reset} sectionTitle="Роли и матрица прав" />;
}
