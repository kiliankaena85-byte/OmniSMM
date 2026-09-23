import { PreLaunchHoldingScreen } from "@/components/landing/PreLaunchHoldingScreen";
import { SettingsProvider } from "@/lib/settings";
import { headers } from "next/headers";
import { normalizeTenantId } from "@/lib/tenant-resolver-edge";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const settings = await SettingsProvider.getContactAndLegalSettings();
  const siteName = settings.SITE_NAME || "SMMplan";
  
  return {
    title: `Скоро открытие • Закрытый бета-тест оптовой платформы | ${siteName}`,
    description: "Первая оптовая экосистема SMM-продвижения по себестоимости. Оставьте email и получите 1 000 ₽ на баланс при запуске.",
  };
}

export default async function PreLaunchPage() {
  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get("x-tenant-id")) || "smmplan";
  const settings = await SettingsProvider.getContactAndLegalSettings();

  return (
    <PreLaunchHoldingScreen
      siteName={settings.SITE_NAME || "SMMplan"}
      supportTelegram={settings.TELEGRAM_SUPPORT_BOT || "smmplan_support_bot"}
      supportEmail={settings.SUPPORT_EMAIL || "support@smmplan.pro"}
      tenantId={tenantId}
    />
  );
}
