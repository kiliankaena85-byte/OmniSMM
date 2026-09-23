'use client';

import React, { useState, useTransition } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Switch } from '@heroui/react';
import { toast } from 'sonner';
import { 
  updateCampaignStatus, 
  updateServiceConfig, 
  toggleSmartGlobalStatus,
  bulkUpdateServiceConfigs
} from '@/actions/admin/smart';
import { SocialIcon } from '@/components/ui/SocialIcon';
import { 
  Pause, 
  Play, 
  Search, 
  Settings, 
  Sliders, 
  AlertTriangle,
  Cpu,
  Layers,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface CampaignDTO {
  id: string;
  userEmail: string;
  serviceName: string;
  categoryName: string;
  link: string;
  totalQuantity: number;
  totalDays: number;
  status: 'PLANNED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ERROR';
  isTestMode: boolean;
  createdAt: Date;
  progress: number;
  tasksCount: number;
  completedTasksCount: number;
}

interface ServiceDTO {
  id: string;
  name: string;
  category: {
    name: string;
    network?: {
      name: string;
      slug: string;
    } | null;
  };
  smartConfig: {
    isEnabled: boolean;
    isTestMode: boolean;
    minChunk: number;
    maxChunk: number;
    markup: number;
  } | null;
}

interface SmartDripClientProps {
  initialCampaigns: CampaignDTO[];
  initialServices: ServiceDTO[];
  initialGlobalDisabled: boolean;
}

type TabType = 'campaigns' | 'configs' | 'settings';

export function SmartDripClient({ 
  initialCampaigns, 
  initialServices, 
  initialGlobalDisabled 
}: SmartDripClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>('campaigns');
  const [campaigns, setCampaigns] = useState<CampaignDTO[]>(initialCampaigns);
  const [services, setServices] = useState<ServiceDTO[]>(initialServices);
  const [globalDisabled, setGlobalDisabled] = useState(initialGlobalDisabled);
  
  // Search & Filters
  const [campaignSearch, setCampaignSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Edit Service Config Dialog State
  const [editingService, setEditingService] = useState<ServiceDTO | null>(null);
  const [configEnabled, setConfigEnabled] = useState(false);
  const [configTestMode, setConfigTestMode] = useState(false);
  const [configMinChunk, setConfigMinChunk] = useState(50);
  const [configMaxChunk, setConfigMaxChunk] = useState(200);
  const [configMarkup, setConfigMarkup] = useState(0.15);

  const [isPending, startTransition] = useTransition();

  // Extract unique platforms/networks for filtering
  const networks = Array.from(
    new Set(services.map(s => s.category?.network?.name).filter(Boolean))
  ).sort() as string[];

  // Handle global kill switch
  const handleGlobalToggle = (checked: boolean) => {
    // Redirection parameter represents if smart drip is disabled
    const targetDisabled = !checked;
    
    startTransition(async () => {
      try {
        const res = await toggleSmartGlobalStatus(targetDisabled);
        if (res.success) {
          setGlobalDisabled(res.disabled);
          toast.success(
            targetDisabled 
              ? 'Умный Dripfeed глобально отключен!' 
              : 'Умный Dripfeed глобально включен!'
          );
        } else {
          toast.error('Не удалось изменить глобальный статус');
        }
      } catch (err: unknown) {
        toast.error((err instanceof Error ? err.message : String(err)) || 'Ошибка выполнения действия');
      }
    });
  };

  // Handle Campaign Status Toggle (Pause/Resume)
  const handleCampaignStatusToggle = (campaignId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'RUNNING' ? 'PAUSED' : 'RUNNING';
    
    startTransition(async () => {
      try {
        const res = await updateCampaignStatus(campaignId, nextStatus);
        if (res.success) {
          setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: nextStatus } : c));
          toast.success(
            nextStatus === 'RUNNING' 
              ? 'Кампания возобновлена' 
              : 'Кампания приостановлена'
          );
        } else {
          toast.error('Не удалось изменить статус кампании');
        }
      } catch (err: unknown) {
        toast.error((err instanceof Error ? err.message : String(err)) || 'Ошибка выполнения действия');
      }
    });
  };

  // Open config modal
  const openConfigModal = (service: ServiceDTO) => {
    setEditingService(service);
    setConfigEnabled(service.smartConfig?.isEnabled || false);
    setConfigTestMode(service.smartConfig?.isTestMode || false);
    setConfigMinChunk(service.smartConfig?.minChunk || 50);
    setConfigMaxChunk(service.smartConfig?.maxChunk || 200);
    setConfigMarkup(service.smartConfig?.markup || 0.15);
  };

  const handleBulkConfigToggle = (enable: boolean) => {
    const targetServiceIds = filteredServices.map(s => s.id);
    if (targetServiceIds.length === 0) return;

    const actionText = enable ? 'ВКЛЮЧИТЬ' : 'ОТКЛЮЧИТЬ';
    if (!window.confirm(`Вы уверены, что хотите массово ${actionText} Dripfeed для всех ${targetServiceIds.length} отфильтрованных услуг?`)) {
      return;
    }

    startTransition(async () => {
      try {
        const res = await bulkUpdateServiceConfigs(targetServiceIds, {
          isEnabled: enable
        });

        if (res.success) {
          setServices(prev => prev.map(s => {
            if (targetServiceIds.includes(s.id)) {
              return {
                ...s,
                smartConfig: s.smartConfig 
                  ? { ...s.smartConfig, isEnabled: enable }
                  : { isEnabled: enable, isTestMode: false, minChunk: 50, maxChunk: 200, markup: 0.15 }
              };
            }
            return s;
          }));

          toast.success(`Массовое действие выполнено! Обновлено услуг: ${res.count}`);
        } else {
          toast.error('Не удалось выполнить массовое обновление настроек');
        }
      } catch (err: unknown) {
        toast.error((err instanceof Error ? err.message : String(err)) || 'Ошибка выполнения массового действия');
      }
    });
  };

  // Save service config
  const saveServiceConfig = () => {
    if (!editingService) return;

    if (configMinChunk <= 0 || configMaxChunk <= 0) {
      toast.error('Размеры чанков должны быть больше нуля');
      return;
    }
    if (configMinChunk > configMaxChunk) {
      toast.error('Минимальный чанк не может быть больше максимального');
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateServiceConfig(editingService.id, {
          isEnabled: configEnabled,
          isTestMode: configTestMode,
          minChunk: configMinChunk,
          maxChunk: configMaxChunk,
          markup: configMarkup
        });

        if (res.success) {
          setServices(prev => prev.map(s => s.id === editingService.id ? { 
            ...s, 
            smartConfig: {
              isEnabled: configEnabled,
              isTestMode: configTestMode,
              minChunk: configMinChunk,
              maxChunk: configMaxChunk,
              markup: configMarkup
            }
          } : s));
          
          toast.success('Настройки услуги успешно сохранены');
          setEditingService(null);
        } else {
          toast.error('Не удалось сохранить настройки');
        }
      } catch (err: unknown) {
        toast.error((err instanceof Error ? err.message : String(err)) || 'Ошибка сохранения настроек');
      }
    });
  };

  // Filter Campaigns
  const filteredCampaigns = campaigns.filter(c => 
    c.userEmail.toLowerCase().includes(campaignSearch.toLowerCase()) ||
    c.serviceName.toLowerCase().includes(campaignSearch.toLowerCase()) ||
    c.link.toLowerCase().includes(campaignSearch.toLowerCase()) ||
    c.id.toLowerCase().includes(campaignSearch.toLowerCase())
  );

  // Filter Services
  const filteredServices = services.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
      s.id.toLowerCase().includes(serviceSearch.toLowerCase());
    const matchesNetwork = selectedNetwork === 'ALL' || s.category?.network?.name === selectedNetwork;
    
    let matchesStatus = true;
    if (selectedStatus === 'ENABLED') {
      matchesStatus = !!s.smartConfig?.isEnabled;
    } else if (selectedStatus === 'DISABLED') {
      matchesStatus = !s.smartConfig?.isEnabled;
    } else if (selectedStatus === 'TEST') {
      matchesStatus = !!s.smartConfig?.isEnabled && !!s.smartConfig?.isTestMode;
    }
    
    return matchesSearch && matchesNetwork && matchesStatus;
  });

  return (
    <div className="w-full space-y-6">
      {/* Global Status Banner / Info */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-3 rounded-2xl border border-border/50 shadow-sm bg-background/60 backdrop-blur-xl">
          <CardContent className="p-6 flex items-center justify-between gap-6 flex-wrap md:flex-nowrap">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${globalDisabled ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success'}`}>
                <Cpu className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-foreground text-base">Глобальный статус модуля</h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                  {globalDisabled 
                    ? 'Внимание! Умный Dripfeed глобально отключен. Запланированные порции заказов не будут обрабатываться воркерами до активации модуля.' 
                    : 'Модуль активен. Воркеры автоматически запускают порции заказов с наступившим временем выполнения в фоновом режиме.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-2xl border border-border/40 select-none">
              <span className={`text-xs font-bold uppercase tracking-wider ${globalDisabled ? 'text-destructive' : 'text-success'}`}>
                {globalDisabled ? 'ОТКЛЮЧЕН' : 'АКТИВЕН'}
              </span>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={!globalDisabled}
                  onChange={(e) => handleGlobalToggle(e.target.checked)}
                  disabled={isPending}
                />
                <div className="w-11 h-6 bg-muted border border-border rounded-full peer peer-focus:ring-2 peer-focus:ring-primary/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-divider after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/50 shadow-sm bg-background/60 backdrop-blur-xl">
          <CardContent className="p-6 flex items-center gap-4 h-full">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Активных кампаний</p>
              <p className="text-2xl font-black text-foreground tabular-nums">
                {campaigns.filter(c => c.status === 'RUNNING').length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Switcher */}
      <div className="flex gap-2 bg-muted/30 p-1 rounded-xl border border-border/40 w-fit">
        <Button 
          intent={activeTab === 'campaigns' ? 'primary' : 'ghost'} 
          onClick={() => setActiveTab('campaigns')}
          className="text-xs font-bold uppercase tracking-widest px-4 py-2 h-9 rounded-lg"
        >
          💼 Кампании Dripfeed
        </Button>
        <Button 
          intent={activeTab === 'configs' ? 'primary' : 'ghost'} 
          onClick={() => setActiveTab('configs')}
          className="text-xs font-bold uppercase tracking-widest px-4 py-2 h-9 rounded-lg"
        >
          ⚙️ Услуги и Тарифы
        </Button>
        <Button 
          intent={activeTab === 'settings' ? 'primary' : 'ghost'} 
          onClick={() => setActiveTab('settings')}
          className="text-xs font-bold uppercase tracking-widest px-4 py-2 h-9 rounded-lg"
        >
          🛡️ Настройки
        </Button>
      </div>

      {/* 💼 CAMPAIGNS TAB */}
      {activeTab === 'campaigns' && (
        <Card className="rounded-2xl border border-border/50 shadow-sm bg-background/60 backdrop-blur-xl">
          <CardHeader className="border-b border-border/50 bg-muted/50 rounded-t-2xl pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-foreground text-sm font-bold uppercase tracking-widest">Кампании Умного Dripfeed</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-1">
                  Мониторинг запущенных кампаний растягивания заказов во времени
                </CardDescription>
              </div>
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Поиск по ссылке, email или услуге..." 
                  className="pl-9 bg-background/80"
                  value={campaignSearch}
                  onChange={(e) => setCampaignSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full">
              <Table aria-label="Список кампаний умного dripfeed" className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[15%] py-4 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ID / Создана</TableHead>
                    <TableHead className="w-[20%] py-4 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Клиент / Услуга</TableHead>
                    <TableHead className="w-[25%] py-4 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ссылка</TableHead>
                    <TableHead className="w-[12%] py-4 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Количество / Дни</TableHead>
                    <TableHead className="w-[15%] py-4 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Прогресс порций</TableHead>
                    <TableHead className="w-[13%] py-4 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                        Активные кампании умного Dripfeed не найдены
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCampaigns.map((c) => (
                      <TableRow key={c.id} className="hover:bg-muted/30 transition-colors duration-150">
                        {/* ID & Date */}
                        <TableCell className="py-4 px-4">
                          <div className="font-mono text-xs font-semibold text-foreground truncate select-all">{c.id}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(c.createdAt).toLocaleString('ru-RU')}
                          </div>
                        </TableCell>

                        {/* Client & Service */}
                        <TableCell className="py-4 px-4">
                          <div className="font-medium text-foreground text-xs truncate max-w-[180px]">{c.userEmail}</div>
                          <div className="text-[10px] text-muted-foreground font-semibold truncate max-w-[180px] mt-0.5">
                            {c.serviceName}
                          </div>
                        </TableCell>

                        {/* Link */}
                        <TableCell className="py-4 px-4 font-mono text-[10px] text-muted-foreground/90 truncate select-all">
                          <a 
                            href={c.link} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="hover:text-primary hover:underline"
                          >
                            {c.link}
                          </a>
                        </TableCell>

                        {/* Qty & Days */}
                        <TableCell className="py-4 px-4 tabular-nums">
                          <div className="font-bold text-foreground text-xs">{c.totalQuantity.toLocaleString('ru-RU')} шт</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{c.totalDays} дней</div>
                        </TableCell>

                        {/* Progress */}
                        <TableCell className="py-4 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-bold text-foreground tabular-nums">{c.progress}%</span>
                              <span className="text-muted-foreground font-medium tabular-nums">{c.completedTasksCount}/{c.tasksCount}</span>
                            </div>
                            <div className="w-full bg-muted/80 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  c.status === 'COMPLETED' ? 'bg-success' : c.status === 'ERROR' ? 'bg-destructive' : 'bg-primary'
                                }`} 
                                style={{ width: `${c.progress}%` }} 
                              />
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Badge 
                                intent={
                                  c.status === 'COMPLETED' ? 'primary' : 
                                  c.status === 'RUNNING' ? 'primary' : 
                                  c.status === 'PAUSED' ? 'secondary' : 'destructive'
                                }
                                className={`font-bold text-[9px] uppercase tracking-wider px-1.5 py-0 ${
                                  c.status === 'COMPLETED' ? 'bg-success/15 text-success border-emerald-500/20' :
                                  c.status === 'RUNNING' ? 'bg-primary/10 text-primary border-primary/20' :
                                  c.status === 'PAUSED' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'
                                }`}
                              >
                                {c.status === 'COMPLETED' ? 'Завершено' :
                                 c.status === 'RUNNING' ? 'Выполняется' :
                                 c.status === 'PAUSED' ? 'Пауза' :
                                 c.status === 'PLANNED' ? 'Запланировано' : 'Сбой'}
                              </Badge>
                              {c.isTestMode && (
                                <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 font-bold text-[9px]">TEST</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-4 px-4 text-right">
                          {c.status !== 'COMPLETED' && c.status !== 'ERROR' && (
                            <Button
                              intent={c.status === 'RUNNING' ? 'outline' : 'primary'}
                              size="sm"
                              className="h-8 text-xs font-bold"
                              onClick={() => handleCampaignStatusToggle(c.id, c.status)}
                              disabled={isPending}
                            >
                              {c.status === 'RUNNING' ? (
                                <>
                                  <Pause className="w-3.5 h-3.5 mr-1" /> Приостановить
                                </>
                              ) : (
                                <>
                                  <Play className="w-3.5 h-3.5 mr-1" /> Возобновить
                                </>
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ⚙️ CONFIGS TAB */}
      {activeTab === 'configs' && (
        <Card className="rounded-2xl border border-border/50 shadow-sm bg-background/60 backdrop-blur-xl">
          <CardHeader className="border-b border-border/50 bg-muted/50 rounded-t-2xl pb-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-foreground text-sm font-bold uppercase tracking-widest">Услуги и Тарифы Dripfeed</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-1">
                  Настройка тарифов, лимитов и наценок за умное постепенное распределение заказов
                </CardDescription>
              </div>
              <div className="flex flex-wrap md:flex-nowrap gap-3 items-center w-full lg:max-w-2xl justify-end">
                <select 
                  className="bg-background border border-input rounded-lg text-xs font-bold px-3 h-11 text-foreground select-none focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  value={selectedNetwork}
                  onChange={(e) => setSelectedNetwork(e.target.value)}
                >
                  <option value="ALL">Все сети</option>
                  {networks.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <select 
                  className="bg-background border border-input rounded-lg text-xs font-bold px-3 h-11 text-foreground select-none focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="ALL">Все статусы</option>
                  <option value="ENABLED">Включен Dripfeed</option>
                  <option value="DISABLED">Отключен Dripfeed</option>
                  <option value="TEST">В тестовом режиме</option>
                </select>
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Поиск услуги по названию или ID..." 
                    className="pl-9 bg-background/80"
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            {/* Bulk Actions Panel */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4 border-t border-border/40 pt-4">
              <div className="flex items-center gap-3 bg-muted/40 p-2.5 rounded-xl border border-border/40 w-fit select-none">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1.5">
                  Массовые действия ({filteredServices.length} услуг отфильтровано):
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    intent="primary"
                    size="sm"
                    className="h-8 text-[11px] font-extrabold bg-success hover:bg-success/90 text-success-foreground rounded-lg flex items-center shadow-sm"
                    onClick={() => handleBulkConfigToggle(true)}
                    disabled={isPending || filteredServices.length === 0}
                  >
                    ⚡ Массово Включить
                  </Button>
                  <Button
                    intent="outline"
                    size="sm"
                    className="h-8 text-[11px] font-extrabold text-destructive border-destructive/20 hover:bg-destructive/10 rounded-lg flex items-center shadow-sm"
                    onClick={() => handleBulkConfigToggle(false)}
                    disabled={isPending || filteredServices.length === 0}
                  >
                    🛑 Массово Отключить
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full">
              <Table aria-label="Конфигурация умного dripfeed для услуг" className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[12%] py-4 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Сеть / Категория</TableHead>
                    <TableHead className="w-[30%] py-4 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Услуга</TableHead>
                    <TableHead className="w-[13%] py-4 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Smart Drip Status</TableHead>
                    <TableHead className="w-[15%] py-4 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Лимиты чанка (min/max)</TableHead>
                    <TableHead className="w-[15%] py-4 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Умная наценка (+%)</TableHead>
                    <TableHead className="w-[15%] py-4 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">Настройки</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                        Услуги не найдены
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredServices.map((s) => (
                      <TableRow key={s.id} className="hover:bg-muted/30 transition-colors duration-150">
                        {/* Network / Category */}
                        <TableCell className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            {s.category?.network?.slug && <SocialIcon slug={s.category.network.slug} size={16} />}
                            <span className="font-semibold text-foreground text-xs">{s.category?.network?.name || 'Без сети'}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[120px] mt-0.5">
                            {s.category?.name || 'Без категории'}
                          </div>
                        </TableCell>

                        {/* Name */}
                        <TableCell className="py-4 px-4">
                          <div className="font-semibold text-foreground text-xs leading-relaxed max-w-[320px] truncate" title={s.name}>
                            {s.name}
                          </div>
                          <div className="font-mono text-[9px] text-muted-foreground mt-0.5 select-all">
                            ID: {s.id}
                          </div>
                        </TableCell>

                        {/* Drip Status */}
                        <TableCell className="py-4 px-4">
                          <Badge 
                            intent={s.smartConfig?.isEnabled ? 'primary' : 'secondary'}
                            className={`font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 ${
                              s.smartConfig?.isEnabled 
                                ? 'bg-success/15 text-success border-emerald-500/20' 
                                : 'bg-muted text-muted-foreground border-border'
                            }`}
                          >
                            {s.smartConfig?.isEnabled ? 'ПОДДЕРЖИВАЕТСЯ' : 'ОТКЛЮЧЕН'}
                          </Badge>
                          {s.smartConfig?.isEnabled && s.smartConfig.isTestMode && (
                            <div className="mt-1">
                              <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 font-bold text-[9px]">TEST MODE</Badge>
                            </div>
                          )}
                        </TableCell>

                        {/* Limits */}
                        <TableCell className="py-4 px-4 font-mono text-xs tabular-nums text-foreground">
                          {s.smartConfig?.isEnabled ? (
                            <div className="font-bold">
                              {s.smartConfig.minChunk} - {s.smartConfig.maxChunk} шт
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Markup */}
                        <TableCell className="py-4 px-4 font-bold text-xs text-foreground">
                          {s.smartConfig?.isEnabled ? (
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20 tabular-nums">
                              +{Math.round(s.smartConfig.markup * 100)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-4 px-4 text-right">
                          <Button
                            intent="outline"
                            size="sm"
                            className="h-8 text-xs font-bold"
                            onClick={() => openConfigModal(s)}
                          >
                            <Sliders className="w-3.5 h-3.5 mr-1" /> Настроить
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 🛡️ SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="rounded-2xl border border-border/50 shadow-sm bg-background/60 backdrop-blur-xl">
            <CardHeader className="border-b border-border/50 bg-muted/50 rounded-t-2xl pb-4">
              <CardTitle className="text-foreground text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning animate-pulse" />
                Экстренные меры / Kill-Switch
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Глобальный выключатель фоновой логистики постепенных доставок
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between gap-6 p-4 bg-muted/30 rounded-2xl border border-border/40">
                <div className="space-y-1">
                  <span className="font-bold text-xs text-foreground uppercase tracking-wide">Глобальный выключатель</span>
                  <p className="text-[11px] text-muted-foreground max-w-xs">
                    Мгновенно останавливает отправку всех порций dripfeed воркерами. Ранее созданные кампании будут заморожены.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold ${globalDisabled ? 'text-destructive' : 'text-success'}`}>
                    {globalDisabled ? 'ЗАМОРОЖЕН' : 'АКТИВЕН'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={!globalDisabled}
                      onChange={(e) => handleGlobalToggle(e.target.checked)}
                      disabled={isPending}
                    />
                    <div className="w-11 h-6 bg-muted border border-border rounded-full peer peer-focus:ring-2 peer-focus:ring-primary/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-divider after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground/80 leading-relaxed bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl space-y-2">
                <div className="font-bold text-amber-700 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Когда использовать Kill-Switch:
                </div>
                <ul className="list-disc pl-4 space-y-1.5">
                  <li>При резких скачках балансов на панели, намекающих на фрод или баг.</li>
                  <li>При массовом падении API ключевых внешних SMM провайдеров.</li>
                  <li>Во время проведения технических работ на основном ядре системы.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Config Dialog Component */}
      <Dialog open={editingService !== null} onOpenChange={(open) => !open && setEditingService(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl border border-border bg-background shadow-2xl p-6">
          <DialogHeader className="pb-3 border-b border-border/50">
            <DialogTitle className="text-foreground font-black text-base flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Умный Dripfeed: {editingService?.category?.network?.name || 'Без сети'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingService?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-3">
            {/* Enabled toggle */}
            <div className="flex items-center justify-between p-3.5 bg-muted/40 rounded-xl border border-border/40 select-none">
              <div className="space-y-0.5">
                <span className="font-bold text-xs text-foreground uppercase tracking-wide">Поддержка Dripfeed</span>
                <p className="text-[10px] text-muted-foreground">Активировать возможность растягивания заказа</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={configEnabled}
                  onChange={(e) => setConfigEnabled(e.target.checked)}
                />
                <div className="w-11 h-6 bg-muted/80 border border-border rounded-full peer peer-focus:ring-2 peer-focus:ring-primary/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-divider after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Test Mode toggle */}
            <div className="flex items-center justify-between p-3.5 bg-muted/40 rounded-xl border border-border/40 select-none">
              <div className="space-y-0.5">
                <span className="font-bold text-xs text-foreground uppercase tracking-wide">Тестовый режим (Mock)</span>
                <p className="text-[10px] text-muted-foreground">Заказы не будут уходить провайдерам, а имитируются</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={configTestMode}
                  onChange={(e) => setConfigTestMode(e.target.checked)}
                />
                <div className="w-11 h-6 bg-muted/80 border border-border rounded-full peer peer-focus:ring-2 peer-focus:ring-primary/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-divider after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Limits form */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Минимальный чанк</label>
                <Input 
                  type="number" 
                  className="bg-background font-mono text-sm tabular-nums" 
                  value={configMinChunk}
                  onChange={(e) => setConfigMinChunk(Number(e.target.value))}
                  disabled={!configEnabled}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Максимальный чанк</label>
                <Input 
                  type="number" 
                  className="bg-background font-mono text-sm tabular-nums" 
                  value={configMaxChunk}
                  onChange={(e) => setConfigMaxChunk(Number(e.target.value))}
                  disabled={!configEnabled}
                />
              </div>
            </div>

            {/* Surcharge Markup */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                <span className="text-muted-foreground">Умная наценка за постепенность</span>
                <span className="text-primary tabular-nums">+{Math.round(configMarkup * 100)}%</span>
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  className="w-full accent-primary bg-muted rounded-lg appearance-none h-1.5 cursor-pointer"
                  value={configMarkup}
                  onChange={(e) => setConfigMarkup(Number(e.target.value))}
                  disabled={!configEnabled}
                />
              </div>
              <p className="text-[9px] text-muted-foreground">
                Эта наценка автоматически добавится к розничной стоимости заказа для клиента при выборе Smart Dripfeed.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6 pt-4 border-t border-border/50">
            <DialogClose render={<Button intent="outline" className="text-xs h-9 font-semibold">Отмена</Button>}>
            </DialogClose>
            <Button 
              intent="primary" 
              className="text-xs h-9 font-semibold"
              onClick={saveServiceConfig}
              disabled={isPending}
            >
              {isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
