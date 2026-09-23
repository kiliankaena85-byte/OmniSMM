import { adminProviderService } from '@/services/admin/provider.service';
import { ProviderForm } from '../components/provider-form';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { enforceSectionAccess } from '@/lib/server/rbac';

export const dynamic = 'force-dynamic';

export default async function EditProviderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // AUD-09 (4.1): provider management requires the 'providers' section
  await enforceSectionAccess('providers');

  const { id } = await params;

  // DTO — never includes raw encrypted apiKey
  const provider = await adminProviderService.getProviderDetail(id);

  if (!provider) {
    notFound();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/providers"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-95 w-fit"
          aria-label="Назад к списку провайдеров"
        >
          <ArrowLeft className="w-4 h-4" />
          Провайдеры
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Настройки: {provider.name}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Технические параметры API-подключения.
          {provider.hasApiKey && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-success font-medium bg-success/10 px-2 py-0.5 rounded-full border border-success/20">
              🔒 API Key установлен
            </span>
          )}
        </p>
      </div>

      <ProviderForm initialData={provider} />
    </div>
  );
}
