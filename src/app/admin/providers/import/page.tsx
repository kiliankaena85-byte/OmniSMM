import { adminProviderService } from '@/services/admin/provider.service';
import { ImportWizard } from './components/import-wizard';
import Link from 'next/link';
import { Download, PlusCircle, FolderPlus } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { CATALOG_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';
import { headers } from 'next/headers';
import { normalizeTenantId } from '@/lib/tenant-resolver-edge';
import { resolveAdminTenantContext } from '@/utils/admin-tenant';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { enforceSectionAccess } from '@/lib/server/rbac';

type ImportPageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const dynamic = 'force-dynamic';

export default async function ImportProvidersPage({ searchParams }: ImportPageProps) {
  await enforceSectionAccess('catalog');

  const sParams = searchParams ? await searchParams : {};
  const urlTenant = typeof sParams.tenant === 'string' ? sParams.tenant : undefined;

  const reqHeaders = await headers();
  const session = await verifySession();
  const user = session
    ? await db.user.findUnique({ where: { id: session.userId } })
    : null;

  const resolvedTenant = resolveAdminTenantContext(user, urlTenant);
  const selectedTenant =
    resolvedTenant !== 'all' ? resolvedTenant : normalizeTenantId(reqHeaders.get('x-tenant-id')) || 'smmplan';

  const categories = await adminProviderService.listCategories(selectedTenant);
  const providers = await adminProviderService.listProviders();
  const activeProviders = providers.filter(p => p.isActive);

  const noProviders = activeProviders.length === 0;
  const noCategories = categories.length === 0;
  const canImport = !noProviders && !noCategories;

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out sm:px-2 md:px-0 min-h-full pb-10">
      <AdminTabbedHeader
        icon={Download}
        title="Импорт Услуг"
        description="Загрузите каталог провайдера, выберите услуги и импортируйте в один клик."
        tabs={CATALOG_TABS}
        onboardingKey="providers"
        onboarding={ONBOARDING_CONFIGS.providers}
      />

      {/* PATCH P1-5: split empty state — two distinct scenarios with correct links */}
      {!canImport ? (
        <div className="bg-card/60 backdrop-blur-xs border border-border/70 p-6 rounded-lg shadow-xs space-y-4">
          <h2 className="text-base font-bold tracking-tight flex items-center gap-2 text-foreground">
            <span className="bg-muted/50 p-1.5 rounded-md">
              {noProviders ? <PlusCircle className="w-4 h-4 text-warning" /> : <FolderPlus className="w-4 h-4 text-warning" />}
            </span>
            {noProviders && noCategories
              ? 'Подготовка к первому импорту'
              : noProviders
              ? 'Провайдер не настроен'
              : 'Нет категорий'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {noProviders && noCategories
              ? 'Для импорта услуг необходимы минимум один активный провайдер API и хотя бы одна категория в каталоге. Настройте оба компонента, затем вернитесь сюда.'
              : noProviders
              ? 'Нет активных провайдеров API. Добавьте провайдера, чтобы получить доступ к его каталогу услуг.'
              : `Для тенанта «${selectedTenant}» нет доступных категорий. Создайте категории для соцсетей, чтобы импортированные услуги попали в правильные разделы.`}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {noProviders && (
              <Link
                href="/admin/providers/new"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 active:scale-95 shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                + Добавить провайдера
              </Link>
            )}
            {noCategories && (
              <Link
                href="/admin/catalog/categories"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 active:scale-95 shadow-xs"
              >
                <FolderPlus className="w-4 h-4" />
                Создать категории
              </Link>
            )}
            {noProviders && noCategories && (
              <span className="text-xs text-muted-foreground">
                Шаг 1 — Провайдер → Шаг 2 — Категории → Шаг 3 — Импорт
              </span>
            )}
          </div>
        </div>
      ) : (
        <ImportWizard categories={categories} providers={activeProviders} />
      )}
    </div>
  );
}
