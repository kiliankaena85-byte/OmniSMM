'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Layers,
  RefreshCw,
  Zap,
  Sparkles,
  Search,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  createProvider,
  updateProvider,
  checkProviderConnection,
  probeProviderAction,
  getProviderCatalogPreviewAction,
  inferProviderSchema,
} from '@/actions/admin/providers/crud';
import type { ApiMappingDTO, ProviderDetailDTO } from '@/services/admin/provider.service';
import type { ProviderProbeResult } from '@/services/admin/provider-diagnostic.service';

interface ProviderFormProps {
  /** If provided — edit mode. DTO-safe: never includes raw apiKey. */
  initialData?: ProviderDetailDTO;
}

// Input classes reused across all form controls
const inputCls =
  'block w-full rounded-lg border border-border bg-background text-foreground ' +
  'text-base md:text-sm p-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ' +
  'placeholder:text-muted-foreground transition-all duration-200';

const labelCls = 'block text-sm font-medium text-foreground mb-1';

type HttpMethod = 'POST' | 'GET';
type ContentType = 'form' | 'json';
type AuthType = 'body' | 'query' | 'header';
type IntegrationMode = 'standard' | 'visual' | 'json';

interface MappingState {
  httpMethod: 'POST' | 'GET';
  contentType: 'form' | 'json';
  authType: 'body' | 'query' | 'header';
  authField: string;
  authPrefix: string;
  serviceField: string;
  linkField: string;
  quantityField: string;
  orderIdField: string;
  errorField: string;
  itemsPath: string;
  serviceIdField: string;
  nameField: string;
  priceField: string;
  minField: string;
  maxField: string;
  typeField: string;
  descField: string;
  balancePath: string;
  currencyPath: string;
}

interface InferredSchema {
  catalogKeys: string[];
  balanceKeys: string[];
  itemsPath: string;
}

interface PreviewService {
  service: string | number;
  name: string;
  rate: number | string;
  min?: number | string;
  max?: number | string;
  category?: string;
  description?: string;
  type?: string;
  [key: string]: unknown;
}

export function ProviderForm({ initialData }: ProviderFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [inferLoading, setInferLoading] = useState(false);
  const [inferredSchema, setInferredSchema] = useState<InferredSchema | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const isInitiallyCustom = !!initialData?.mapping;

  const [integrationMode, setIntegrationMode] = useState<IntegrationMode>(
     isInitiallyCustom ? 'visual' : 'standard'
  );
  
  const [jsonText, setJsonText] = useState(
     initialData?.mapping ? JSON.stringify(initialData.mapping, null, 2) : '{\n  "auth": {\n    "type": "body",\n    "field": "key"\n  },\n  "order": {\n    "serviceField": "service",\n    "linkField": "link",\n    "quantityField": "quantity"\n  },\n  "response": {\n    "orderIdField": "order",\n    "errorField": "error"\n  }\n}'
  );

  const [formData, setFormData] = useState({
    name:            initialData?.name           || '',
    apiUrl:          initialData?.apiUrl          || '',
    apiKey:          '',   // always empty — only set when explicitly changing
    isActive:        initialData?.isActive        ?? true,
    balanceCurrency: initialData?.balanceCurrency || 'USD',
    ticketUrl:       initialData?.ticketUrl       || '',
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
    // Data-Driven fields
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
        const payload = {
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
          balance: {
            balancePath: mapping.balancePath,
            currencyPath: mapping.currencyPath
          }
        };
        setJsonText(JSON.stringify(payload, null, 2));
     } else if (mode === 'visual' && integrationMode === 'json') {
        try {
           const parsed = JSON.parse(jsonText);
           setMapping({
             httpMethod: parsed?.httpMethod || 'POST',
             contentType: parsed?.contentType || 'form',
             authType: parsed?.auth?.type || 'body',
             authField: parsed?.auth?.field || 'key',
             authPrefix: parsed?.auth?.prefix || '',
             serviceField: parsed?.order?.serviceField || 'service',
             linkField: parsed?.order?.linkField || 'link',
             quantityField: parsed?.order?.quantityField || 'quantity',
             orderIdField: parsed?.response?.orderIdField || 'order',
             errorField: parsed?.response?.errorField || 'error',
             itemsPath: parsed?.catalog?.itemsPath || '$',
             serviceIdField: parsed?.catalog?.serviceIdField || 'service',
             nameField: parsed?.catalog?.nameField || 'name',
             priceField: parsed?.catalog?.priceField || 'rate',
             minField: parsed?.catalog?.minField || 'min',
             maxField: parsed?.catalog?.maxField || 'max',
             typeField: parsed?.catalog?.typeField || 'category',
             descField: parsed?.catalog?.descField || 'desc',
             balancePath: parsed?.balance?.balancePath || 'balance',
             currencyPath: parsed?.balance?.currencyPath || 'currency',
           });
        } catch {
           // Invalid JSON, ignore
        }
     }
     setIntegrationMode(mode);
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  function getMappingPayload(): ApiMappingDTO | null {
    if (integrationMode === 'visual') {
      return {
        httpMethod: mapping.httpMethod,
        contentType: mapping.contentType,
        auth: {
          type: mapping.authType,
          field: mapping.authField,
          prefix: mapping.authPrefix || undefined
        },
        order: {
          serviceField: mapping.serviceField,
          linkField: mapping.linkField,
          quantityField: mapping.quantityField
        },
        response: {
          orderIdField: mapping.orderIdField,
          errorField: mapping.errorField
        },
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
        balance: {
          balancePath: mapping.balancePath,
          currencyPath: mapping.currencyPath
        }
      };
    } else if (integrationMode === 'json') {
      try {
        return JSON.parse(jsonText) as ApiMappingDTO;
      } catch {
        return null;
      }
    }
    return null;
  }

  async function handleSave() {
    try {
      setLoading(true);
      setFieldErrors({});

      if (!initialData && !formData.apiKey) {
        setFieldErrors(prev => ({ ...prev, apiKey: ['API Ключ обязателен при создании провайдера.'] }));
        toast.error('Проверьте заполнение обязательных полей.');
        return;
      }

      const mappingPayload = getMappingPayload();
      if (integrationMode === 'json' && !mappingPayload) {
        setFieldErrors(prev => ({ ...prev, jsonMapping: ['JSON маппинг имеет неверный формат. Проверьте синтаксис.'] }));
        throw new Error("JSON маппинг имеет неверный формат. Проверьте синтаксис.");
      }

      const payload = {
        name:            formData.name,
        apiUrl:          formData.apiUrl,
        apiKey:          formData.apiKey,
        isActive:        formData.isActive,
        balanceCurrency: formData.balanceCurrency,
        mapping:         mappingPayload,
        ticketUrl:       formData.ticketUrl,
      };

      let res;
      if (initialData) {
        res = await updateProvider(initialData.id, payload);
      } else {
        res = await createProvider(payload);
      }

      if (res && !res.success) {
        if ('errors' in res && res.errors) {
          setFieldErrors(res.errors as Record<string, string[]>);
          toast.error('Ошибка валидации данных провайдера. Проверьте заполненные поля.');
          
          // Auto scroll to first error field
          const firstErrorField = Object.keys(res.errors)[0];
          if (firstErrorField) {
            const element = document.getElementsByName(firstErrorField)[0] || document.getElementById(`provider-${firstErrorField}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              (element as HTMLElement).focus();
            }
          }
        } else if ('error' in res && res.error) {
          toast.error(res.error);
        }
        return;
      }

      if (initialData) {
        toast.success('Настройки провайдера сохранены.');
        router.refresh();
      } else {
        toast.success('Провайдер успешно добавлен.');
        router.push('/admin/providers');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Неизвестная ошибка';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const [probeResult, setProbeResult] = useState<ProviderProbeResult | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewServices, setPreviewServices] = useState<PreviewService[]>([]);
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewTotal, setPreviewTotal] = useState(0);

  function handleUrlBlur() {
    let val = (formData.apiUrl || '').trim().replace(/[\r\n\t]/g, '');
    if (val && !val.startsWith('http://') && !val.startsWith('https://')) {
      val = 'https://' + val;
    }
    val = val.replace(/\/+$/, '');
    if (val !== formData.apiUrl) {
      setFormData(prev => ({ ...prev, apiUrl: val }));
    }
  }

  function handleKeyBlur() {
    const clean = (formData.apiKey || '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[\r\n\t]/g, '').trim();
    if (clean !== formData.apiKey) {
      setFormData(prev => ({ ...prev, apiKey: clean }));
    }
  }

  async function handleDeepProbe() {
    setCheckLoading(true);
    setProbeResult(null);

    let cleanUrl = (formData.apiUrl || '').trim().replace(/[\r\n\t]/g, '');
    if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    cleanUrl = cleanUrl.replace(/\/+$/, '');
    const cleanKey = (formData.apiKey || '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[\r\n\t]/g, '').trim();

    if (cleanUrl !== formData.apiUrl || cleanKey !== formData.apiKey) {
      setFormData(prev => ({ ...prev, apiUrl: cleanUrl, apiKey: cleanKey }));
    }

    try {
      const res = await probeProviderAction({
        providerId: initialData?.id,
        apiUrl: cleanUrl,
        apiKey: cleanKey,
        mapping: getMappingPayload(),
      });

      if ('error' in res && typeof res.error === 'string') {
        const errorMsg = res.error;
        toast.error(errorMsg || 'Ошибка доступа');
        setProbeResult({
          success: false,
          sanitizedUrl: cleanUrl,
          sanitizedKey: cleanKey,
          latencyMs: 0,
          balanceSuccess: false,
          servicesSuccess: false,
          errorMessage: errorMsg || 'Ошибка доступа',
        });
        return;
      }

      const probeData = res as ProviderProbeResult;
      setProbeResult(probeData);

      if (probeData.success) {
        toast.success(`Соединение успешно! Баланс: ${probeData.balance} ${probeData.detectedCurrency || ''}`);
        if (probeData.detectedCurrency && probeData.detectedCurrency !== formData.balanceCurrency) {
          setFormData(prev => ({ ...prev, balanceCurrency: probeData.detectedCurrency! }));
          toast.info(`Валюта баланса автоматически обновлена на ${probeData.detectedCurrency}`);
        }
      } else {
        toast.error(probeData.errorMessage || 'Ошибка подключения к провайдеру');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка проверки';
      toast.error(msg);
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
      const msg = err instanceof Error ? err.message : 'Ошибка загрузки каталога';
      toast.error(msg);
    } finally {
      setPreviewLoading(false);
    }
  }

  function applySuggestedUrl(suggestedUrl: string) {
    setFormData(prev => ({ ...prev, apiUrl: suggestedUrl }));
    setProbeResult(prev => prev ? { ...prev, suggestedUrl: undefined } : null);
    toast.success(`URL обновлен на: ${suggestedUrl}`);
  }

  async function handleInferSchema() {
    if (!formData.apiUrl || (!formData.apiKey && !initialData?.hasApiKey)) {
      toast.error('API URL и API Ключ обязательны для тестирования');
      return;
    }
    setInferLoading(true);
    try {
       const res = await inferProviderSchema(
           formData.apiUrl, 
           formData.apiKey, 
           mapping.httpMethod, 
           mapping.contentType, 
           { type: mapping.authType, field: mapping.authField, prefix: mapping.authPrefix },
           initialData?.id
       );
       if (res.success && res.schema) {
          setInferredSchema({
             catalogKeys: res.schema.catalog.keys,
             balanceKeys: res.schema.balance.keys,
             itemsPath: res.schema.catalog.itemsPath
          });
          
          const keys = res.schema.catalog.keys as string[];
          const bestMatch = (possible: string[]) => keys.find(k => possible.includes(k.toLowerCase())) || '';
          
          setMapping(prev => ({ 
             ...prev, 
             itemsPath: res.schema.catalog.itemsPath,
             serviceIdField: bestMatch(['service', 'package_id', 'id']) || prev.serviceIdField,
             nameField: bestMatch(['name', 'title']) || prev.nameField,
             priceField: bestMatch(['rate', 'price', 'cost']) || prev.priceField,
             minField: bestMatch(['min', 'minimum']) || prev.minField,
             maxField: bestMatch(['max', 'maximum']) || prev.maxField,
             typeField: bestMatch(['category', 'type']) || prev.typeField,
             descField: bestMatch(['desc', 'description']) || prev.descField,
          }));
          
          toast.success('Схема успешно получена! Поля автозаполнены.');
       } else {
          toast.error(`Ошибка: ${res.error || 'Не удалось получить схему'}`);
       }
    } catch(e: unknown) {
       const errMsg = e instanceof Error ? e.message : 'Ошибка получения схемы';
       toast.error(`Ошибка: ${errMsg}`);
    } finally {
       setInferLoading(false);
    }
  }

  return (
    <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-[24px] p-6 shadow-sm ring-1 ring-border/5">
      {inferredSchema && (
        <>
          <datalist id="catalog-keys">
            {inferredSchema.catalogKeys.map(k => <option key={k} value={k} />)}
          </datalist>
          <datalist id="balance-keys">
            {inferredSchema.balanceKeys.map(k => <option key={k} value={k} />)}
          </datalist>
        </>
      )}

      <div className="space-y-6">
        {/* Section 1: Basic connection parameters */}
        <div>
          <h3 className="text-base font-bold text-foreground mb-1">1. Основные параметры подключения</h3>
          <p className="text-xs text-muted-foreground mb-4">Адрес API-шлюза, валюта и ключ доступа к панели поставщика.</p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-6">

          {/* Name */}
          <div className="sm:col-span-3">
            <label className={labelCls} htmlFor="provider-name">
              Название панели
            </label>
            <input
              id="provider-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Например: Основной поставщик"
              className={`${inputCls} ${fieldErrors.name ? 'border-destructive focus:ring-destructive/20' : ''}`}
              aria-label="Название провайдера"
            />
            {fieldErrors.name && (
              <p className="text-xs font-bold text-destructive mt-1">{fieldErrors.name[0]}</p>
            )}
          </div>

          {/* Currency */}
          <div className="sm:col-span-3">
            <label className={labelCls} htmlFor="provider-currency">
              Валюта баланса
            </label>
            <select
              id="provider-currency"
              name="balanceCurrency"
              value={formData.balanceCurrency}
              onChange={handleChange}
              className={`${inputCls} ${fieldErrors.balanceCurrency ? 'border-destructive focus:ring-destructive/20' : ''}`}
            >
              <option value="USD">USD ($)</option>
              <option value="RUB">RUB (₽)</option>
              <option value="EUR">EUR (€)</option>
            </select>
            {fieldErrors.balanceCurrency && (
              <p className="text-xs font-bold text-destructive mt-1">{fieldErrors.balanceCurrency[0]}</p>
            )}
          </div>

          {/* API URL */}
          <div className="sm:col-span-6">
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls} htmlFor="provider-url">API URL</label>
              <span className="text-[11px] text-muted-foreground">Автоматически очищаются слэши и пробелы</span>
            </div>
            <input
              id="provider-url"
              type="url"
              name="apiUrl"
              placeholder="https://example.com/api/v2"
              value={formData.apiUrl}
              onChange={handleChange}
              onBlur={handleUrlBlur}
              className={`${inputCls} font-mono ${fieldErrors.apiUrl ? 'border-destructive focus:ring-destructive/20' : ''}`}
              aria-label="API URL провайдера"
            />
            {fieldErrors.apiUrl && (
              <p className="text-xs font-bold text-destructive mt-1">{fieldErrors.apiUrl[0]}</p>
            )}

            {/* Suggested URL Quick-Fix Banner */}
            {probeResult?.suggestedUrl && probeResult.suggestedUrl !== formData.apiUrl && (
              <div className="mt-2 p-3 rounded-xl bg-primary/10 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <Sparkles className="w-4 h-4 text-primary shrink-0 animate-pulse" />
                  <span>Рекомендуемый рабочий адрес API: <strong className="font-mono text-primary">{probeResult.suggestedUrl}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => applySuggestedUrl(probeResult.suggestedUrl!)}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all duration-200 shrink-0"
                >
                  Применить в 1 клик
                </button>
              </div>
            )}
          </div>

          {/* API Key */}
          <div className="sm:col-span-6 bg-warning/10/60 border border-amber-200 rounded-xl p-4">
            <label className="block text-sm font-medium text-amber-900 mb-1" htmlFor="provider-key">
              API Key / Secret
            </label>
            <p className="text-xs text-amber-700 mb-2">
              Ключ шифруется (AES-256-GCM) до сохранения в БД.
              {initialData?.hasApiKey && (
                <span className="ml-1 text-emerald-700 font-semibold">Текущий ключ установлен — оставьте поле пустым чтобы не менять.</span>
              )}
            </p>
            <input
              id="provider-key"
              type="password"
              name="apiKey"
              placeholder={initialData?.hasApiKey ? '******** (Скрыто)' : 'Введите API ключ...'}
              value={formData.apiKey}
              onChange={handleChange}
              onBlur={handleKeyBlur}
              autoComplete="new-password"
              className={`${inputCls} font-mono border-amber-300 bg-background/80 ${fieldErrors.apiKey ? 'border-destructive focus:ring-destructive/20' : ''}`}
              aria-label="API ключ провайдера"
            />
            {fieldErrors.apiKey && (
              <p className="text-xs font-bold text-destructive mt-1">{fieldErrors.apiKey[0]}</p>
            )}
          </div>

          {/* Ticket URL */}
          <div className="sm:col-span-6">
            <label className={labelCls} htmlFor="provider-ticket-url">
              URL поддержки (тикет-системы)
            </label>
            <input
              id="provider-ticket-url"
              type="url"
              name="ticketUrl"
              placeholder="https://example.com/tickets"
              value={formData.ticketUrl}
              onChange={handleChange}
              className={`${inputCls} font-mono ${fieldErrors.ticketUrl ? 'border-destructive focus:ring-destructive/20' : ''}`}
              aria-label="URL поддержки провайдера"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Ссылка на тикетную систему провайдера для быстрого перехода из таблицы заказов.
            </p>
            {fieldErrors.ticketUrl && (
              <p className="text-xs font-bold text-destructive mt-1">{fieldErrors.ticketUrl[0]}</p>
            )}
          </div>
        </div>

        {/* Section 2: Integration Protocol & Field Mapping */}
        <div className="border-t border-border pt-6 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">
                2. Формат интеграции и маппинг полей
              </h3>
              <p className="text-xs text-muted-foreground">
                Выберите протокол обмена данными с API поставщика
              </p>
            </div>

            {/* Mode Toggle Switcher */}
            <div className="flex bg-muted/60 p-1 rounded-xl w-full sm:w-auto border border-border/60 shadow-xs">
              <button
                type="button"
                onClick={() => handleModeChange('standard')}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                  integrationMode === 'standard'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                Perfect Panel (Стандарт)
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('visual')}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                  integrationMode === 'visual'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                Визуальный Билдер
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('json')}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                  integrationMode === 'json'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                JSON (Oldschool)
              </button>
            </div>
          </div>

          {/* Standard Mode Banner */}
          {integrationMode === 'standard' && (
            <div className="p-4 rounded-xl bg-success/10 border border-success/20 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-success/20 text-success flex items-center justify-center font-bold text-sm shrink-0">
                  ⚡
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Стандартный протокол Perfect Panel API активен</h4>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Все запросы (создание заказов <code className="font-mono text-primary">action=add</code>, проверка статусов <code className="font-mono text-primary">action=status</code>, запрос баланса <code className="font-mono text-primary">action=balance</code>) формируются автоматически в стандартном формате <code className="font-mono text-foreground">x-www-form-urlencoded</code>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Technical Settings Section - Visual Builder */}
          {integrationMode === 'visual' && (
            <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground">Визуальный API Билдер</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Инструмент для подключения нестандартных провайдеров. Откройте API документацию нужного провайдера (раздел "Add order") и перенесите названия полей оттуда в эти ячейки.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Левая колонка - Форма */}
                <div className="xl:col-span-2 space-y-6">

                  {/* STEP 0: FETCH SCHEMA */}
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <span className="bg-primary/20 text-primary w-6 h-6 rounded flex items-center justify-center text-xs">🪄</span>
                          Умный маппинг (Auto-Discovery)
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Заполните URL, Ключ и блок <b>Авторизации (Шаг 1)</b>. Затем нажмите кнопку, чтобы вытянуть реальные поля от провайдера.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleInferSchema}
                        disabled={inferLoading}
                        className={`whitespace-nowrap px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 shadow-sm ${
                          inferredSchema 
                            ? 'bg-emerald-600 text-primary-foreground hover:bg-emerald-700' 
                            : 'bg-primary text-primary-foreground hover:bg-primary/90'
                        }`}
                      >
                        {inferLoading ? 'Загрузка...' : inferredSchema ? '✅ Обновить схему' : '🪄 Получить схему'}
                      </button>
                    </div>
                    
                    {inferredSchema && (
                      <div className="mt-3 p-3 bg-success/10 border border-emerald-500/20 rounded-md animate-in slide-in-from-top-2">
                        <p className="text-xs text-emerald-800 font-medium mb-1">✅ Мы нашли следующие поля в API:</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {inferredSchema.catalogKeys.slice(0, 15).map(k => (
                              <span key={k} className="px-1.5 py-0.5 bg-success/20 text-emerald-900 rounded text-[10px] font-mono border border-emerald-500/20">
                                {k}
                              </span>
                          ))}
                          {inferredSchema.catalogKeys.length > 15 && (
                            <span className="text-[10px] text-emerald-800 self-center">и еще {inferredSchema.catalogKeys.length - 15}...</span>
                          )}
                        </div>
                        <p className="text-[11px] text-emerald-800 mt-2 font-medium">Я автоматически заполнил наиболее подходящие поля ниже.</p>
                      </div>
                    )}
                  </div>

                  {/* HTTP CONFIG */}
                  <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-4">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      Метод и Формат запроса
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>HTTP Метод</label>
                        <select
                          className={inputCls}
                          value={mapping.httpMethod}
                          onChange={(e) => setMapping({...mapping, httpMethod: e.target.value as 'POST' | 'GET'})}
                        >
                          <option value="POST">POST</option>
                          <option value="GET">GET</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Формат данных</label>
                        <select
                          className={inputCls}
                          value={mapping.contentType}
                          onChange={(e) => setMapping({...mapping, contentType: e.target.value as 'form' | 'json'})}
                          disabled={mapping.httpMethod === 'GET'}
                        >
                          <option value="form">x-www-form-urlencoded (Стандарт)</option>
                          <option value="json">application/json</option>
                        </select>
                        {mapping.httpMethod === 'GET' && <p className="text-[10px] text-muted-foreground mt-1">Для GET запросов параметры передаются в URL.</p>}
                      </div>
                    </div>
                  </div>

                  {/* STEP 1: AUTH */}
                  <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-4">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <span className="bg-primary/10 text-primary w-6 h-6 rounded flex items-center justify-center text-xs">1</span>
                      Авторизация (Как мы передаем API ключ?)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className={labelCls}>Метод передачи</label>
                        <select
                          className={inputCls}
                          value={mapping.authType}
                          onChange={(e) => setMapping({...mapping, authType: e.target.value as 'body' | 'query' | 'header'})}
                        >
                          <option value="body">В теле запроса (Body / POST)</option>
                          <option value="query">В адресе (Query ?key=...)</option>
                          <option value="header">В HTTP заголовке (Headers)</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Название параметра</label>
                        <input
                          className={inputCls}
                          value={mapping.authField}
                          onChange={(e) => setMapping({...mapping, authField: e.target.value})}
                          placeholder="key"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">Обычно `key` или `api_token`</p>
                      </div>
                      {mapping.authType === 'header' && (
                        <div>
                          <label className={labelCls}>Префикс ключа (опц.)</label>
                          <input
                            className={inputCls}
                            value={mapping.authPrefix}
                            onChange={(e) => setMapping({...mapping, authPrefix: e.target.value})}
                            placeholder="Bearer "
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* STEP 2: CATALOG MAPPING */}
                  <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-4">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <span className="bg-primary/10 text-primary w-6 h-6 rounded flex items-center justify-center text-xs">2</span>
                      Каталог услуг (Чтение /services)
                    </h4>
                    <p className="text-xs text-muted-foreground">Где лежат услуги и как называются поля? {inferredSchema && <span className="text-emerald-600 font-semibold">(Доступны подсказки из схемы)</span>}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className={labelCls}>Путь к массиву услуг (Items Path)</label>
                        <input className={inputCls} value={mapping.itemsPath} onChange={e => setMapping({...mapping, itemsPath: e.target.value})} placeholder="$" />
                        <p className="text-[10px] text-muted-foreground mt-1">$ значит корень. Если услуги лежат в data.services, введите data.services</p>
                      </div>
                      <div>
                        <label className={labelCls}>Поле "ID Услуги"</label>
                        <input className={inputCls} list="catalog-keys" value={mapping.serviceIdField} onChange={e => setMapping({...mapping, serviceIdField: e.target.value})} />
                      </div>
                      <div>
                        <label className={labelCls}>Поле "Название"</label>
                        <input className={inputCls} list="catalog-keys" value={mapping.nameField} onChange={e => setMapping({...mapping, nameField: e.target.value})} />
                      </div>
                      <div>
                        <label className={labelCls}>Поле "Цена" (за 1000)</label>
                        <input className={inputCls} list="catalog-keys" value={mapping.priceField} onChange={e => setMapping({...mapping, priceField: e.target.value})} />
                      </div>
                      <div>
                        <label className={labelCls}>Поле "Категория"</label>
                        <input className={inputCls} list="catalog-keys" value={mapping.typeField} onChange={e => setMapping({...mapping, typeField: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  {/* STEP 3: ORDER CREATION */}
                  <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-4">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <span className="bg-primary/10 text-primary w-6 h-6 rounded flex items-center justify-center text-xs">3</span>
                      Создание заказа (Отправка)
                    </h4>
                    <p className="text-xs text-muted-foreground">Как провайдер ждет заказ?</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className={labelCls}>Поле "ID Услуги"</label>
                        <input
                          className={inputCls}
                          value={mapping.serviceField}
                          onChange={(e) => setMapping({...mapping, serviceField: e.target.value})}
                          placeholder="service"
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Поле "Ссылка"</label>
                        <input
                          className={inputCls}
                          value={mapping.linkField}
                          onChange={(e) => setMapping({...mapping, linkField: e.target.value})}
                          placeholder="link"
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Поле "Количество"</label>
                        <input
                          className={inputCls}
                          value={mapping.quantityField}
                          onChange={(e) => setMapping({...mapping, quantityField: e.target.value})}
                          placeholder="quantity"
                        />
                      </div>
                    </div>
                  </div>

                  {/* STEP 4: RESPONSE PARSING */}
                  <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-4">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <span className="bg-primary/10 text-primary w-6 h-6 rounded flex items-center justify-center text-xs">4</span>
                      Чтение ответа & Баланса
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Ответ: "Номер заказа"</label>
                        <input className={inputCls} value={mapping.orderIdField} onChange={(e) => setMapping({...mapping, orderIdField: e.target.value})} />
                      </div>
                      <div>
                        <label className={labelCls}>Ответ: "Текст ошибки"</label>
                        <input className={inputCls} value={mapping.errorField} onChange={(e) => setMapping({...mapping, errorField: e.target.value})} />
                      </div>
                      <div className="sm:col-span-2 border-t border-border/50 pt-3 mt-1">
                        <p className="text-xs font-semibold mb-2">Чтение баланса (Чтение /balance)</p>
                      </div>
                      <div>
                        <label className={labelCls}>Поле "Баланс"</label>
                        <input className={inputCls} list="balance-keys" value={mapping.balancePath} onChange={(e) => setMapping({...mapping, balancePath: e.target.value})} placeholder="balance" />
                      </div>
                      <div>
                        <label className={labelCls}>Поле "Валюта"</label>
                        <input className={inputCls} list="balance-keys" value={mapping.currencyPath} onChange={(e) => setMapping({...mapping, currencyPath: e.target.value})} placeholder="currency" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Правая колонка - Live Preview */}
                <div className="xl:col-span-1">
                  <div className="bg-card/60 backdrop-blur-md rounded-[24px] border border-border/50 overflow-hidden sticky top-6 shadow-sm ring-1 ring-border/5">
                    <div className="bg-muted px-4 py-2 border-b border-border flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-destructive"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-warning"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-success"></div>
                      <span className="text-xs text-muted-foreground font-mono ml-2">Live Preview: {mapping.httpMethod} /api</span>
                    </div>
                    <div className="p-4 text-xs font-mono text-primary leading-relaxed overflow-x-auto">
                      <span className="text-muted-foreground">// То, что уйдет провайдеру:</span>
                      <br/>
                      {mapping.authType === 'header' && (
                        <>
                          <span className="text-[#ce9178]">"{mapping.authField}"</span>: <span className="text-[#b5cea8]">"{mapping.authPrefix}ВАШ_КЛЮЧ"</span>
                          <br/><br/>
                        </>
                      )}

                      {mapping.httpMethod === 'GET' ? (
                        <div className="break-all whitespace-pre-wrap">
                          <span className="text-[#569cd6]">URL:</span> ?action=add&{mapping.authType === 'query' || mapping.authType === 'body' ? `${mapping.authField}=ВАШ_КЛЮЧ&` : ''}{mapping.serviceField || 'service'}=123&{mapping.linkField || 'link'}=https://t.me/durov&{mapping.quantityField || 'quantity'}=1000
                        </div>
                      ) : (
                        <>
                          {mapping.contentType === 'json' ? (
                            <span className="text-[#569cd6]">{"{"}</span>
                          ) : (
                            <span className="text-[#569cd6]">Body (Form Data):</span>
                          )}
                          <div className={mapping.contentType === 'json' ? "pl-4" : "pl-0"}>
                            <span className="text-[#ce9178]">"action"</span>: <span className="text-[#ce9178]">"add"</span>,<br/>
                            {(mapping.authType === 'body' || mapping.authType === 'query') && (
                              <><span className="text-[#ce9178]">"{mapping.authField}"</span>: <span className="text-[#b5cea8]">"ВАШ_КЛЮЧ"</span>,<br/></>
                            )}
                            <span className="text-[#ce9178]">"{mapping.serviceField || 'service'}"</span>: <span className="text-[#b5cea8]">123</span>,<br/>
                            <span className="text-[#ce9178]">"{mapping.linkField || 'link'}"</span>: <span className="text-[#ce9178]">"https://t.me/durov"</span>,<br/>
                            <span className="text-[#ce9178]">"{mapping.quantityField || 'quantity'}"</span>: <span className="text-[#b5cea8]">1000</span>
                          </div>
                          {mapping.contentType === 'json' && <span className="text-[#569cd6]">{"}"}</span>}
                        </>
                      )}
                      
                      <br/><br/>
                      <span className="text-muted-foreground">// То, что мы ждем в ответ:</span>
                      <br/>
                      <span className="text-[#569cd6]">{"{"}</span>
                      <div className="pl-4">
                        <span className="text-[#ce9178]">"{mapping.orderIdField || 'order'}"</span>: <span className="text-[#b5cea8]">9876543</span>
                      </div>
                      <span className="text-[#569cd6]">{"}"}</span>
                    </div>
                  </div>
                </div>
              </div>



            </div>
          )}

          {integrationMode === 'json' && (
            <div className="sm:col-span-6 space-y-4 pt-4 animate-in fade-in slide-in-from-top-2 duration-300 border-t border-border">
              <h3 className="text-base font-semibold text-foreground">Продвинутый JSON маппинг</h3>
              <p className="text-sm text-muted-foreground mt-0.5 mb-4">
                Настройте маппинг вручную. Отлично подходит для копирования готовых конфигураций (Oldschool стиль).
              </p>
              <textarea
                className={`${inputCls} font-mono text-xs`}
                rows={15}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder="{\n  ... \n}"
              />
            </div>
          )}

          {/* isActive toggle */}
          <div className="sm:col-span-6 flex items-center gap-3 pt-2">
            <input
              id="provider-active"
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30 cursor-pointer"
            />
            <label htmlFor="provider-active" className="text-sm text-foreground cursor-pointer select-none">
              Включить провайдера: принимать заказы и разрешить синхронизацию каталога
            </label>
          </div>
        </div>

        {/* Live Diagnostic HUD */}
        {probeResult && (
          <div className="mt-6 pt-4 border-t border-border animate-in fade-in slide-in-from-top-2 duration-300">
            {probeResult.success ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Все тесты пройдены успешно! Провайдер готов к работе.</span>
                  </div>
                  <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                    Отклик: {probeResult.latencyMs} ms
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-background/80 border border-emerald-500/20">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Баланс провайдера</div>
                    <div className="text-base font-extrabold text-foreground mt-0.5">
                      {probeResult.balance} <span className="text-xs text-primary font-bold">{probeResult.detectedCurrency}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-background/80 border border-emerald-500/20">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Каталог услуг</div>
                    <div className="text-base font-extrabold text-foreground mt-0.5">
                      {probeResult.servicesCount ?? 0} <span className="text-xs text-muted-foreground font-normal">услуг в API</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-background/80 border border-emerald-500/20">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Связь & Протокол</div>
                    <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1.5">
                      <Zap className="w-4 h-4" /> v2 API Ready
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 space-y-2">
                <div className="flex items-start gap-2.5">
                  <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-destructive">
                      {probeResult.errorMessage || 'Ошибка связи с провайдером'}
                    </div>
                    {probeResult.suggestedFix && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        💡 <strong>Как исправить:</strong> {probeResult.suggestedFix}
                      </p>
                    )}
                  </div>
                </div>

                {probeResult.suggestedUrl && probeResult.suggestedUrl !== formData.apiUrl && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => applySuggestedUrl(probeResult.suggestedUrl!)}
                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all duration-200"
                    >
                      Исправить URL на {probeResult.suggestedUrl}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="pt-5 border-t border-border flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          {/* Diagnostic & Preview Tools */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDeepProbe}
              disabled={checkLoading}
              aria-label="Запустить глубокий тест соединения"
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-all duration-200 disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              {checkLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                  <span>Диагностика...</span>
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4 text-primary" />
                  <span>🔌 Глубокий тест</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleOpenPreview}
              disabled={previewLoading || !formData.apiUrl || (!formData.apiKey && !initialData?.hasApiKey)}
              aria-label="Предпросмотр каталога услуг провайдера"
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-all duration-200 disabled:opacity-40 flex items-center gap-2 shadow-sm"
            >
              {previewLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span>Загрузка...</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <span>👁 Предпросмотр каталога</span>
                </>
              )}
            </button>
          </div>

          {/* Form Submit & Cancel */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/admin/providers')}
              aria-label="Отменить изменения"
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-all duration-200"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              aria-label={initialData ? 'Сохранить изменения провайдера' : 'Создать провайдера'}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 disabled:opacity-50 shadow-sm"
            >
              {loading ? 'Сохранение...' : initialData ? 'Сохранить' : 'Создать подключение'}
            </button>
          </div>
        </div>
      </div>

      {/* Shadow Catalog Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[85vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-base font-extrabold text-foreground">
                    Каталог провайдера ({previewTotal} услуг)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Первые 50 услуг из реального API для сверки цен и категорий
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Закрыть предпросмотр"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-3 border-b border-border bg-background/50">
              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Поиск по названию или ID услуги..."
                  value={previewSearch}
                  onChange={(e) => setPreviewSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {previewLoading ? (
                <div className="py-16 text-center text-muted-foreground space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary" />
                  <p className="text-sm">Загрузка каталога из API провайдера...</p>
                </div>
              ) : previewServices.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <p className="text-sm">Услуги не найдены или каталог пуст.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="pb-2 font-bold w-16">ID</th>
                        <th className="pb-2 font-bold">Название услуги</th>
                        <th className="pb-2 font-bold">Категория</th>
                        <th className="pb-2 font-bold text-right">Тариф (за 1k)</th>
                        <th className="pb-2 font-bold text-right">Лимиты (Min / Max)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {previewServices
                        .filter(s => 
                          !previewSearch || 
                          (s.name && String(s.name).toLowerCase().includes(previewSearch.toLowerCase())) || 
                          (s.service !== undefined && String(s.service).includes(previewSearch)) ||
                          (s.category && String(s.category).toLowerCase().includes(previewSearch.toLowerCase()))
                        )
                        .map((s, idx) => (
                          <tr key={idx} className="hover:bg-muted/40 transition-colors">
                            <td className="py-2.5 font-mono text-muted-foreground">{s.service}</td>
                            <td className="py-2.5 font-medium text-foreground max-w-xs truncate">{s.name}</td>
                            <td className="py-2.5 text-muted-foreground max-w-[150px] truncate">{s.category}</td>
                            <td className="py-2.5 text-right font-mono font-bold text-primary">
                              {s.rate} <span className="text-[10px] text-muted-foreground">{formData.balanceCurrency}</span>
                            </td>
                            <td className="py-2.5 text-right font-mono text-muted-foreground">
                              {s.min} – {s.max}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-border bg-muted/20 flex justify-end">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
