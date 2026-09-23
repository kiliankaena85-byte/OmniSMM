'use client';

import { AdminSectionError } from '@/components/admin/section-error';

export default function PagesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminSectionError error={error} reset={reset} sectionTitle="Контент и страницы" />;
}
