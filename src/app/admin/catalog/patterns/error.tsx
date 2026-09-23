'use client';

import { AdminSectionError } from '@/components/admin/section-error';

export default function PatternsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminSectionError error={error} reset={reset} sectionTitle="Паттерны ссылок" />;
}
