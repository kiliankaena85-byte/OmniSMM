import { enforceSectionAccess } from '@/lib/server/rbac';
import { getLinkPatternsAction } from '@/actions/admin/link-patterns';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { CATALOG_TABS } from '@/components/admin/navigation-data';
import { Code2 } from 'lucide-react';
import { PatternsClient } from './patterns-client';

export const metadata = {
  title: 'Паттерны ссылок & RegEx | OmniSMM 1.0',
};

export default async function LinkPatternsPage() {
  await enforceSectionAccess('catalog');

  const res = await getLinkPatternsAction();
  const patterns = res.success && res.data ? res.data.patterns : [];
  const networks = res.success && res.data ? res.data.networks : [];

  return (
    <div className="space-y-6">
      <AdminTabbedHeader
        icon={Code2}
        title="Паттерны валидации ссылок"
        description="Настройка регулярных выражений для автоматического распознавания соцсетей и типов контента (посты, каналы, профили)."
        tabs={CATALOG_TABS}
      />
      <PatternsClient initialPatterns={patterns} networks={networks} />
    </div>
  );
}
