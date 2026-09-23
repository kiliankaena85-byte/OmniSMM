'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Plus, Check, X, Layers, ChevronDown, Loader2 } from 'lucide-react';
import type { CategoryItem } from '../types';
import { createCategory } from '@/actions/admin/catalog/categories';
import { toast } from 'sonner';

interface SearchableCategorySelectProps {
  value: string;
  onChange: (categoryId: string) => void;
  categories: CategoryItem[];
  categoriesByNetwork: { network: string; items: CategoryItem[] }[];
  onCategoryCreated?: (newCategory: CategoryItem) => void;
  suggestedPlatform?: string | null;
  suggestedName?: string | null;
  isMobile?: boolean;
  hasError?: boolean;
  disabled?: boolean;
}

const networkIcons: Record<string, string> = {
  INSTAGRAM: '📸',
  TELEGRAM: '✈️',
  VK: '💙',
  VKONTAKTE: '💙',
  YOUTUBE: '▶️',
  TIKTOK: '🎵',
  TWITTER: '𝕏',
  DZEN: '📰',
  FACEBOOK: '👥',
  DISCORD: '🎮',
  TWITCH: '🟣',
  RUTUBE: '🔴',
  PINTEREST: '📌',
  THREADS: '🧵',
};

export function SearchableCategorySelect({
  value,
  onChange,
  categories,
  categoriesByNetwork,
  onCategoryCreated,
  suggestedPlatform,
  suggestedName,
  isMobile = false,
  hasError = false,
  disabled = false,
}: SearchableCategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeNetworkFilter, setActiveNetworkFilter] = useState<string>('ALL');
  const [isCreating, setIsCreating] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatNetworkId, setNewCatNetworkId] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Selected Category item
  const selectedCat = useMemo(() => {
    return categories.find((c) => c.id === value);
  }, [categories, value]);

  // Unique networks list
  const networksList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; slug: string }>();
    categories.forEach((c) => {
      if (c.network?.name) {
        map.set(c.network.name, {
          id: c.network.id || c.networkId || '',
          name: c.network.name,
          slug: c.network.slug || c.network.name.toLowerCase(),
        });
      }
    });
    return Array.from(map.values());
  }, [categories]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input on open
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Filtered categories
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result: { network: string; items: CategoryItem[] }[] = [];

    for (const group of categoriesByNetwork) {
      if (activeNetworkFilter !== 'ALL' && group.network !== activeNetworkFilter) {
        continue;
      }

      const matchingItems = group.items.filter((c) => {
        if (!q) return true;
        const nameMatch = c.name.toLowerCase().includes(q);
        const netMatch = group.network.toLowerCase().includes(q);
        return nameMatch || netMatch;
      });

      if (matchingItems.length > 0) {
        result.push({
          network: group.network,
          items: matchingItems,
        });
      }
    }

    return result;
  }, [categoriesByNetwork, search, activeNetworkFilter]);

  // Open creation modal with smart prefill
  const openCreateDialog = (initialName?: string) => {
    // Find network matching suggested platform
    const platformSlug = (suggestedPlatform || '').toUpperCase();
    const matchedNet = networksList.find(
      (n) => n.slug.toUpperCase() === platformSlug || n.name.toUpperCase().includes(platformSlug)
    );

    setNewCatNetworkId(matchedNet?.id || networksList[0]?.id || '');
    setNewCatName(initialName || search || suggestedName || '');
    setIsCreating(true);
  };

  // Execute category creation
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !newCatNetworkId) {
      toast.error('Укажите название категории и выберите соцсеть');
      return;
    }

    setCreateLoading(true);
    try {
      const res = await createCategory({
        name: newCatName.trim(),
        networkId: newCatNetworkId,
        sort: 0,
        tenantId: 'all',
      });

      if (!res.success || !res.categoryId || !res.category) {
        toast.error(res.error || 'Не удалось создать категорию');
        return;
      }

      const createdCat: CategoryItem = {
        id: res.category.id,
        name: res.category.name,
        networkId: res.category.networkId,
        network: networksList.find((n) => n.id === res.category.networkId) || {
          name: 'Соцсеть',
          slug: 'social',
        },
      };

      onCategoryCreated?.(createdCat);
      onChange(createdCat.id);
      setIsCreating(false);
      setIsOpen(false);
      setSearch('');
      toast.success(`Категория «${createdCat.name}» создана и выбрана!`);
    } catch {
      toast.error('Произошла ошибка при создании категории');
    } finally {
      setCreateLoading(false);
    }
  };

  const getNetIcon = (netName?: string) => {
    if (!netName) return '🌐';
    const upper = netName.toUpperCase();
    for (const [key, icon] of Object.entries(networkIcons)) {
      if (upper.includes(key)) return icon;
    }
    return '🌐';
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* ── Trigger Button ── */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-1.5 text-left rounded-lg border transition-all cursor-pointer select-none ${
          isMobile ? 'h-10 px-3 text-xs' : 'h-9 px-2 py-1 text-xs'
        } ${
          hasError
            ? 'border-destructive ring-1 ring-destructive bg-destructive/5 text-destructive'
            : selectedCat
            ? 'border-border bg-background hover:bg-muted/50 text-foreground'
            : 'border-border/80 bg-background hover:bg-muted/40 text-muted-foreground'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="truncate flex items-center gap-1.5 min-w-0 font-medium">
          {selectedCat ? (
            <>
              <span className="shrink-0">{getNetIcon(selectedCat.network?.name)}</span>
              <span className="text-muted-foreground font-normal shrink-0">
                {selectedCat.network?.name || 'Соцсеть'} •
              </span>
              <span className="font-semibold truncate text-foreground">{selectedCat.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{isMobile ? 'Выберите категорию...' : 'Выберите категорию'}</span>
          )}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* ── Dropdown Popover ── */}
      {isOpen && (
        <div
          className={`absolute left-0 top-full mt-1.5 z-50 bg-popover text-popover-foreground border border-border/80 rounded-xl shadow-xl backdrop-blur-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 ${
            isMobile ? 'w-[90vw] max-w-[380px]' : 'w-[280px] sm:w-[320px]'
          }`}
        >
          {/* 🔍 Search Input */}
          <div className="p-2 border-b border-border/60 bg-muted/20">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-muted-foreground pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск категории..."
                className="w-full h-8 pl-8 pr-7 text-xs rounded-lg border border-border/70 bg-background focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Network Filters */}
            {networksList.length > 1 && (
              <div className="flex items-center gap-1 mt-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveNetworkFilter('ALL')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    activeNetworkFilter === 'ALL'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Все
                </button>
                {networksList.slice(0, 6).map((net) => (
                  <button
                    key={net.name}
                    type="button"
                    onClick={() => setActiveNetworkFilter(net.name)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                      activeNetworkFilter === net.name
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{getNetIcon(net.name)}</span>
                    <span>{net.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 📋 Filtered Categories List */}
          <div className="max-h-56 overflow-y-auto p-1 divide-y divide-border/30">
            {filteredGroups.length === 0 ? (
              <div className="py-4 px-3 text-center text-xs text-muted-foreground">
                <p>Категорий не найдено</p>
                {search && (
                  <button
                    type="button"
                    onClick={() => openCreateDialog(search)}
                    className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Создать «{search}»
                  </button>
                )}
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.network} className="py-1">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <span>{getNetIcon(group.network)}</span>
                    <span>{group.network}</span>
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((cat) => {
                      const isSelected = cat.id === value;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            onChange(cat.id);
                            setIsOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer text-left ${
                            isSelected
                              ? 'bg-primary/15 text-primary font-bold'
                              : 'hover:bg-muted text-foreground'
                          }`}
                        >
                          <span className="truncate">{cat.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ➕ Bottom Action: Add Category Button */}
          <div className="p-1.5 border-t border-border/60 bg-muted/20">
            <button
              type="button"
              onClick={() => openCreateDialog()}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg border border-primary/20 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Создать категорию</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Quick Create Category ── */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm bg-card text-card-foreground border border-border/80 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Новая категория</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="p-4 space-y-3.5">
              {/* Network Select */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Социальная сеть
                </label>
                <select
                  value={newCatNetworkId}
                  onChange={(e) => setNewCatNetworkId(e.target.value)}
                  className="w-full h-9 px-2 text-xs rounded-lg border border-border bg-background focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary text-foreground"
                >
                  {networksList.map((net) => (
                    <option key={net.id} value={net.id}>
                      {getNetIcon(net.name)} {net.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Название категории
                </label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Например: Опросы / Голоса"
                  required
                  autoFocus
                  className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  disabled={createLoading}
                  className="px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-lg border border-border bg-background cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={createLoading || !newCatName.trim() || !newCatNetworkId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {createLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Создать и выбрать</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
