'use client';

import { useState, useEffect, useTransition } from 'react';
import { Modal } from '@heroui/react';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { fetchPaginatedExternalServices } from '@/actions/admin/providers/import-cherry-pick';
import { toast } from 'sonner';

interface ProviderServiceSearchModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string | null;
    onSelect: (service: unknown) => void;
}

export function ProviderServiceSearchModal({
  isOpen,
  onOpenChange,
  providerId,
  onSelect,
}: ProviderServiceSearchModalProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
    const [services, setServices] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();

  // Debounce query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 400);
    return () => clearTimeout(handler);
  }, [query]);

  // Fetch when modal opens, provider changes, or debounced query changes
  useEffect(() => {
    if (!isOpen || !providerId || providerId === 'none') {
      setServices([]);
      return;
    }

    startTransition(async () => {
      try {
        const filters = {
          page: 1,
          pageSize: 20,
          platform: 'ALL',
          geo: 'ALL',
          velocity: 'ALL',
          hasRefill: false,
          hasAnomaly: false,
          importStatus: 'ALL',
          search: debouncedQuery,
          sortBy: 'none',
          category: 'ALL',
          retailReady: false,
          providerCategory: 'ALL',
          minPrice: '',
          maxPrice: '',
        };

                const res = await fetchPaginatedExternalServices(providerId, filters, 1, 20);
        
        if (res.success && res.data) {
          setServices(res.data);
        } else if ('emptyCache' in res && res.emptyCache) {
          toast.error(res.error || 'Кэш провайдера пуст. Сначала синхронизируйте его в разделе "Провайдеры".');
          setServices([]);
        } else {
          setServices([]);
        }
      } catch (e) {
        console.error('Search external services error:', e);
        toast.error('Не удалось загрузить услуги провайдера');
        setServices([]);
      }
    });
  }, [isOpen, providerId, debouncedQuery]);

    const handleSelect = (service: unknown) => {
    onSelect(service);
    onOpenChange(false);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop variant="blur" />
      <Modal.Container size="lg" className="bg-card border border-border/40 shadow-2xl rounded-2xl max-w-3xl w-full">
        <Modal.Dialog>
          <Modal.Header className="flex flex-col gap-1 border-b border-border/50 bg-muted/20 p-4">
            <h2 className="text-xl font-extrabold text-foreground tracking-tight">Поиск в API провайдера</h2>
            <p className="text-xs text-muted-foreground font-normal">Найдите услугу в кэше провайдера, чтобы автоматически заполнить форму.</p>
          </Modal.Header>
          <Modal.Body className="p-0">
            <div className="p-4 border-b border-border/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Поиск по ID или названию..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                />
                {isPending && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                )}
              </div>
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2 space-y-1">
              {!isPending && services.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">Ничего не найдено</p>
                </div>
              )}
              
              {services.map((service) => (
                <div 
                  key={service.service} 
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border/50 group"
                  onClick={() => handleSelect(service)}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground group-hover:text-foreground transition-colors">
                        ID: {service.service}
                      </span>
                      {service.category && (
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80 truncate">
                          {service.category}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{service.name}</p>
                  </div>
                  
                  <div className="flex items-center gap-4 text-right flex-shrink-0">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-bold text-primary">
                        {service.rateRub ? parseFloat(service.rateRub).toFixed(2) : parseFloat(service.rate || 0).toFixed(2)} ₽ <span className="text-xs text-muted-foreground font-normal">/ 1k</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Мин: {service.min || 0} / Макс: {service.max || 0}
                      </span>
                    </div>
                    <Button size="sm" intent="outline" className="hidden group-hover:flex">
                      Выбрать
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Modal.Body>
          <Modal.Footer className="border-t border-border/50 bg-muted/20 p-4 flex justify-end">
            <Button intent="ghost" onClick={() => onOpenChange(false)}>
              Закрыть
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal>
  );
}
