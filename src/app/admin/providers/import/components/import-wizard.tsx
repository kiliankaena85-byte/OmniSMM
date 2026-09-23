'use client';

import React, { useMemo } from 'react';
import type { CategoryItem, ProviderItem } from '../types';
import { ServicesTable } from './services-table';
import { SummaryDashboard } from './summary-dashboard';
import { ConfirmationModal } from './confirmation-modal';
import { ImportReportCard } from './import-report-card';
import { useImportWizardState } from './wizard/useImportWizardState';
import { WizardProviderHeader } from './wizard/WizardProviderHeader';
import { WizardWarningBanners } from './wizard/WizardWarningBanners';
import { WizardBulkToolbar } from './wizard/WizardBulkToolbar';
import { WizardFilterDrawer } from './wizard/WizardFilterDrawer';
import { WizardPlatformTabs } from './wizard/WizardPlatformTabs';
import { EmptyCacheCard } from './wizard/EmptyCacheCard';
import { computeMarkupMultiplier, checkIsFiltersActive, groupCategoriesByNetwork } from './wizard/types';

interface ImportWizardProps {
  categories: CategoryItem[];
  providers: ProviderItem[];
}

export function ImportWizard({ categories: initialCategories, providers }: ImportWizardProps) {
  const {
    localCategories, handleCategoryCreated,
    providerId, handleProviderChange,
    services, loading, syncing, isEmptyCache, error, success, setError, setSuccess, setSuccessWithTimer,
    selectedIds, toggleSelection, toggleAll,
    handleSelectAllFiltered, selectingAllFiltered,
    selectedCategories, setSelectedCategories, autoMappedCategories, aiConfidence,
    bulkCategory, setBulkCategory, handleApplyBulkCategory, missingCategoryIds, setMissingCategoryIds,
    markup, setMarkup, targetTenant, setTargetTenant, activeTab, setActiveTab,
    filters, setFilters, localSearch, setLocalSearch, resetFilters,
    pagination, platformCounts, providerCategories, importProgress,
    showConfirmModal, setShowConfirmModal, showFilters, setShowFilters, importReport, setImportReport,
    mixedTypeWarnings, setMixedTypeWarnings, showMixedTypeWarning, setShowMixedTypeWarning,
    readyServices, attentionServices, platformBreakdown, incompatibleIds, handleExcludeIncompatible,
    handleSyncCache, handleStartImport, handleConfirmImport,
  } = useImportWizardState(initialCategories, providers);

  const categoriesByNetwork = useMemo(() => groupCategoriesByNetwork(localCategories), [localCategories]);
  const isFiltersActive = useMemo(() => checkIsFiltersActive(filters), [filters]);

  const handleAssignMissingToBulk = () => {
    const ids = Array.from(missingCategoryIds);
    const catName = localCategories.find((c) => c.id === bulkCategory)?.name || 'выбранная категория';
    setSelectedCategories((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = bulkCategory; });
      return next;
    });
    setMissingCategoryIds(new Set());
    setError(null);
    setSuccessWithTimer(`Категория «${catName}» назначена ${ids.length} нераспределённым услугам.`);
  };

  return (
    <div className="flex flex-col gap-6">
      <WizardProviderHeader
        providers={providers}
        providerId={providerId}
        onProviderChange={handleProviderChange}
      />

      <SummaryDashboard
        totalInCache={pagination.total}
        newServices={services.filter((s) => !s.alreadyImported).length}
        aiReady={readyServices.length}
        needsAttention={attentionServices.length}
        alreadyImported={services.filter((s) => s.alreadyImported).length}
        selectedCount={selectedIds.size}
        markup={markup}
        onMarkupChange={setMarkup}
        onImport={handleStartImport}
        onResync={handleSyncCache}
        importDisabled={selectedIds.size === 0 || syncing}
        syncing={syncing}
        importProgress={importProgress}
        providerName={providers.find((p) => p.id === providerId)?.name || ''}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <WizardWarningBanners
        error={error}
        onClearError={() => setError(null)}
        success={success}
        onClearSuccess={() => setSuccess(null)}
        missingCategoryIds={missingCategoryIds}
        bulkCategory={bulkCategory}
        localCategories={localCategories}
        onAssignMissingToBulk={handleAssignMissingToBulk}
        showMixedTypeWarning={showMixedTypeWarning}
        mixedTypeWarnings={mixedTypeWarnings}
        onProceedMixedImport={() => {
          setShowMixedTypeWarning(false);
          setMixedTypeWarnings([]);
          handleStartImport();
        }}
        onCancelMixedImport={() => {
          setShowMixedTypeWarning(false);
          setMixedTypeWarnings([]);
        }}
      />

      {importReport && (
        <ImportReportCard report={importReport} onClose={() => setImportReport(null)} />
      )}

      <div className="flex flex-col gap-4">
        <WizardBulkToolbar
          localSearch={localSearch}
          setLocalSearch={setLocalSearch}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          isFiltersActive={isFiltersActive}
          resetFilters={resetFilters}
          incompatibleCount={incompatibleIds.size}
          handleSelectAllFiltered={handleSelectAllFiltered}
          selectingAllFiltered={selectingAllFiltered}
          loading={loading}
          bulkCategory={bulkCategory}
          setBulkCategory={setBulkCategory}
          localCategories={localCategories}
          categoriesByNetwork={categoriesByNetwork}
          handleApplyBulkCategory={handleApplyBulkCategory}
          selectedCount={selectedIds.size}
          totalServicesCount={services.length}
        />

        <WizardFilterDrawer
          showFilters={showFilters}
          onClose={() => setShowFilters(false)}
          filters={filters}
          setFilters={setFilters}
          providerCategories={providerCategories}
        />

        <WizardPlatformTabs
          platformCounts={platformCounts}
          selectedPlatform={filters.platform}
          onSelectPlatform={(platformId) => setFilters((prev) => ({ ...prev, platform: platformId, page: 1 }))}
        />

        {isEmptyCache ? (
          <EmptyCacheCard syncing={syncing} onSync={handleSyncCache} />
        ) : (
          <ServicesTable
            services={activeTab === 'ready' ? readyServices : attentionServices}
            selectedIds={selectedIds}
            toggleSelection={toggleSelection}
            toggleAll={toggleAll}
            loading={loading}
            filters={filters}
            setFilters={setFilters}
            pagination={pagination}
            markup={computeMarkupMultiplier(markup)}
            isAutoMarkup={parseFloat(markup) === 0}
            categories={localCategories}
            categoriesByNetwork={categoriesByNetwork}
            selectedCategories={selectedCategories}
            onCategoryCreated={handleCategoryCreated}
            onCategoryChange={(svcId, catId) => {
              setSelectedCategories((prev) => ({ ...prev, [svcId]: catId }));
              setMissingCategoryIds((prev) => {
                const next = new Set(prev);
                next.delete(svcId);
                return next;
              });
            }}
            autoMappedCategories={autoMappedCategories}
            aiConfidence={aiConfidence}
            showCategoryColumn={true}
            validationErrors={missingCategoryIds}
          />
        )}
      </div>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmImport}
        selectedCount={selectedIds.size}
        markup={parseFloat(markup) ?? 0}
        platformBreakdown={platformBreakdown}
        isPending={loading || syncing}
        targetTenant={targetTenant}
        onTargetTenantChange={setTargetTenant}
        incompatibleCount={incompatibleIds.size}
        onExcludeIncompatible={handleExcludeIncompatible}
      />
    </div>
  );
}
