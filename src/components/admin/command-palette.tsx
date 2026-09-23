'use client';

import * as React from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { globalOmniSearch, SearchHit } from '@/actions/admin/search';
import { useEffect, useState, useTransition } from 'react';
import { Search, Loader2 } from 'lucide-react';

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [isPending, startTransition] = useTransition();

  // Handle hotkeys (CMD+K / CTRL+K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    
    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const results = await globalOmniSearch(query);
          setHits(results);
        } catch (e) {
          console.error('OmniSearch error', e);
        }
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const onSelectHit = (href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-[15vh] p-4 animate-in fade-in duration-200">
      {/* Background click to close */}
      <div className="absolute inset-0" onClick={() => setOpen(false)} />
      
      <div className="relative w-full max-w-2xl bg-card/95 backdrop-blur-md rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden border border-border/50 animate-in zoom-in-95 duration-200">
        <Command label="Global Search" onKeyDown={(e) => {
           if (e.key === 'Escape') setOpen(false);
        }}>
          <div className="flex items-center px-4 py-4 border-b border-border/50 bg-background/50">
             <Search className="w-5 h-5 text-primary mr-3 animate-pulse" />
             <Command.Input 
               autoFocus
               placeholder="Поиск по клиентам, заказам, или услугам (⌘K)..." 
               value={query}
               onValueChange={setQuery}
               className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/70 font-medium text-lg"
             />
             {isPending && <Loader2 className="w-5 h-5 text-primary animate-spin ml-2" />}
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto p-2 scrollbar-hide">
            <Command.Empty className="p-8 text-center text-sm text-muted-foreground">
              <div className="flex flex-col items-center justify-center gap-2 opacity-60">
                <Search className="w-8 h-8 mb-2" />
                {query.length < 2 ? 'Введите минимум 2 символа для поиска...' : 'По вашему запросу ничего не найдено.'}
              </div>
            </Command.Empty>

            {hits.length > 0 && (
              <Command.Group heading="Результаты" className="text-xs font-black uppercase tracking-widest text-muted-foreground px-3 py-2 mb-2">
                {hits.map((hit) => (
                  <Command.Item 
                    key={hit.id} 
                    value={hit.title + hit.subtitle} // for internal filtering
                    onSelect={() => onSelectHit(hit.href)}
                    className="flex flex-col gap-1 px-4 py-3 mb-1 rounded-xl cursor-pointer transition-all duration-200 aria-selected:bg-primary/10 aria-selected:text-primary aria-selected:scale-[1.01] hover:bg-muted/50"
                  >
                    <span className="font-bold text-foreground aria-selected:text-primary flex items-center gap-2">
                      {hit.type === 'USER' && '👤'}
                      {hit.type === 'ORDER' && '📦'}
                      {hit.type === 'SERVICE' && '⚡'}
                      {hit.title}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">{hit.subtitle}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Quick Actions Example */}
            {!query && (
               <Command.Group heading="Быстрые действия" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">
                 <Command.Item onSelect={() => onSelectHit('/admin/orders')} className="px-4 py-3 mb-1 rounded-xl cursor-pointer transition-all duration-200 aria-selected:bg-muted hover:bg-muted/50 font-medium flex items-center gap-2">
                   📦 Перейти к Заказам
                 </Command.Item>
                 <Command.Item onSelect={() => onSelectHit('/admin/providers')} className="px-4 py-3 mb-1 rounded-xl cursor-pointer transition-all duration-200 aria-selected:bg-muted hover:bg-muted/50 font-medium flex items-center gap-2">
                   🔗 Управление Провайдерами
                 </Command.Item>
                 <Command.Item onSelect={() => onSelectHit('/admin/settings?tab=team')} className="px-4 py-3 mb-1 rounded-xl cursor-pointer transition-all duration-200 aria-selected:bg-muted hover:bg-muted/50 font-medium flex items-center gap-2">
                   ⚙️ Настройки системы
                 </Command.Item>
               </Command.Group>
            )}
          </Command.List>
        </Command>
        
        <div className="bg-muted/30 border-t border-border/50 p-3 px-5 flex justify-between items-center text-[11px] text-muted-foreground font-medium">
           <span className="flex items-center gap-2">
             Используйте <kbd className="px-2 py-0.5 rounded bg-background border border-border shadow-sm">↓</kbd> <kbd className="px-2 py-0.5 rounded bg-background border border-border shadow-sm">↑</kbd> для навигации
           </span>
           <span className="flex items-center gap-2">
             <kbd className="px-2 py-0.5 rounded bg-background border border-border shadow-sm text-primary">Enter</kbd> открыть
             <kbd className="px-2 py-0.5 rounded bg-background border border-border shadow-sm">Esc</kbd> закрыть
           </span>
        </div>
      </div>
    </div>
  );
}
