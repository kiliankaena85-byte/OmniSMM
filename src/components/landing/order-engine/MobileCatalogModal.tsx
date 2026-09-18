'use client';
// audit-disable STR-002

import React, { useState, useMemo, useEffect } from "react";
import { PublicNetwork, PublicService, getServicesByCategoryAction } from "@/actions/order/catalog";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { CategoryIcon, cleanCategoryName } from "@/components/ui/CategoryIcon";
import { TariffCard } from "./TariffCard";
import { ArrowLeft, X, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getBrandStyles } from "@/utils/brand-styles";

interface MobileCatalogModalProps {
  catalog: PublicNetwork[];
  selectedService: PublicService | null;
  onSelect: (srv: PublicService, categoryId: string, networkId: string) => void;
  onClose: () => void;
}

export function MobileCatalogModal({
  catalog,
  selectedService,
  onSelect,
  onClose,
}: MobileCatalogModalProps) {
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [services, setServices] = useState<PublicService[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");

  const selectedNetwork = useMemo(() => {
    return catalog.find((n) => n.id === networkId) || null;
  }, [catalog, networkId]);

  const selectedCategory = useMemo(() => {
    if (!selectedNetwork) return null;
    return selectedNetwork.categories.find((c) => c.id === categoryId) || null;
  }, [selectedNetwork, categoryId]);

  // Brand style based on selected social network
  const brandStyle = useMemo(() => {
    if (!selectedNetwork) return undefined;
    return getBrandStyles(selectedNetwork.slug);
  }, [selectedNetwork]);

  // Body scroll lock & Escape key handler
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Fetch services when category is selected
  useEffect(() => {
    if (categoryId) {
      setIsLoadingServices(true);
      setServices([]);
      getServicesByCategoryAction(categoryId)
        .then((res) => {
          setServices(res);
        })
        .catch((err) => {
          console.error("Failed to fetch services in mobile modal:", err);
        })
        .finally(() => {
          setIsLoadingServices(false);
        });
    } else {
      setServices([]);
    }
  }, [categoryId]);

  // Filter networks based on search query
  const filteredCatalog = useMemo(() => {
    if (!searchQuery) return catalog;
    const query = searchQuery.toLowerCase();
    return catalog.filter(
      (n) =>
        n.name.toLowerCase().includes(query) ||
        n.slug.toLowerCase().includes(query)
    );
  }, [catalog, searchQuery]);

  // Filter services based on serviceQuery (supports name, description, and numericId e.g. #101, 101)
  const filteredServices = useMemo(() => {
    if (!serviceQuery) return services;
    const query = serviceQuery.toLowerCase();
    const normalizedNumeric = query.replace(/^[#№\s]+/, '').replace(/^id[\s:]*/i, '').trim();
    return services.filter(
      (srv) =>
        (normalizedNumeric && String(srv.numericId).includes(normalizedNumeric)) ||
        srv.name.toLowerCase().includes(query) ||
        (srv.description && srv.description.toLowerCase().includes(query))
    );
  }, [services, serviceQuery]);

  // Handle service selection
  const handleSelectService = (srv: PublicService) => {
    if (categoryId && networkId) {
      onSelect(srv, categoryId, networkId);
    }
  };

  const currentStep = categoryId ? 3 : networkId ? 2 : 1;

  const handleBack = () => {
    if (categoryId) {
      setCategoryId(null);
      setServiceQuery("");
    } else if (networkId) {
      setNetworkId(null);
      setSearchQuery("");
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setServiceQuery("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border/50 px-4 py-3 flex items-center gap-3 shrink-0">
        {currentStep > 1 ? (
          <button
            type="button"
            onClick={handleBack}
            className="p-2 -ml-2 rounded-xl hover:bg-muted active:scale-95 transition-all h-11 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Назад"
          >
            <ArrowLeft className="w-5 h-5 text-foreground shrink-0" />
          </button>
        ) : null}
        
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-foreground text-base truncate min-w-0">
            {currentStep === 1
              ? "Каталог услуг"
              : currentStep === 2
              ? selectedNetwork?.name
              : selectedCategory?.name}
          </h2>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-none mt-0.5">
            {currentStep === 1
              ? "Выберите соцсеть"
              : currentStep === 2
              ? "Выберите категорию"
              : `${filteredServices.length} ${filteredServices.length === 1 ? "тариф" : filteredServices.length < 5 && filteredServices.length > 0 ? "тарифа" : "тарифов"}`}
          </p>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="p-2 -mr-2 rounded-xl hover:bg-muted active:scale-95 transition-all h-11 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
          aria-label="Закрыть"
        >
          <X className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {/* Network Search Bar (Only on Step 1) */}
      {currentStep === 1 && (
        <div className="px-4 py-2 border-b border-border/30 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск соцсети..."
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-border bg-content2 text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary focus:ring-2 ring-primary/20 transition-all"
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <AnimatePresence mode="wait">
          {currentStep === 1 ? (
            /* STEP 1: Networks grid */
            <motion.div
              key="step-networks"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-3 gap-3"
            >
              {filteredCatalog.map((net) => (
                <button
                  key={net.id}
                  type="button"
                  onClick={() => setNetworkId(net.id)}
                  className="flex flex-col items-center justify-center gap-2 p-3 bg-card border border-border/50 rounded-2xl hover:bg-content2 active:scale-95 transition-all cursor-pointer min-h-[90px]"
                >
                  <SocialIcon slug={net.slug} size={28} colored />
                  <span className="text-[10px] font-bold text-foreground text-center line-clamp-1">
                    {net.name}
                  </span>
                </button>
              ))}
              {filteredCatalog.length === 0 && (
                <div className="col-span-3 py-12 text-center text-sm text-muted-foreground font-semibold">
                  Ничего не найдено
                </div>
              )}
            </motion.div>
          ) : currentStep === 2 ? (
            /* STEP 2: Categories list */
            <motion.div
              key="step-categories"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              {selectedNetwork?.categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className="w-full flex items-center gap-3 p-4 bg-card border border-border/50 rounded-2xl hover:bg-content2 active:scale-[0.99] transition-all cursor-pointer text-left min-h-[52px]"
                >
                  <div className="w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
                    <CategoryIcon name={cat.name} size={16} />
                  </div>
                  <span className="text-xs font-bold text-foreground truncate min-w-0">
                    {cleanCategoryName(cat.name)}
                  </span>
                </button>
              ))}
            </motion.div>
          ) : (
            /* STEP 3: Tariffs (Services) list */
            <motion.div
              key="step-services"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {/* Service Search Input */}
              <div className="sticky top-0 z-10 bg-background pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                  <input
                    type="text"
                    value={serviceQuery}
                    onChange={(e) => setServiceQuery(e.target.value)}
                    placeholder="Быстрый поиск тарифа..."
                    className="w-full h-10 pl-9 pr-4 rounded-xl border border-border bg-content2 text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary focus:ring-2 ring-primary/20 transition-all"
                  />
                </div>
              </div>

              {isLoadingServices ? (
                /* Shimmer loading list */
                Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-full p-4 rounded-2xl border border-border/50 bg-card animate-pulse"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-3">
                        <div className="h-4 w-1/4 rounded bg-muted/30" />
                        <div className="h-4 w-3/4 rounded bg-muted/30" />
                        <div className="h-3 w-1/2 rounded bg-muted/20" />
                      </div>
                      <div className="text-right space-y-1">
                        <div className="h-6 w-14 rounded bg-muted/30" />
                      </div>
                    </div>
                  </div>
                ))
              ) : filteredServices.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground font-semibold">
                  {serviceQuery ? "Тарифы не найдены" : "В этой категории пока нет активных тарифов."}
                </div>
              ) : (
                filteredServices.map((srv) => (
                  <TariffCard
                    key={srv.id}
                    service={srv}
                    isSelected={selectedService?.id === srv.id}
                    onSelect={handleSelectService}
                    compact={true}
                    brandStyle={brandStyle}
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
