'use client';

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { deleteCategory, cleanupEmptyCategoriesAction } from "@/actions/admin/catalog/categories";
import { toast } from "sonner";
import { Plus, Globe, GitMerge, Trash2, Search } from "lucide-react";
import { Button } from '@/components/ui/button';
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { SocialIcon } from '@/components/ui/SocialIcon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

import { CategoryItem, NetworkItem } from './sub/types';
import { CategoryEditModal } from './sub/CategoryEditModal';
import { NetworkEditModal } from './sub/NetworkEditModal';
import { CategoryMergeModal } from './sub/CategoryMergeModal';
import { CategoryTable } from './sub/CategoryTable';

export type { NetworkItem, CategoryItem };

export function CategoryManager({ 
  categories, 
  networks,
  currentTenant = 'smmplan'
}: { 
  categories: CategoryItem[]; 
  networks: NetworkItem[]; 
  currentTenant?: string;
}) {
  const router = useRouter();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNetworkFilter, setSelectedNetworkFilter] = useState("ALL");
  const [emptyFilter, setEmptyFilter] = useState<'ALL' | 'WITH_SERVICES' | 'OTHER_TENANTS' | 'EMPTY'>('ALL');

  // Modals state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [networkModalOpen, setNetworkModalOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [cleanupConfirmOpen, setCleanupConfirmOpen] = useState(false);

  // Edit category target & initial network
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [initialNetworkId, setInitialNetworkId] = useState<string | undefined>(undefined);

  // Delete Category State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryItem | null>(null);
  const [catLoading, setCatLoading] = useState(false);
  const [isCleanupPending, startCleanupTransition] = useTransition();

  const currentTenantLabel = useMemo(() => {
    if (currentTenant === 'flux') return 'SMMflux';
    if (currentTenant === 'smmplan') return 'SMMplan';
    if (currentTenant === 'all') return 'Все проекты';
    return currentTenant;
  }, [currentTenant]);

  // Truly empty categories (0 services globally across all tenants/archive)
  const trulyEmptyCategoriesCount = useMemo(() => {
    return categories.filter(c => (c.globalServicesCount ?? c._count?.services ?? 0) === 0).length;
  }, [categories]);

  const selectedNetworkTrulyEmptyCount = useMemo(() => {
    if (selectedNetworkFilter === 'ALL') return trulyEmptyCategoriesCount;
    return categories.filter(c => 
      c.networkId === selectedNetworkFilter && 
      (c.globalServicesCount ?? c._count?.services ?? 0) === 0
    ).length;
  }, [categories, selectedNetworkFilter, trulyEmptyCategoriesCount]);

  const activeTrulyEmptyCount = useMemo(() => {
    return selectedNetworkFilter === 'ALL' ? trulyEmptyCategoriesCount : selectedNetworkTrulyEmptyCount;
  }, [selectedNetworkFilter, trulyEmptyCategoriesCount, selectedNetworkTrulyEmptyCount]);

  const otherTenantsCategoriesCount = useMemo(() => {
    return categories.filter(c => 
      (c.tenantServicesCount ?? c._count?.services ?? 0) === 0 && 
      (c.globalServicesCount ?? 0) > 0
    ).length;
  }, [categories]);

  const withServicesCount = useMemo(() => {
    return categories.filter(c => (c.tenantServicesCount ?? c._count?.services ?? 0) > 0).length;
  }, [categories]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter(c => {
      const matchNetwork = selectedNetworkFilter === "ALL" || c.networkId === selectedNetworkFilter;
      const tenantCount = c.tenantServicesCount ?? c._count?.services ?? 0;
      const globalCount = c.globalServicesCount ?? c._count?.services ?? 0;

      let matchEmpty = true;
      if (emptyFilter === 'WITH_SERVICES') {
        matchEmpty = tenantCount > 0;
      } else if (emptyFilter === 'OTHER_TENANTS') {
        matchEmpty = tenantCount === 0 && globalCount > 0;
      } else if (emptyFilter === 'EMPTY') {
        matchEmpty = globalCount === 0;
      }

      const matchQuery = !searchQuery.trim() || 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.network?.name && c.network.name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchNetwork && matchEmpty && matchQuery;
    });
  }, [categories, selectedNetworkFilter, emptyFilter, searchQuery]);

  const openNewCategoryModal = (networkId?: string) => {
    setEditingCategory(null);
    setInitialNetworkId(networkId || (selectedNetworkFilter !== "ALL" ? selectedNetworkFilter : undefined));
    setCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setInitialNetworkId(undefined);
    setCategoryModalOpen(true);
  };

  const confirmDeleteCategory = (cat: CategoryItem) => {
    setCategoryToDelete(cat);
    setDeleteConfirmOpen(true);
  };

  const executeDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      setCatLoading(true);
      const res = await deleteCategory(categoryToDelete.id);
      if (!res.success) throw new Error(res.error);
      toast.success("Категория успешно удалена");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ошибка удаления";
      toast.error(msg);
    } finally {
      setCatLoading(false);
      setDeleteConfirmOpen(false);
      setCategoryToDelete(null);
    }
  };

  const executeCleanupEmpty = () => {
    startCleanupTransition(async () => {
      const targetNet = selectedNetworkFilter !== "ALL" ? selectedNetworkFilter : null;
      const res = await cleanupEmptyCategoriesAction(targetNet);
      if (res.success) {
        toast.success(res.message);
        setCleanupConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Ошибка при очистке пустых категорий");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* ─── Consolidated Action & Stats Bar ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/70 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg border border-border/50">
            {networks.length} соцсетей · {categories.length} категорий
          </span>
          {trulyEmptyCategoriesCount > 0 && (
            <span className="text-xs font-mono font-bold text-destructive bg-destructive/10 px-2.5 py-1 rounded-lg border border-destructive/25">
              Без услуг: {trulyEmptyCategoriesCount}
            </span>
          )}
          {otherTenantsCategoriesCount > 0 && (
            <span 
              className="text-xs font-mono font-bold text-sky-500 bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/25"
              title={
                currentTenant === 'all'
                  ? 'Категории, содержащие только скрытые или архивные услуги'
                  : `Категории без активных услуг на ${currentTenantLabel}, но содержащие услуги в других проектах или архиве`
              }
            >
              {currentTenant === 'all' ? `Скрытые / архив: ${otherTenantsCategoriesCount}` : `В других проектах: ${otherTenantsCategoriesCount}`}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTrulyEmptyCount > 0 && (
            <Button
              intent="destructive"
              size="sm"
              onClick={() => setCleanupConfirmOpen(true)}
              className="font-bold h-8.5 bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Очистить пустые ({selectedNetworkFilter !== 'ALL' ? `${activeTrulyEmptyCount} в сети` : activeTrulyEmptyCount})
            </Button>
          )}

          <Button
            intent="outline"
            size="sm"
            onClick={() => setMergeModalOpen(true)}
            className="font-bold h-8.5 bg-background text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <GitMerge className="w-3.5 h-3.5 mr-1.5" />
            Объединить
          </Button>

          <Button
            intent="outline"
            size="sm"
            onClick={() => setNetworkModalOpen(true)}
            className="font-bold h-8.5 bg-background text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 mr-1.5" />
            Соцсети ({networks.length})
          </Button>

          <Button
            intent="primary"
            size="sm"
            onClick={() => openNewCategoryModal()}
            className="font-bold h-8.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Добавить категорию
          </Button>
        </div>
      </div>

      {/* ─── Filter & Search Bar ─── */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-card p-3 rounded-xl border border-border/70 shadow-2xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Поиск по категории или соцсети..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-8.5 pl-9 pr-3 text-xs rounded-lg border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <div className="w-full sm:w-56">
          <Select value={selectedNetworkFilter} onValueChange={val => setSelectedNetworkFilter(val || 'ALL')}>
            <SelectTrigger className="w-full h-8.5 border border-border bg-background text-foreground text-xs rounded-lg cursor-pointer px-3">
              <SelectValue placeholder="Все соцсети">
                {(value: string) => {
                  if (value === 'ALL') return 'Все соцсети';
                  return networks.find(n => n.id === value)?.name ?? value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" label="Все соцсети" className="text-xs cursor-pointer">Все соцсети</SelectItem>
              {networks.map(n => (
                <SelectItem key={n.id} value={n.id} label={n.name} className="text-xs cursor-pointer">
                  <span className="flex items-center gap-2">
                    <SocialIcon slug={n.slug} size={14} />
                    {n.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-xl border border-border/50 text-xs">
          <button
            onClick={() => setEmptyFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
              emptyFilter === 'ALL' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Все ({categories.length})
          </button>
          <button
            onClick={() => setEmptyFilter('WITH_SERVICES')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
              emptyFilter === 'WITH_SERVICES' ? 'bg-background text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            С услугами ({withServicesCount})
          </button>
          {otherTenantsCategoriesCount > 0 && (
            <button
              onClick={() => setEmptyFilter('OTHER_TENANTS')}
              title={
                currentTenant === 'all'
                  ? 'Категории, содержащие только скрытые или архивные услуги'
                  : `Категории без активных услуг на ${currentTenantLabel}, но содержащие услуги в других проектах или архиве`
              }
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
                emptyFilter === 'OTHER_TENANTS' ? 'bg-sky-500/15 text-sky-500 font-black shadow-xs' : 'text-muted-foreground hover:text-sky-500'
              }`}
            >
              {currentTenant === 'all' ? `Скрытые / архив (${otherTenantsCategoriesCount})` : `В других проектах (${otherTenantsCategoriesCount})`}
            </button>
          )}
          {trulyEmptyCategoriesCount > 0 && (
            <button
              onClick={() => setEmptyFilter('EMPTY')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
                emptyFilter === 'EMPTY' ? 'bg-destructive/15 text-destructive font-black shadow-xs' : 'text-muted-foreground hover:text-destructive'
              }`}
            >
              Пустые ({trulyEmptyCategoriesCount})
            </button>
          )}
        </div>

        {(searchQuery || selectedNetworkFilter !== "ALL" || emptyFilter !== "ALL") && (
          <button
            onClick={() => { setSearchQuery(""); setSelectedNetworkFilter("ALL"); setEmptyFilter("ALL"); }}
            className="text-xs text-muted-foreground hover:text-foreground font-semibold px-2 py-1 cursor-pointer transition-colors"
          >
            Сбросить
          </button>
        )}
      </div>

      {/* ─── Full-Width Grouped Tables by Social Network ─── */}
      <CategoryTable
        networks={networks}
        filteredCategories={filteredCategories}
        selectedNetworkFilter={selectedNetworkFilter}
        searchQuery={searchQuery}
        currentTenantLabel={currentTenantLabel}
        onAddCategory={openNewCategoryModal}
        onEditCategory={openEditCategoryModal}
        onDeleteCategory={confirmDeleteCategory}
      />

      {/* ─── Modals ─── */}
      <CategoryEditModal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        editingCategory={editingCategory}
        initialNetworkId={initialNetworkId}
        networks={networks}
        categories={categories}
      />

      <NetworkEditModal
        isOpen={networkModalOpen}
        onClose={() => setNetworkModalOpen(false)}
        networks={networks}
      />

      <CategoryMergeModal
        isOpen={mergeModalOpen}
        onClose={() => setMergeModalOpen(false)}
        categories={categories}
      />

      {/* Delete Category Confirm Modal */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={executeDeleteCategory}
        title="Удаление категории"
        isDanger={true}
        confirmText="Удалить"
        cancelText="Отмена"
      >
        {categoryToDelete && (categoryToDelete.globalServicesCount ?? categoryToDelete._count?.services ?? 0) > 0 ? (
          <div className="space-y-2 text-xs">
            <p className="text-foreground">
              Категория «<strong>{categoryToDelete.name}</strong>» содержит{" "}
              <strong className="text-destructive">
                {categoryToDelete.globalServicesCount ?? categoryToDelete._count?.services}
              </strong>{" "}
              услуг ({categoryToDelete.otherTenantsLabel || "активных, скрытых или в других проектах"}).
            </p>
            <p className="text-muted-foreground">
              Прямое удаление невозможно. Чтобы удалить эту категорию, сначала объедините её с другой категорией или удалите все её услуги.
            </p>
          </div>
        ) : (
          <span>
            Вы действительно хотите удалить категорию «{categoryToDelete?.name}»? Это действие необратимо.
          </span>
        )}
      </ConfirmModal>

      {/* Bulk Cleanup Empty Categories Confirm Modal */}
      <ConfirmModal
        isOpen={cleanupConfirmOpen}
        onClose={() => setCleanupConfirmOpen(false)}
        onConfirm={executeCleanupEmpty}
        title="Очистка пустых категорий"
        isDanger={true}
        confirmText={isCleanupPending ? "Удаление..." : "Удалить пустые"}
        cancelText="Отмена"
      >
        {selectedNetworkFilter !== 'ALL' ? (
          <span>
            Вы действительно хотите удалить <strong>{activeTrulyEmptyCount}</strong> пустых категорий без услуг в выбранной соцсети? Это действие необратимо.
          </span>
        ) : (
          <span>
            Вы действительно хотите удалить все <strong>{activeTrulyEmptyCount}</strong> пустых категорий без услуг по всему каталогу? Это действие необратимо.
          </span>
        )}
      </ConfirmModal>
    </div>
  );
}
