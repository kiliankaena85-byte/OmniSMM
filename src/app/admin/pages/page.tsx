import { db } from '@/lib/db';
import Link from 'next/link';
import { PagesTable } from './client-table';
import { FileText } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { SYSTEM_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';

export const dynamic = 'force-dynamic';

export default async function AdminPagesList() {
  const pages = await db.contentItem.findMany({
    where: { type: 'PAGE' },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out min-h-full pb-10">
      <AdminTabbedHeader
        icon={FileText}
        title="CMS Страницы"
        description="Управление текстовым контентом публичного сайта (оферта, контакты, правила)."
        action={(
          <Link href="/admin/cms/new" className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-primary-foreground bg-primary shadow-sm rounded-lg hover:opacity-90 transition-all">
            + Создать Страницу
          </Link>
        )}
        tabs={SYSTEM_TABS}
        onboardingKey="pages"
        onboarding={ONBOARDING_CONFIGS.pages}
      />

      <div className="rounded-lg border border-border/70 shadow-xs bg-card overflow-hidden">
        <PagesTable pages={pages} />
      </div>
    </div>
  );
}
