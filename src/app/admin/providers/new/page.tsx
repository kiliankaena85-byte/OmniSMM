import { ProviderForm } from "../components/provider-form";
import { enforceSectionAccess } from '@/lib/server/rbac';

export const dynamic = "force-dynamic";

export default async function NewProviderPage() {
  // AUD-09 (4.1): provider management requires the 'providers' section
  await enforceSectionAccess('providers');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Новое подключение</h1>
        <p className="text-muted-foreground text-sm">Добавьте новую SMM панель для расширения каталога.</p>
      </div>

      <ProviderForm />
    </div>
  );
}
