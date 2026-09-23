'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, RefreshCw } from 'lucide-react';
import {
  createProvider,
  updateProvider,
  probeProviderAction,
  getProviderCatalogPreviewAction,
  inferProviderSchema,
} from '@/actions/admin/providers/crud';
import type { ApiMappingDTO } from '@/services/admin/provider.service';
import type { ProviderProbeResult } from '@/services/admin/provider-diagnostic.service';
import {
  ProviderFormProps,
  ProviderFormData,
  MappingState,
  InferredSchema,
  PreviewService,
  IntegrationMode
} from './types';
import { ProviderCredentialsSection } from './sub/ProviderCredentialsSection';
import { ProviderMappingSection } from './sub/ProviderMappingSection';
import { ProviderPricingSection } from './sub/ProviderPricingSection';
import { ProviderCatalogPreviewModal } from './sub/ProviderCatalogPreviewModal';

export function ProviderForm({ initialData }: ProviderFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [inferLoading, setInferLoading] = useState(false);
  const [inferredSchema, setInferredSchema] = useState<InferredSchema | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [probeResult, setProbeResult] = useState<ProviderProbeResult | null>(null);

  // Modal preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewServices, setPreviewServices] = useState<PreviewService[]>([]);
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewTotal, setPreviewTotal] = useState(0);

  const [integrationMode, setIntegrationMode] = useState<IntegrationMode>(
    initialData?.mapping ? 'visual' : 'standard'
  );
  
  const [jsonText, setJsonText] = useState(
    initialData?.mapping ? JSON.stringify(initialData.mapping, null, 2) : 
    '{\n  "auth": {\n    "type": "body",\n    "field": "key"\n  },\n  "order": {\n    "serviceField": "service",\n    "linkField": "link",\n    "quantityField": "quantity"\n  },\n  "response": {\n    "orderIdField": "order",\n    "errorField": "error"\n  }\n}'
  );

  const [formData, setFormData] = useState<ProviderFormData>({
    name: initialData?.name || '',
    apiUrl: initialData?.apiUrl || '',
    apiKey: '', // always empty for security
    isActive: initialData?.isActive ?? true,
    balanceCurrency: initialData?.balanceCurrency || 'USD',
    ticketUrl: initialData?.ticketUrl || '',
  });

  const [mapping, setMapping] = useState<MappingState>({
    httpMethod: initialData?.mapping?.httpMethod || 'POST',
    contentType: initialData?.mapping?.contentType || 'form',
    authType: initialData?.mapping?.auth?.type || 'body',
    authField: initialData?.mapping?.auth?.field || 'key',
    authPrefix: initialData?.mapping?.auth?.prefix || '',
    serviceField: initialData?.mapping?.order?.serviceField || 'service',
    linkField: initialData?.mapping?.order?.linkField || 'link',
    quantityField: initialData?.mapping?.order?.quantityField || 'quantity',
    orderIdField: initialData?.mapping?.response?.orderIdField || 'order',
    errorField: initialData?.mapping?.response?.errorField || 'error',
    itemsPath: initialData?.mapping?.catalog?.itemsPath || '$',
    serviceIdField: initialData?.mapping?.catalog?.serviceIdField || 'service',
    nameField: initialData?.mapping?.catalog?.nameField || 'name',
    priceField: initialData?.mapping?.catalog?.priceField || 'rate',
    minField: initialData?.mapping?.catalog?.minField || 'min',
    maxField: initialData?.mapping?.catalog?.maxField || 'max',
    typeField: initialData?.mapping?.catalog?.typeField || 'category',
    descField: initialData?.mapping?.catalog?.descField || 'desc',
    balancePath: initialData?.mapping?.balance?.balancePath || 'balance',
    currencyPath: initialData?.mapping?.balance?.currencyPath || 'currency',
  });

  function handleModeChange(mode: IntegrationMode) {
    if (mode === 'json' && integrationMode === 'visual') {
      const payload = getVisualPayload();
      setJsonText(JSON.stringify(payload, null, 2));
    } else if (mode === 'visual' && integrationMode === 'json') {
      try {
        const p = JSON.parse(jsonText);
        setMapping(prev => ({
          ...prev,
          httpMethod: p?.httpMethod || prev.httpMethod,
          contentType: p?.contentType || prev.contentType,
          authType: p?.auth?.type || prev.authType,
          authField: p?.auth?.field || prev.authField,
          authPrefix: p?.auth?.prefix || '',
          serviceField: p?.order?.serviceField || prev.serviceField,
          linkField: p?.order?.linkField || prev.linkField,
          quantityField: p?.order?.quantityField || prev.quantityField,
          orderIdField: p?.response?.orderIdField || prev.orderIdField,
          errorField: p?.response?.errorField || prev.errorField,
        }));
      } catch {
        // Invalid JSON ignored
      }
    }
    setIntegrationMode(mode);
  }

  function getVisualPayload(): ApiMappingDTO {
    return {
      httpMethod: mapping.httpMethod,
      contentType: mapping.contentType,
      auth: { type: mapping.authType, field: mapping.authField, prefix: mapping.authPrefix || undefined },
      order: { serviceField: mapping.serviceField, linkField: mapping.linkField, quantityField: mapping.quantityField },
      response: { orderIdField: mapping.orderIdField, errorField: mapping.errorField },
      catalog: {
        itemsPath: mapping.itemsPath,
        serviceIdField: mapping.serviceField,
        nameField: mapping.nameField,
        priceField: mapping.priceField,
        minField: mapping.minField,
        maxField: mapping.maxField,
        typeField: mapping.typeField,
        descField: mapping.descField
      },
      balance: { balancePath: mapping.balancePath, currencyPath: mapping.currencyPath }
    };
  }

  function getMappingPayload(): ApiMappingDTO | null {
    if (integrationMode === 'visual') return getVisualPayload();
    if (integrationMode === 'json') {
      try { return JSON.parse(jsonText); } catch { return null; }
    }
    return null;
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  function handleMappingChange(field: keyof MappingState, value: string) {
    setMapping(prev => ({ ...prev, [field]: value }));
  }

  function handleUrlBlur() {
    let val = (formData.apiUrl || '').trim().replace(/[\r\n\t]/g, '');
    if (val && !val.startsWith('http://') && !val.startsWith('https://')) val = 'https://' + val;
    val = val.replace(/\/+$/, '');
    if (val !== formData.apiUrl) setFormData(prev => ({ ...prev, apiUrl: val }));
  }

  function handleKeyBlur() {
    const clean = (formData.apiKey || '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[\r\n\t]/g, '').trim();
    if (clean !== formData.apiKey) setFormData(prev => ({ ...prev, apiKey: clean }));
  }

  async function handleDeepProbe() {
    setCheckLoading(true);
    setProbeResult(null);
    handleUrlBlur();
    handleKeyBlur();

    try {
      const res = await probeProviderAction({
        providerId: initialData?.id,
        apiUrl: formData.apiUrl,
        apiKey: formData.apiKey,
        mapping: getMappingPayload(),
      });

      if ('error' in res && typeof res.error === 'string') {
        toast.error(res.error || 'Ошибка доступа');
        setProbeResult({
          success: false,
          sanitizedUrl: formData.apiUrl,
          sanitizedKey: formData.apiKey,
          latencyMs: 0,
          balanceSuccess: false,
          servicesSuccess: false,
          errorMessage: res.error,
        });
        return;
      }

      const probeData = res as ProviderProbeResult;
      setProbeResult(probeData);
      if (probeData.success) {
        toast.success(`Соединение успешно! Баланс: ${probeData.balance} ${probeData.detectedCurrency || ''}`);
        if (probeData.detectedCurrency && probeData.detectedCurrency !== formData.balanceCurrency) {
          setFormData(prev => ({ ...prev, balanceCurrency: probeData.detectedCurrency! }));
        }
      } else {
        toast.error(probeData.errorMessage || 'Ошибка подключения');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Ошибка проверки');
    } finally {
      setCheckLoading(false);
    }
  }

  async function handleOpenPreview() {
    setIsPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const res = await getProviderCatalogPreviewAction({
        providerId: initialData?.id,
        apiUrl: formData.apiUrl,
        apiKey: formData.apiKey,
        mapping: getMappingPayload(),
      });
      if (res.success && res.services) {
        setPreviewServices(res.services);
        setPreviewTotal(res.total || res.services.length);
      } else {
        toast.error(res.error || 'Не удалось загрузить каталог');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Ошибка загрузки каталога');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleInferSchema() {
    if (!formData.apiUrl || (!formData.apiKey && !initialData?.hasApiKey)) {
      toast.error('API URL и API Ключ обязательны для тестирования');
      return;
    }
    setInferLoading(true);
    try {
      const res = await inferProviderSchema(
        formData.apiUrl, formData.apiKey, mapping.httpMethod, mapping.contentType,
        { type: mapping.authType, field: mapping.authField, prefix: mapping.authPrefix },
        initialData?.id
      );
      if (res.success && res.schema) {
        setInferredSchema({
          catalogKeys: res.schema.catalog.keys,
          balanceKeys: res.schema.balance.keys,
          itemsPath: res.schema.catalog.itemsPath
        });
        setMapping(prev => ({ ...prev, itemsPath: res.schema.catalog.itemsPath }));
        toast.success(`Найдено ${res.schema.catalog.keys.length} полей в каталоге`);
      }
    } catch {
      toast.error('Ошибка анализа структуры');
    } finally {
      setInferLoading(false);
    }
  }

  async function handleSave() {
    setLoading(true);
    setFieldErrors({});

    if (!initialData && !formData.apiKey) {
      setFieldErrors(prev => ({ ...prev, apiKey: ['API Ключ обязателен при создании провайдера.'] }));
      toast.error('Проверьте обязательные поля.');
      setLoading(false);
      return;
    }

    const mappingPayload = getMappingPayload();
    if (integrationMode === 'json' && !mappingPayload) {
      setFieldErrors(prev => ({ ...prev, jsonMapping: ['Неверный JSON формат.'] }));
      toast.error('Неверный JSON формат.');
      setLoading(false);
      return;
    }

    const payload = {
      name: formData.name,
      apiUrl: formData.apiUrl,
      apiKey: formData.apiKey,
      isActive: formData.isActive,
      balanceCurrency: formData.balanceCurrency,
      mapping: mappingPayload,
      ticketUrl: formData.ticketUrl,
    };

    try {
      const res = initialData ? await updateProvider(initialData.id, payload) : await createProvider(payload);
      if (res && !res.success) {
        if ('errors' in res && res.errors) {
          setFieldErrors(res.errors as Record<string, string[]>);
          toast.error('Ошибка валидации данных.');
        } else if ('error' in res && res.error) {
          toast.error(res.error);
        }
        return;
      }
      toast.success(initialData ? 'Настройки провайдера сохранены.' : 'Провайдер успешно добавлен.');
      if (initialData) router.refresh();
      else router.push('/admin/providers');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl font-extrabold text-foreground">
            {initialData ? `Редактирование: ${initialData.name}` : 'Новое подключение'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Конфигурация интеграции внешнего провайдера услуг
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenPreview}
            disabled={previewLoading || !formData.apiUrl || (!formData.apiKey && !initialData?.hasApiKey)}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition-all duration-200 disabled:opacity-40 flex items-center gap-2"
          >
            {previewLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
            <span>Предпросмотр каталога</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/providers')}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Сохранение...' : initialData ? 'Сохранить' : 'Создать подключение'}
          </button>
        </div>
      </div>

      {/* Modular CDD Sections (all <= 200 lines) */}
      <ProviderCredentialsSection
        formData={formData}
        isEditMode={!!initialData}
        hasApiKey={initialData?.hasApiKey}
        checkLoading={checkLoading}
        probeResult={probeResult}
        fieldErrors={fieldErrors}
        onChange={handleFormChange}
        onUrlBlur={handleUrlBlur}
        onKeyBlur={handleKeyBlur}
        onDeepProbe={handleDeepProbe}
        onApplySuggestedUrl={(url) => setFormData(prev => ({ ...prev, apiUrl: url }))}
      />

      <ProviderMappingSection
        integrationMode={integrationMode}
        mapping={mapping}
        jsonText={jsonText}
        inferLoading={inferLoading}
        inferredSchema={inferredSchema}
        onModeChange={handleModeChange}
        onMappingChange={handleMappingChange}
        onJsonChange={setJsonText}
        onInferSchema={handleInferSchema}
        onApplyCatalogKey={(field, k) => handleMappingChange(field, k)}
      />

      <ProviderPricingSection
        formData={formData}
        onChange={handleFormChange}
      />

      <ProviderCatalogPreviewModal
        isOpen={isPreviewOpen}
        loading={previewLoading}
        services={previewServices}
        total={previewTotal}
        search={previewSearch}
        currency={formData.balanceCurrency}
        onSearchChange={setPreviewSearch}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  );
}
