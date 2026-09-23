'use client';

import { Table } from '@/components/admin/hero-ui';
import { Pencil, Trash2, Plus } from "lucide-react";
import { SocialIcon } from '@/components/ui/SocialIcon';
import { UniversalIcon } from '@/components/ui/UniversalIcon';
import { cleanCategoryName } from '@/components/ui/CategoryIcon';
import { NetworkItem, CategoryItem } from './types';

interface CategoryTableProps {
  networks: NetworkItem[];
  filteredCategories: CategoryItem[];
  selectedNetworkFilter: string;
  searchQuery: string;
  currentTenantLabel: string;
  onAddCategory: (networkId?: string) => void;
  onEditCategory: (category: CategoryItem) => void;
  onDeleteCategory: (category: CategoryItem) => void;
}

export function CategoryTable({
  networks,
  filteredCategories,
  selectedNetworkFilter,
  searchQuery,
  currentTenantLabel,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
}: CategoryTableProps) {
  const visibleNetworks = networks.filter(
    net => selectedNetworkFilter === "ALL" || net.id === selectedNetworkFilter
  );

  return (
    <div className="space-y-4">
      {visibleNetworks.map(net => {
        const netCategories = filteredCategories.filter(c => c.networkId === net.id);
        if (netCategories.length === 0 && (searchQuery || selectedNetworkFilter !== "ALL")) {
          return null;
        }

        return (
          <div key={net.id} className="bg-card shadow-sm border border-border rounded-2xl overflow-hidden w-full transition-all">
            {/* Network Section Header */}
            <div className="p-3.5 px-4 border-b border-border/60 bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <SocialIcon slug={net.slug} size={18} />
                <span className="text-xs font-black text-foreground uppercase tracking-wide">
                  {net.name}
                </span>
                <span className="text-[11px] font-mono font-bold text-muted-foreground bg-background px-2 py-0.5 rounded-md border border-border/50">
                  {netCategories.length} {netCategories.length === 1 ? 'категория' : netCategories.length < 5 ? 'категории' : 'категорий'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-muted-foreground font-mono font-bold">
                  Всего услуг: {netCategories.reduce((acc, cat) => acc + (cat._count?.services || 0), 0)}
                </span>
                <button
                  type="button"
                  onClick={() => onAddCategory(net.id)}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Добавить категорию
                </button>
              </div>
            </div>

            {netCategories.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                В этой соцсети пока нет категорий. Нажмите «Добавить категорию», чтобы создать первую.
              </div>
            ) : (
              <Table aria-label={`Категории ${net.name}`} className="w-full text-left">
                <Table.ScrollContainer>
                  <Table.Content>
                    <Table.Header>
                      <Table.Column isRowHeader className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                        НАЗВАНИЕ КАТЕГОРИИ
                      </Table.Column>
                      <Table.Column className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider py-2.5">
                        SLUG
                      </Table.Column>
                      <Table.Column className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider py-2.5 text-center">
                        СОРТИРОВКА
                      </Table.Column>
                      <Table.Column className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider py-2.5 text-center">
                        АКТИВНЫХ УСЛУГ
                      </Table.Column>
                      <Table.Column className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider py-2.5">
                        ТЕГИ АНАЛИЗАТОРА
                      </Table.Column>
                      <Table.Column className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider text-right px-4 py-2.5">
                        ДЕЙСТВИЯ
                      </Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {netCategories.map((c) => {
                        const tenantCount = c.tenantServicesCount ?? c._count?.services ?? 0;
                        const globalCount = c.globalServicesCount ?? c._count?.services ?? 0;
                        const isTrulyEmpty = globalCount === 0;

                        return (
                          <Table.Row key={c.id} className="hover:bg-muted/30 transition-colors duration-150 border-b border-border/40">
                            <Table.Cell className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-muted/60 border border-border/50 flex items-center justify-center shrink-0 text-foreground">
                                  <UniversalIcon icon={c.icon || c.network?.icon || `brand:${net.slug}`} size={16} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-foreground text-xs truncate">{cleanCategoryName(c.name)}</span>
                                  {c.requireWarning && (
                                    <span className="text-[10px] text-amber-500 font-medium truncate max-w-xs" title={c.warningMessage || ''}>
                                      ⚠️ {c.warningMessage}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </Table.Cell>
                            <Table.Cell className="py-3">
                              <span className="text-muted-foreground text-xs font-mono bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
                                {c.slug}
                              </span>
                            </Table.Cell>
                            <Table.Cell className="py-3 text-center">
                              <span className="text-muted-foreground text-xs font-mono font-bold">{c.sort}</span>
                            </Table.Cell>
                            <Table.Cell className="py-3 text-center">
                              {tenantCount > 0 ? (
                                <span 
                                  className="text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md"
                                  title={
                                    globalCount > tenantCount
                                      ? `${tenantCount} активных на ${currentTenantLabel}, всего ${globalCount} по всем проектам`
                                      : undefined
                                  }
                                >
                                  {tenantCount}
                                </span>
                              ) : globalCount > 0 ? (
                                <span 
                                  className="text-[10px] font-mono font-bold bg-sky-500/10 text-sky-500 border border-sky-500/25 px-2 py-0.5 rounded-md"
                                  title={c.otherTenantsLabel || `Категория содержит ${globalCount} услуг в других проектах или архиве`}
                                >
                                  {c.otherTenantsLabel || `В других проектах (${globalCount})`}
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono font-bold bg-destructive/10 text-destructive border border-destructive/25 px-2 py-0.5 rounded-md">
                                  0 (пустая)
                                </span>
                              )}
                            </Table.Cell>
                            <Table.Cell className="py-3">
                              {c.analyzerTags ? (
                                <div className="flex flex-wrap gap-1">
                                  {c.analyzerTags.split(',').map(tag => (
                                    <span key={tag} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/60">
                                      {tag.trim()}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground italic">По умолчанию</span>
                              )}
                            </Table.Cell>
                            <Table.Cell className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onEditCategory(c)}
                                  title="Редактировать категорию"
                                  className="p-1.5 rounded-lg border border-border/60 hover:border-primary/50 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-150 cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteCategory(c)}
                                  title={
                                    isTrulyEmpty
                                      ? "Удалить пустую категорию"
                                      : tenantCount === 0
                                        ? `Категория содержит ${globalCount} услуг в других проектах или архиве`
                                        : "Удалить категорию"
                                  }
                                  className={`p-1.5 rounded-lg border transition-all duration-150 cursor-pointer ${
                                    isTrulyEmpty
                                      ? "border-destructive/40 text-destructive bg-destructive/10 hover:bg-destructive/20 hover:border-destructive"
                                      : "border-border/60 hover:border-destructive/50 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  }`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            )}
          </div>
        );
      })}
    </div>
  );
}
