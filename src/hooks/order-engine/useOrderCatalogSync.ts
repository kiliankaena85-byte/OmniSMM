'use client';

import { useState, useEffect, useRef } from 'react';
import {
  getServicesByCategoryAction,
  PublicNetwork,
  PublicCategory,
  PublicService,
  getPublicCatalogAction,
  getFreshServiceAction,
} from '@/actions/order/catalog';
import { isLinkServiceCompatible } from '@/constants/link-service-compatibility';
import { resolveServiceTargetType } from '@/utils/target-type-mapper';
import { sortCategories } from './category-demand-sorter';
import { toast } from 'sonner';

interface UseOrderCatalogSyncOptions {
  sortedInitialCatalog: PublicNetwork[];
  initialNetworkId: string;
  initialCategoryId: string;
  initialServiceId: string;
  initialServices: PublicService[];
  defaultCat: PublicCategory | null;
  setNetworkId: React.Dispatch<React.SetStateAction<string>>;
  categoryId: string;
  setCategoryId: React.Dispatch<React.SetStateAction<string>>;
  selectedServiceRef: React.MutableRefObject<PublicService | null>;
  setSelectedService: React.Dispatch<React.SetStateAction<PublicService | null>>;
  detectedType: string | null;
  url: string;
  onResetDrip?: () => void;
}

export function useOrderCatalogSync({
  sortedInitialCatalog,
  initialNetworkId,
  initialCategoryId,
  initialServiceId,
  initialServices,
  defaultCat,
  setNetworkId,
  categoryId,
  setCategoryId,
  selectedServiceRef,
  setSelectedService,
  detectedType,
  url,
  onResetDrip,
}: UseOrderCatalogSyncOptions) {
  const [catalog, setCatalog] = useState<PublicNetwork[]>(sortedInitialCatalog);
  const [services, setServices] = useState<PublicService[]>(initialServices);
  const [isServicesLoading, setIsServicesLoading] = useState(false);

  const isInitialServicesMount = useRef(initialServices.length > 0);
  const serviceRequestIdRef = useRef(0);
  const hasFetchedCatalog = useRef(false);
  const categoryServicesCache = useRef<Record<string, PublicService[]>>(
    initialCategoryId && initialServices.length > 0 ? { [initialCategoryId]: initialServices } : {}
  );

  // Initial Catalog Load
  useEffect(() => {
    if (catalog.length === 0 && !hasFetchedCatalog.current) {
      hasFetchedCatalog.current = true;
      getPublicCatalogAction().then((res) => {
        if (res.success && res.data) {
          const sortedData = res.data.map((net) => ({
            ...net,
            categories: sortCategories(net.categories),
          }));
          setCatalog(sortedData);
          setNetworkId((current: string) => {
            if (!current && sortedData.length > 0) {
              if (initialNetworkId) {
                if (initialCategoryId) setCategoryId(initialCategoryId);
                return initialNetworkId;
              }
              const defNet = sortedData.find((n: PublicNetwork) => n.slug === 'telegram') || sortedData[0];
              if (defNet) {
                const defCatItem =
                  defNet.categories.find((c: PublicCategory) => c.name.toLowerCase().includes('подписчики')) ||
                  defNet.categories[0];
                if (defCatItem) setCategoryId(defCatItem.id);
                return defNet.id;
              }
            }
            return current;
          });
        }
      });
    } else if (catalog.length > 0 && initialNetworkId && !hasFetchedCatalog.current) {
      hasFetchedCatalog.current = true;
      setNetworkId(initialNetworkId);
      if (initialCategoryId) setCategoryId(initialCategoryId);
    }
  }, [catalog.length, initialNetworkId, initialCategoryId, setNetworkId, setCategoryId]);

  // Load Services when Category changes
  useEffect(() => {
    if (isInitialServicesMount.current && categoryId === defaultCat?.id && initialServices.length > 0) {
      isInitialServicesMount.current = false;
      categoryServicesCache.current[categoryId] = initialServices;
      if (initialServiceId && !selectedServiceRef.current) {
        const found = initialServices.find((s) => s.id === initialServiceId);
        if (found) setSelectedService(found);
      }
      return;
    }
    isInitialServicesMount.current = false;

    if (!categoryId) {
      setServices([]);
      if (!selectedServiceRef.current) setSelectedService(null);
      setIsServicesLoading(false);
      onResetDrip?.();
      return;
    }

    const isLinkFilled = Boolean(url && url.trim().length >= 5);
    const cachedSvcs = categoryServicesCache.current[categoryId];
    if (cachedSvcs && cachedSvcs.length > 0) {
      let finalSvcs = cachedSvcs;
      if (detectedType && isLinkFilled && !selectedServiceRef.current) {
        finalSvcs = cachedSvcs.filter((s) => isLinkServiceCompatible(detectedType, resolveServiceTargetType(s)));
      }
      setServices(finalSvcs);
      setIsServicesLoading(false);
      if (initialServiceId && !selectedServiceRef.current) {
        const found = finalSvcs.find((s) => s.id === initialServiceId);
        if (found) setSelectedService(found);
      }
      return;
    }

    setServices([]);
    if (!selectedServiceRef.current) setSelectedService(null);
    const currentRequestId = ++serviceRequestIdRef.current;

    const loadServices = async () => {
      setIsServicesLoading(true);
      try {
        const svcs = await getServicesByCategoryAction(categoryId);
        if (currentRequestId !== serviceRequestIdRef.current) return;

        const sortedSvcs = [...svcs].sort((a, b) => {
          const aQuarantined = a.cooldownUntil && new Date(a.cooldownUntil) > new Date();
          const bQuarantined = b.cooldownUntil && new Date(b.cooldownUntil) > new Date();
          if (aQuarantined && !bQuarantined) return 1;
          if (!aQuarantined && bQuarantined) return -1;
          return 0;
        });

        categoryServicesCache.current[categoryId] = sortedSvcs;
        let finalSvcs = sortedSvcs;
        if (detectedType && isLinkFilled && !selectedServiceRef.current) {
          finalSvcs = sortedSvcs.filter((s) => isLinkServiceCompatible(detectedType, resolveServiceTargetType(s)));
        }

        setServices(finalSvcs);
        if (initialServiceId && !selectedServiceRef.current) {
          const found = finalSvcs.find((s) => s.id === initialServiceId);
          if (found) setSelectedService(found);
        } else if (!selectedServiceRef.current) {
          setSelectedService(null);
        }
      } catch (err) {
        if (currentRequestId !== serviceRequestIdRef.current) return;
        console.error('Failed to load services:', err);
        setServices([]);
        if (!selectedServiceRef.current) setSelectedService(null);
        toast.error('Не удалось загрузить услуги. Проверьте подключение к сети.');
      } finally {
        if (currentRequestId === serviceRequestIdRef.current) {
          setIsServicesLoading(false);
        }
      }
    };

    loadServices();
  }, [
    categoryId,
    defaultCat?.id,
    initialServiceId,
    initialServices,
    detectedType,
    url.trim().length >= 5,
    onResetDrip,
    selectedServiceRef,
    setSelectedService,
  ]);

  // Live Sync on focus & visibilitychange
  useEffect(() => {
    const handleSync = () => {
      if (selectedServiceRef.current?.id) {
        getFreshServiceAction(selectedServiceRef.current.id)
          .then((fresh) => {
            if (fresh) {
              setSelectedService((prev) => {
                if (!prev || prev.id !== fresh.id) return prev;
                if (
                  prev.pricePerUnitRub !== fresh.pricePerUnitRub ||
                  prev.minQty !== fresh.minQty ||
                  prev.maxQty !== fresh.maxQty ||
                  prev.description !== fresh.description ||
                  prev.name !== fresh.name ||
                  prev.isActive !== fresh.isActive
                ) {
                  return fresh;
                }
                return prev;
              });
            }
          })
          .catch(() => {});
      }
    };

    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);
    return () => {
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
    };
  }, [selectedServiceRef, setSelectedService]);

  return {
    catalog,
    setCatalog,
    services,
    setServices,
    isServicesLoading,
    categoryServicesCache,
  };
}
