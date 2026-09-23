'use client';

import { useState, useEffect, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Route, Shield, ArrowRight, Zap, RefreshCw, Plus, Trash2, 
  ArrowUp, ArrowDown, Search, CheckCircle, AlertTriangle, 
  Lock, Globe, Bot, ShoppingCart, CreditCard, Send, Sparkles
} from 'lucide-react';
import { 
  getNetworkRoutingConfigAction, 
  saveNetworkRoutingConfigAction,
  updateServiceToggleAction,
  inspectRouteAction 
} from '@/actions/admin/network-routing';
import type { 
  NetworkRoutingConfig, 
  RoutingRule, 
  RoutingRuleType, 
  RoutingTargetType, 
  SubsystemServiceType,
  ProviderProxyWithUsage
} from '@/types/provider-proxy';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  proxies?: ProviderProxyWithUsage[];
}

export function NetworkRoutingTab({ proxies = [] }: Props) {
  const [config, setConfig] = useState<NetworkRoutingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Route Inspector State
  const [inspectUrl, setInspectUrl] = useState('https://generativelanguage.googleapis.com');
  const [inspectService, setInspectService] = useState<SubsystemServiceType>('AI_GEMINI');
  const [inspectResult, setInspectResult] = useState<any | null>(null);
  const [inspecting, setInspecting] = useState(false);

  // Add Rule Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRuleType, setNewRuleType] = useState<RoutingRuleType>('DOMAIN-SUFFIX');
  const [newRulePayload, setNewRulePayload] = useState('');
  const [newRuleTarget, setNewRuleTarget] = useState<RoutingTargetType>('DIRECT');
  const [newRuleComment, setNewRuleComment] = useState('');

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await getNetworkRoutingConfigAction();
      if (res.success) {
        setConfig(res.data);
      } else {
        toast.error(res.error || 'Ошибка загрузки конфигурации');
      }
    } catch {
      toast.error('Не удалось загрузить правила маршрутизации');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleInspect = async () => {
    if (!inspectUrl.trim()) {
      toast.error('Укажите URL для проверки');
      return;
    }
    setInspecting(true);
    try {
      const res = await inspectRouteAction(inspectUrl, inspectService);
      if (res.success) {
        setInspectResult(res.data);
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error('Ошибка трассировки маршрута');
    } finally {
      setInspecting(false);
    }
  };

  const handleToggleChange = (service: any, target: RoutingTargetType) => {
    if (!config) return;
    startTransition(async () => {
      const res = await updateServiceToggleAction(service, target);
      if (res.success) {
        setConfig({
          ...config,
          serviceToggles: res.data
        });
        toast.success('Маршрутизация сервиса обновлена');
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleMoveRule = (index: number, direction: 'up' | 'down') => {
    if (!config) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= config.rules.length) return;

    const newRules = [...config.rules];
    const temp = newRules[index];
    newRules[index] = newRules[targetIndex];
    newRules[targetIndex] = temp;

    // Recalculate priorities
    newRules.forEach((r, idx) => {
      r.priority = (idx + 1) * 10;
    });

    const updated = { ...config, rules: newRules };
    setConfig(updated);
    saveConfig(updated);
  };

  const handleToggleRuleActive = (ruleId: string, current: boolean) => {
    if (!config) return;
    const newRules = config.rules.map(r => r.id === ruleId ? { ...r, isEnabled: !current } : r);
    const updated = { ...config, rules: newRules };
    setConfig(updated);
    saveConfig(updated);
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!config) return;
    const newRules = config.rules.filter(r => r.id !== ruleId);
    const updated = { ...config, rules: newRules };
    setConfig(updated);
    saveConfig(updated);
    toast.success('Правило удалено');
  };

  const handleAddRule = () => {
    if (!config) return;
    if (newRuleType !== 'FINAL' && !newRulePayload.trim()) {
      toast.error('Укажите домен или значение правила');
      return;
    }

    const newRule: RoutingRule = {
      id: `rule-${Date.now()}`,
      type: newRuleType,
      payload: newRulePayload.trim(),
      target: newRuleTarget,
      comment: newRuleComment.trim() || undefined,
      isEnabled: true,
      priority: (config.rules.length + 1) * 10
    };

    const updated = {
      ...config,
      rules: [newRule, ...config.rules]
    };
    setConfig(updated);
    saveConfig(updated);
    setShowAddModal(false);
    setNewRulePayload('');
    setNewRuleComment('');
    toast.success('Новое правило добавлено');
  };

  const saveConfig = async (cfg: NetworkRoutingConfig) => {
    startTransition(async () => {
      const res = await saveNetworkRoutingConfigAction(cfg);
      if (!res.success) {
        toast.error(res.error);
        loadConfig();
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Загрузка сетевого маршрутизатора...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SECTION 1: Service Matrix Quick Toggles */}
      <Card className="p-5 border-border/80 bg-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Матрица сервисов (Быстрые переключатели в 1 клик)
            </h3>
            <p className="text-xs text-muted-foreground">
              Настройте, через какой сетевой контур работают ключевые подсистемы платформы
            </p>
          </div>
          <Badge intent="outline" className="text-xs border-primary/30 text-primary">
            Clash Verge Engine v1.0
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* AI Gemini */}
          <div className="p-3 rounded-lg border border-border/60 bg-muted/20 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-semibold">Google Gemini AI</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Генерация черновиков, автоответчик и классификация услуг
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={config?.serviceToggles.aiGemini === 'PROXY_POOL' ? 'primary' : 'outline'}
                className="h-7 text-xs flex-1"
                onClick={() => handleToggleChange('aiGemini', 'PROXY_POOL')}
              >
                Пул прокси
              </Button>
              <Button
                size="sm"
                variant={config?.serviceToggles.aiGemini === 'SYSTEM_PROXY' ? 'primary' : 'outline'}
                className="h-7 text-xs flex-1"
                onClick={() => handleToggleChange('aiGemini', 'SYSTEM_PROXY')}
              >
                Системный VPN
              </Button>
              <Button
                size="sm"
                variant={config?.serviceToggles.aiGemini === 'DIRECT' ? 'primary' : 'outline'}
                className="h-7 text-xs flex-1"
                onClick={() => handleToggleChange('aiGemini', 'DIRECT')}
              >
                Direct
              </Button>
            </div>
          </div>

          {/* SMM Providers */}
          <div className="p-3 rounded-lg border border-border/60 bg-muted/20 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-semibold">SMM Провайдеры (API)</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Отправка заказов, проверка баланса провайдеров и статусов
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={config?.serviceToggles.providers === 'PROXY_POOL' ? 'primary' : 'outline'}
                className="h-7 text-xs flex-1"
                onClick={() => handleToggleChange('providers', 'PROXY_POOL')}
              >
                Пул прокси
              </Button>
              <Button
                size="sm"
                variant={config?.serviceToggles.providers === 'DIRECT' ? 'primary' : 'outline'}
                className="h-7 text-xs flex-1"
                onClick={() => handleToggleChange('providers', 'DIRECT')}
              >
                Direct
              </Button>
            </div>
          </div>

          {/* Catalog Sync */}
          <div className="p-3 rounded-lg border border-border/60 bg-muted/20 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-semibold">Проверка цен и каталог</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Фоновое сканирование изменений цен и синхронизация услуг
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={config?.serviceToggles.catalogSync === 'DIRECT' ? 'primary' : 'outline'}
                className="h-7 text-xs flex-1"
                onClick={() => handleToggleChange('catalogSync', 'DIRECT')}
              >
                Direct
              </Button>
              <Button
                size="sm"
                variant={config?.serviceToggles.catalogSync === 'PROXY_POOL' ? 'primary' : 'outline'}
                className="h-7 text-xs flex-1"
                onClick={() => handleToggleChange('catalogSync', 'PROXY_POOL')}
              >
                Пул прокси
              </Button>
            </div>
          </div>

          {/* Russian Payments (IMMUTABLE) */}
          <div className="p-3 rounded-lg border border-border/60 bg-muted/20 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-semibold">Платежи РФ (ЮKassa, Robokassa)</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Банковские карты РФ, СБП, чеки 54-ФЗ
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={config?.serviceToggles.paymentsRu === 'DIRECT' ? 'primary' : 'outline'}
                className="h-7 text-xs flex-1 cursor-pointer"
                onClick={() => handleToggleChange('paymentsRu', 'DIRECT')}
              >
                <Lock className="h-3 w-3 mr-1" />
                Direct (РФ)
              </Button>
              <Button
                size="sm"
                variant={config?.serviceToggles.paymentsRu === 'RU_SOVEREIGN_POOL' ? 'primary' : 'outline'}
                className="h-7 text-xs flex-1 cursor-pointer"
                onClick={() => handleToggleChange('paymentsRu', 'RU_SOVEREIGN_POOL')}
                title="Использовать российские прокси-ноды для серверов за рубежом"
              >
                🇷🇺 Резерв RU
              </Button>
            </div>
          </div>

          {/* CryptoBot */}
          <div className="p-3 rounded-lg border border-border/60 bg-muted/20 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-4 w-4 text-indigo-500" />
              <span className="text-xs font-semibold">CryptoBot Gateway</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Криптоплатежи в TON, USDT и выставление инвойсов
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={config?.serviceToggles.paymentsCrypto === 'DIRECT' ? 'primary' : 'outline'}
                className="h-7 text-xs flex-1"
                onClick={() => handleToggleChange('paymentsCrypto', 'DIRECT')}
              >
                Direct
              </Button>
              <Button
                size="sm"
                variant={config?.serviceToggles.paymentsCrypto === 'PROXY_POOL' ? 'primary' : 'outline'}
                className="h-7 text-xs flex-1"
                onClick={() => handleToggleChange('paymentsCrypto', 'PROXY_POOL')}
              >
                Пул прокси
              </Button>
            </div>
          </div>

          {/* Telegram Bot */}
          <div className="p-3 rounded-lg border border-border/60 bg-muted/20 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <Send className="h-4 w-4 text-sky-500" />
              <span className="text-xs font-semibold">Telegram Bot & Alerts</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Polling обновлений, отправка чеков и алертов техподдержки
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={config?.serviceToggles.telegram === 'DIRECT' ? 'primary' : 'outline'}
                className="h-7 text-xs flex-1"
                onClick={() => handleToggleChange('telegram', 'DIRECT')}
              >
                Direct
              </Button>
              <Button
                size="sm"
                variant={config?.serviceToggles.telegram === 'PROXY_POOL' ? 'primary' : 'outline'}
                className="h-7 text-xs flex-1"
                onClick={() => handleToggleChange('telegram', 'PROXY_POOL')}
              >
                Пул прокси
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* SECTION 2: Route Inspector */}
      <Card className="p-5 border-border/80 bg-card">
        <h3 className="text-base font-semibold flex items-center gap-2 mb-1">
          <Search className="h-4 w-4 text-primary" />
          Инспектор маршрутов (Route Inspector & Tracing)
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Проверьте, по какому правилу и через какой узел пойдет трафик к любому целевому адресу
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={inspectUrl}
            onChange={(e) => setInspectUrl(e.target.value)}
            placeholder="https://example.com/api..."
            className="flex-1 text-xs h-9"
          />
          <select
            value={inspectService}
            onChange={(e) => setInspectService(e.target.value as any)}
            aria-label="Контекст сервиса для инспектора маршрутов"
            className="h-9 px-3 rounded-md border border-input bg-background text-xs"
          >
            <option value="AI_GEMINI">AI_GEMINI (ИИ)</option>
            <option value="PROVIDERS">PROVIDERS (Панели)</option>
            <option value="CATALOG_SYNC">CATALOG_SYNC (Цены)</option>
            <option value="PAYMENTS_RU">PAYMENTS_RU (РФ Платежи)</option>
            <option value="PAYMENTS_CRYPTO">PAYMENTS_CRYPTO (Крипта)</option>
            <option value="TELEGRAM">TELEGRAM (Бот)</option>
            <option value="OTHER">OTHER (Прочее)</option>
          </select>
          <Button
            size="sm"
            variant="primary"
            onClick={handleInspect}
            disabled={inspecting}
            className="h-9 text-xs px-4"
          >
            {inspecting ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Route className="h-3.5 w-3.5 mr-1.5" />}
            Трассировка
          </Button>
        </div>

        {inspectResult && (
          <div className="mt-4 p-3.5 rounded-lg border border-border bg-muted/30 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                {inspectResult.target === 'DIRECT' && <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">DIRECT</Badge>}
                {inspectResult.target === 'PROXY_POOL' && <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">PROXY_POOL</Badge>}
                {inspectResult.target === 'RU_SOVEREIGN_POOL' && <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">RU_SOVEREIGN_POOL 🇷🇺</Badge>}
                {inspectResult.target === 'SYSTEM_PROXY' && <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30">SYSTEM_PROXY</Badge>}
                {inspectResult.target === 'REJECT' && <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30">REJECT</Badge>}
                <span className="text-muted-foreground ml-1">Хост: {inspectResult.hostname}</span>
              </span>
              {inspectResult.isImmutableDirect && (
                <Badge intent="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 flex items-center gap-1">
                  <Lock className="h-2.5 w-2.5" /> Защищенный узел РФ
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground font-mono text-[11px]">
              Причина: {inspectResult.reason}
            </p>
            {inspectResult.matchedRule && (
              <div className="text-[11px] text-muted-foreground">
                Совпавшее правило: <span className="font-semibold text-foreground">[{inspectResult.matchedRule.type}] {inspectResult.matchedRule.payload}</span>
                {inspectResult.matchedRule.comment && ` (${inspectResult.matchedRule.comment})`}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* SECTION 3: Clash Verge Rules Table */}
      <Card className="p-5 border-border/80 bg-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Таблица правил маршрутизации (Clash Verge Rules Matrix)
            </h3>
            <p className="text-xs text-muted-foreground">
              Правила применяются строго сверху вниз (First Match Win). Первое совпадение определяет маршрут.
            </p>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setShowAddModal(true)}
            className="h-8 text-xs gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить правило
          </Button>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2 px-3 text-left font-medium w-16">Порядок</th>
                <th className="py-2 px-3 text-left font-medium w-32">Тип правила</th>
                <th className="py-2 px-3 text-left font-medium">Значение / Шаблон</th>
                <th className="py-2 px-3 text-left font-medium w-28">Таргет</th>
                <th className="py-2 px-3 text-left font-medium">Описание</th>
                <th className="py-2 px-3 text-center font-medium w-16">Статус</th>
                <th className="py-2 px-3 text-right font-medium w-24">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {config?.rules.map((rule, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === config.rules.length - 1;

                return (
                  <tr key={rule.id} className={!rule.isEnabled ? 'opacity-50 bg-muted/10' : 'hover:bg-muted/20'}>
                    <td className="py-2 px-3 text-muted-foreground font-mono">
                      #{idx + 1}
                    </td>
                    <td className="py-2 px-3">
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted text-foreground border border-border">
                        {rule.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px]">
                      {rule.payload || '—'}
                    </td>
                    <td className="py-2 px-3">
                      {rule.target === 'DIRECT' && (
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">
                          DIRECT
                        </Badge>
                      )}
                      {rule.target === 'PROXY_POOL' && (
                        <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[10px]">
                          PROXY_POOL
                        </Badge>
                      )}
                      {rule.target === 'RU_SOVEREIGN_POOL' && (
                        <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]">
                          RU 🇷🇺
                        </Badge>
                      )}
                      {rule.target === 'SYSTEM_PROXY' && (
                        <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30 text-[10px]">
                          SYSTEM
                        </Badge>
                      )}
                      {rule.target === 'REJECT' && (
                        <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30 text-[10px]">
                          REJECT
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground text-[11px] truncate max-w-[200px]">
                      {rule.comment || '—'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={rule.isEnabled}
                        onClick={() => handleToggleRuleActive(rule.id, rule.isEnabled)}
                        className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          rule.isEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                            rule.isEnabled ? 'translate-x-3' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          disabled={isFirst}
                          onClick={() => handleMoveRule(idx, 'up')}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          disabled={isLast}
                          onClick={() => handleMoveRule(idx, 'down')}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        {rule.type !== 'FINAL' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-rose-500 hover:text-rose-600"
                            onClick={() => handleDeleteRule(rule.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Rule Dialog */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Добавить правило маршрутизации</DialogTitle>
            <DialogDescription className="text-xs">
              Правило будет добавлено в начало списка и проверено перед остальными
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs mb-1 block">Тип правила</Label>
              <select
                value={newRuleType}
                onChange={(e) => setNewRuleType(e.target.value as any)}
                aria-label="Тип правила маршрутизации"
                className="w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs"
              >
                <option value="DOMAIN-SUFFIX">DOMAIN-SUFFIX (Суффикс домена)</option>
                <option value="DOMAIN">DOMAIN (Точный хост)</option>
                <option value="DOMAIN-KEYWORD">DOMAIN-KEYWORD (Ключевое слово)</option>
                <option value="SERVICE">SERVICE (Подсистема)</option>
              </select>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Значение / Шаблон</Label>
              <Input
                value={newRulePayload}
                onChange={(e) => setNewRulePayload(e.target.value)}
                placeholder="например, openai.com или smmpanel.com"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <Label className="text-xs mb-1 block">Целевой узел (Таргет)</Label>
              <select
                value={newRuleTarget}
                onChange={(e) => setNewRuleTarget(e.target.value as any)}
                aria-label="Целевой узел маршрутизации"
                className="w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs"
              >
                <option value="DIRECT">DIRECT (Напрямую без прокси)</option>
                <option value="PROXY_POOL">PROXY_POOL (Автовыбор из пула прокси)</option>
                <option value="RU_SOVEREIGN_POOL">RU_SOVEREIGN_POOL (Российские ноды 🇷🇺)</option>
                <option value="SYSTEM_PROXY">SYSTEM_PROXY (Системный VPN-туннель)</option>
                <option value="REJECT">REJECT (Заблокировать трафик)</option>
              </select>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Описание / Комментарий</Label>
              <Input
                value={newRuleComment}
                onChange={(e) => setNewRuleComment(e.target.value)}
                placeholder="Зачем нужно это правило..."
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowAddModal(false)} className="h-8 text-xs">
              Отмена
            </Button>
            <Button size="sm" variant="primary" onClick={handleAddRule} className="h-8 text-xs">
              Сохранить правило
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}