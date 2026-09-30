import { getPublicCatalogAction, getServicesByCategoryAction, type PublicNetwork, type PublicService } from "@/actions/order/catalog";
import { getBaseUrlAsync } from "@/utils/get-base-url";
import { SettingsProvider, type ContactAndLegalSettings } from "@/lib/settings";
import { getCachedGuestBundleWithRedis } from "@/services/catalog/catalog-cache.service";
import { verifySession } from "@/lib/session";
import { db } from "@/lib/db";

export interface StorefrontGuestBundle {
  catalog: PublicNetwork[];
  settings: ContactAndLegalSettings;
  baseUrl: string;
  defaultCategoryId?: string;
  defaultNetworkId?: string;
  defaultServices: PublicService[];
}

export async function fetchGuestBundle(tenantId: string): Promise<StorefrontGuestBundle> {
  const [catalogResult, settings, baseUrl] = await Promise.all([
    getPublicCatalogAction(tenantId),
    SettingsProvider.getContactAndLegalSettings(tenantId),
    getBaseUrlAsync(),
  ]);

  const catalog = catalogResult.success && catalogResult.data ? catalogResult.data : [];
  let defaultCategoryId: string | undefined = undefined;
  let defaultNetworkId: string | undefined = undefined;

  if (catalog.length > 0) {
    const defaultNet = catalog.find((n) => n.slug === "telegram") || catalog[0];
    const defaultCat =
      defaultNet?.categories.find((c) =>
        c.name.toLowerCase().includes("подписчики")
      ) || defaultNet?.categories[0];
    defaultCategoryId = defaultCat?.id;
    defaultNetworkId = defaultNet?.id;
  }

  const defaultServices = defaultCategoryId
    ? await getServicesByCategoryAction(defaultCategoryId, tenantId)
    : [];

  return {
    catalog,
    settings,
    baseUrl,
    defaultCategoryId,
    defaultNetworkId,
    defaultServices,
  };
}

export async function getStorefrontGuestBundle(tenantId: string): Promise<StorefrontGuestBundle> {
  return SettingsProvider.isTestEnvironment()
    ? fetchGuestBundle(tenantId)
    : getCachedGuestBundleWithRedis(tenantId, () => fetchGuestBundle(tenantId));
}

export async function generateStorefrontMetadata() {
  const settings = await SettingsProvider.getContactAndLegalSettings();
  const siteName = settings.SITE_NAME || "SMMplan";

  return {
    title: `Продвижение подписчиков и просмотров в Telegram, Instagram, VK | ${siteName}`,
    description:
      settings.SITE_DESCRIPTION ||
      "Оптовая платформа продвижения в соцсетях. Надежно и конфиденциально. Мгновенный старт.",
    alternates: { canonical: "/" },
    openGraph: {
      title: `${siteName} — Продвижение в соцсетях`,
      description:
        settings.SITE_DESCRIPTION ||
        "Профессиональная продвижение подписчиков, просмотров, лайков для бизнеса.",
      type: "website",
    },
  };
}

export interface StorefrontDataParams {
  tenantId: string;
  isGuest: boolean;
  initialServiceId?: string;
  initialCategoryId?: string;
  initialNetworkId?: string;
}

export async function loadStorefrontData(params: StorefrontDataParams) {
  const { tenantId, isGuest, initialServiceId } = params;
  let targetCategoryId = params.initialCategoryId;
  let targetNetworkId = params.initialNetworkId;

  let catalog: PublicNetwork[] = [];
  let settings: ContactAndLegalSettings;
  let baseUrl = "";
  let initialServices: PublicService[] = [];
  let userEmail: string | undefined = undefined;
  let userBalanceCents = 0;

  if (isGuest && !initialServiceId) {
    const bundle = await getStorefrontGuestBundle(tenantId);
    catalog = bundle.catalog;
    settings = bundle.settings;
    baseUrl = bundle.baseUrl;
    targetCategoryId = bundle.defaultCategoryId;
    targetNetworkId = bundle.defaultNetworkId;
    initialServices = bundle.defaultServices;
  } else {
    const [catalogResult, fetchedSettings, session, fetchedBaseUrl] =
      await Promise.all([
        getPublicCatalogAction(tenantId),
        SettingsProvider.getContactAndLegalSettings(tenantId),
        isGuest ? Promise.resolve(null) : verifySession(),
        getBaseUrlAsync(),
      ]);

    catalog = catalogResult.success && catalogResult.data ? catalogResult.data : [];
    settings = fetchedSettings;
    baseUrl = fetchedBaseUrl;

    if (!targetCategoryId && catalog.length > 0) {
      const defaultNet = catalog.find((n) => n.slug === "telegram") || catalog[0];
      const defaultCat =
        defaultNet?.categories.find((c) =>
          c.name.toLowerCase().includes("подписчики")
        ) || defaultNet?.categories[0];
      targetCategoryId = defaultCat?.id;
      targetNetworkId = defaultNet?.id;
    }
    initialServices = targetCategoryId
      ? await getServicesByCategoryAction(targetCategoryId, tenantId)
      : [];

    if (session?.userId) {
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { email: true, balance: true },
      });
      if (user) {
        userEmail = user.email;
        userBalanceCents = Number(user.balance);
      }
    }
  }

  return {
    catalog,
    settings,
    baseUrl,
    targetCategoryId,
    targetNetworkId,
    initialServices,
    userEmail,
    userBalanceCents,
  };
}
