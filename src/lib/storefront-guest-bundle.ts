import { getPublicCatalogAction, getServicesByCategoryAction, type PublicNetwork, type PublicService } from "@/actions/order/catalog";
import { getBaseUrlAsync } from "@/utils/get-base-url";
import { SettingsProvider, type ContactAndLegalSettings } from "@/lib/settings";
import { getCachedGuestBundleWithRedis } from "@/services/catalog/catalog-cache.service";

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
