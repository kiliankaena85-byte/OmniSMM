'use client';

import { AdminSectionError } from '@/components/admin/section-error';

export default function CategoriesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminSectionError error={error} reset={reset} sectionTitle="Категории каталога" />;
}
