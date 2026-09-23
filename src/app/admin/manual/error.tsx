'use client';

import { AdminSectionError } from '@/components/admin/section-error';

export default function ManualError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminSectionError error={error} reset={reset} sectionTitle="Руководство и База знаний" />;
}
