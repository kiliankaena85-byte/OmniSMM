'use client';
// audit-disable STR-002

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Copy, CheckCircle2, ChevronDown, ChevronUp, Trash2, ArrowRight, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMultiOrderEngine } from '@/hooks/useMultiOrderEngine';
import { IntelligencePlatform } from '@/services/analyzer/link-rules';
import { formatCents } from '@/lib/utils';
import { PublicCategory } from '@/actions/order/catalog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { extractLinks, detectPlatformLite } from '@/utils/link-extractor';
import { SocialIcon } from '@/components/ui/SocialIcon';
import { formatPricePerUnit } from '@/utils/format-price';

export function UniversalOrderForm({ 
  userBalanceCents = 0, 
  userEmail = "", 
  initialText = "", 
  onEmpty,
  initialReorderData
}: { 
  userBalanceCents?: number; 
  userEmail?: string; 
  initialText?: string; 
  onEmpty?: () => void;
  initialReorderData?: { serviceId: string; categoryId: string; link: string; quantity: number } | null;
}) {
  const engine = useMultiOrderEngine();
  const [inputText, setInputText] = useState(initialText);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gateway, setGateway] = useState<'yookassa' | 'cryptobot' | 'balance'>('yookassa');
  const [formEmail, setFormEmail] = useState(userEmail || "");

  // Auto-expand the first "new" task if none is expanded
  useEffect(() => {
    if (engine.tasks.length > 0 && !expandedTaskId) {
      const firstNew = engine.tasks.find(t => t.status === 'new');
      if (firstNew) {
        setExpandedTaskId(firstNew.id);
      }
    }
  }, [engine.tasks, expandedTaskId]);

  const prevTasksLengthRef = useRef(engine.tasks.length);
  useEffect(() => {
    // If tasks transition from >0 to 0, call onEmpty
    if (prevTasksLengthRef.current > 0 && engine.tasks.length === 0) {
      if (onEmpty) onEmpty();
    }
    prevTasksLengthRef.current = engine.tasks.length;
  }, [engine.tasks.length, onEmpty]);

  useEffect(() => {
    if (initialText) {
      engine.addLinks(initialText);
      setInputText("");
    }
  }, [engine, initialText]);

  const hasLoadedReorder = useRef(false);
  useEffect(() => {
    if (initialReorderData && !hasLoadedReorder.current) {
      hasLoadedReorder.current = true;
      engine.loadReorderTask(initialReorderData);
    }
  }, [engine, initialReorderData]);

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (text.includes('http') || text.includes('t.me') || text.includes('vk.com')) {
      e.preventDefault();
      engine.addLinks(text);
      setInputText("");
    }
  };

  const handleAddClick = () => {
    engine.addLinks(inputText);
    setInputText("");
  };

  const handleCheckout = async () => {
    if (!formEmail || !formEmail.includes('@')) {
      toast.error('Пожалуйста, укажите email для получения чека');
      return;
    }
    if (!engine.stats.isReadyToPay) {
      toast.error('Пожалуйста, настройте все добавленные ссылки перед оплатой');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { structuredMassOrderCheckoutAction } = await import('@/actions/order/mass');
      const validTasks = engine.tasks.filter(t => t.status === 'configured' && t.serviceId);
      
      const res = await structuredMassOrderCheckoutAction({
        orders: validTasks.map(t => ({
          serviceId: t.serviceId!,
          link: t.url,
          quantity: t.quantity
        })),
        email: formEmail,
        gateway,
        idempotencyKey: `form-order-${formEmail}-${validTasks.map(t => `${t.serviceId}_${t.quantity}`).join('-')}`,
        expectedTotalRub: engine.stats.totalCents / 100
      });

      if (!res || !res.success) {
        throw new Error(!res ? "Ошибка при создании заказа" : res.error);
      }

      if (res.data.paymentUrl) {
        window.location.href = res.data.paymentUrl;
      } else {
        window.location.href = `/dashboard?paymentId=${res.data.paymentId}`;
      }
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : String(e)) || "Ошибка при оплате");
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time link parsing stats
  const parsedLinks = extractLinks(inputText);
  const parsedStats = parsedLinks.reduce((acc, link) => {
    const platform = detectPlatformLite(link);
    acc[platform] = (acc[platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (engine.catalog.length === 0) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[350px] border border-border bg-card/45 backdrop-blur-md rounded-[2.5rem] p-8 text-center space-y-5 overflow-hidden shadow-2xl">
        {/* Decorative background gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-48 h-48 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-48 h-48 rounded-full bg-amber-500/5 blur-3xl" />
        
        <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
          <Loader2 className="w-9 h-9 animate-spin text-primary" />
        </div>
        <div className="space-y-2 max-w-sm relative z-10">
          <h3 className="text-lg font-black text-foreground uppercase tracking-widest leading-none">Загрузка каталога</h3>
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            Подготавливаем актуальные платформы, категории и тарифы для оформления заказа...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32">
      {/* Smart Dropzone */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-amber-500/10 rounded-3xl blur opacity-30 group-hover:opacity-40 transition duration-500"></div>
        <div className="relative bg-card border border-border/60 rounded-3xl p-5 shadow-lg shadow-black/5 ring-1 ring-black/5 flex flex-col gap-3">
           <textarea
              id="order-url"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                 if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (inputText.trim()) handleAddClick();
                 }
              }}
              placeholder="Вставьте ссылку или сразу несколько (до 50 шт)"
              className="w-full min-h-[90px] bg-transparent resize-none outline-none text-foreground text-sm font-medium placeholder:text-muted-foreground/60 focus:ring-0"
           />
           {parsedLinks.length > 0 && (
             <div className="flex flex-wrap items-center gap-1.5 p-3 bg-muted/40 rounded-2xl border border-border/40 animate-in fade-in slide-in-from-top-1">
               <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">Будет добавлено:</span>
               {Object.entries(parsedStats).map(([platform, count]) => (
                 <div key={platform} className="inline-flex items-center gap-1 px-2 py-0.5 bg-background border border-border/80 rounded-full text-xs font-semibold text-foreground shadow-sm">
                   <SocialIcon slug={platform} size={12} className="shrink-0" />
                   <span className="text-[11px]">{platform === 'OTHER' ? 'Прочее' : platform}</span>
                   <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                     {count}
                   </span>
                 </div>
               ))}
             </div>
           )}
           <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
                 <Wand2 className="w-3.5 h-3.5 text-primary" />
                 Система автоматически распознает все ссылки из вашего текста
              </div>
              <button 
                 onClick={handleAddClick}
                 disabled={!inputText.trim()}
                 className="h-9 px-4 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
              >
                 + Добавить
              </button>
           </div>
        </div>
      </div>

      {/* Accordion Tasks */}
      <div className="space-y-3">
        {engine.tasks.map((task, index) => {
           const isExpanded = expandedTaskId === task.id;
           const isConfigured = task.status === 'configured';
           
           // Derived platform logic for display
           let platformName = task.platform.toString();
           const net = engine.catalog.find(n => n.slug.toLowerCase().includes(task.platform.toLowerCase()));
           if (net) platformName = net.name;

           return (
             <div 
               key={task.id} 
               className={`rounded-2xl border transition-all duration-300 animate-in slide-in-from-top-4 fade-in fill-mode-both ${
                 isExpanded 
                   ? 'border-primary ring-2 ring-primary/10 shadow-xl bg-card z-10 relative' 
                   : isConfigured 
                     ? 'border-border/60 bg-card hover:bg-muted/15 shadow-sm opacity-90' 
                     : 'border-border/80 bg-card hover:border-primary/40 hover:shadow-md transition-shadow'
               }`}
               style={{ animationDelay: `${index * 50}ms`, animationDuration: '400ms' }}
             >
                
                 {/* Header */}
                 <div 
                    onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                    className="p-4 flex items-center justify-between cursor-pointer select-none"
                 >
                    <div className="flex items-center gap-3 overflow-hidden">
                       {isConfigured ? (
                          <div className="w-6 h-6 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                       ) : (
                          <div className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {index + 1}
                          </div>
                       )}
                       <div className="truncate min-w-0">
                          <div className="font-semibold text-sm text-foreground truncate flex items-center gap-2 min-w-0">
                             <SocialIcon slug={task.platform} size={14} className="shrink-0" />
                             <span className="truncate min-w-0">{task.cleanTitle}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1 flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
                             {isConfigured ? (
                                <>
                                   <span className="text-success font-bold">Настроено</span>
                                   <span className="text-muted-foreground/30">•</span>
                                   <span className="text-foreground/80 truncate max-w-[150px] sm:max-w-[250px] min-w-0">
                                     {task.availableServices.find(s => s.id === task.serviceId)?.name || 'Тариф настроен'}
                                   </span>
                                   <span className="text-muted-foreground/30">•</span>
                                   <span className="font-bold text-foreground tabular-nums bg-muted px-1.5 py-0.5 rounded">
                                     {task.quantity.toLocaleString('ru-RU')} шт.
                                   </span>
                                   <span className="text-muted-foreground/30">•</span>
                                   <span className="font-bold text-primary tabular-nums">{formatCents(task.priceCents)} ₽</span>
                                </>
                             ) : (
                                <span className="text-amber-600 dark:text-amber-400 font-bold">Ожидает настройки ({platformName})</span>
                             )}
                          </div>
                       </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                       <button 
                          onClick={(e) => { e.stopPropagation(); engine.removeTask(task.id); }}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                          title="Удалить ссылку"
                          type="button"
                       >
                          <Trash2 className="w-4 h-4" />
                       </button>
                       {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                 </div>

                 {/* Body */}
                 {isExpanded && (
                    <div className="px-4 pb-4 animate-in slide-in-from-top-2">
                       <div className="pt-4 border-t border-border/50 space-y-4">
                          {/* Platform & Category Selectors */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Платформа</label>
                                <Select 
                                    value={net ? net.id : ""}
                                    onValueChange={(val) => {
                                       if (!val) return;
                                       const selectedNet = engine.catalog.find(n => n.id === val);
                                       if (selectedNet) {
                                          const catId = selectedNet.categories[0]?.id || "";
                                          engine.updateTask(task.id, { 
                                             platform: (selectedNet.name.toUpperCase().includes("TELEGRAM") ? IntelligencePlatform.TELEGRAM : 
                                                       selectedNet.name.toUpperCase().includes("VK") ? IntelligencePlatform.VK : 
                                                       selectedNet.name.toUpperCase().includes("INSTAGRAM") ? IntelligencePlatform.INSTAGRAM : 
                                                       IntelligencePlatform.OTHER) as IntelligencePlatform,
                                             categoryId: catId, 
                                             serviceId: "", 
                                             status: 'new',
                                             priceCents: 0,
                                             availableServices: [],
                                             isLoadingServices: !!catId
                                          });
                                       }
                                    }}
                                 >
                                    <SelectTrigger className="w-full h-12 bg-background border border-border/80 hover:border-primary hover:bg-muted/5 rounded-2xl text-sm font-semibold transition-all focus:ring-2 focus:ring-primary/15">
                                       <SelectValue placeholder="Выберите платформу">
                                          {(value: string) => {
                                             if (!value) return null;
                                             return engine.catalog.find(n => n.id === value)?.name ?? value;
                                          }}
                                       </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                       {engine.catalog.map(n => (
                                          <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                             </div>
                             
                             {net && (
                                <div className="space-y-1.5">
                                   <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Категория</label>
                                   <Select 
                                      value={task.categoryId}
                                      onValueChange={(val) => {
                                         if (!val) return;
                                       engine.updateTask(task.id, { 
                                          categoryId: val, 
                                          serviceId: "", 
                                          status: 'new',
                                          priceCents: 0,
                                          availableServices: [],
                                          isLoadingServices: true 
                                       });
                                      }}
                                   >
                                      <SelectTrigger className="w-full h-12 bg-background border border-border/80 hover:border-primary hover:bg-muted/5 rounded-2xl text-sm font-semibold transition-all focus:ring-2 focus:ring-primary/15">
                                         <SelectValue placeholder="Выберите категорию">
                                            {(value: string) => {
                                               if (!value) return null;
                                               return net.categories.find((c: PublicCategory) => c.id === value)?.name ?? value;
                                            }}
                                         </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                         {net.categories.map((c: PublicCategory) => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                         ))}
                                      </SelectContent>
                                   </Select>
                                </div>
                             )}
                          </div>

                          {/* Service Selector */}
                          <div className="space-y-1.5">
                             <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Услуга</label>
                             {task.isLoadingServices ? (
                                <div className="h-12 flex items-center justify-center bg-muted/30 rounded-2xl border border-border/50">
                                   <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                </div>
                             ) : (
                                <Select
                                   value={task.serviceId}
                                   onValueChange={(val) => {
                                      if (!val) return;
                                      const svc = task.availableServices.find(s => s.id === val);
                                      if (svc) {
                                         engine.setTaskConfig(task.id, svc.id, Math.max(task.quantity, svc.minQty), svc.pricePerUnitRub);
                                      }
                                   }}
                                >
                                   <SelectTrigger className="w-full h-12 bg-background border border-border/80 hover:border-primary hover:bg-muted/5 rounded-2xl text-sm font-semibold transition-all focus:ring-2 focus:ring-primary/15">
                                      <SelectValue placeholder="-- Выберите услугу --">
                                         {(value: string) => {
                                            if (!value) return "-- Выберите услугу --";
                                            const s = task.availableServices.find(srv => srv.id === value);
                                            if (!s) return value;
                                            const isCooledDown = !!(s.cooldownUntil && new Date(s.cooldownUntil) > new Date());
                                            return `${s.name} (${formatPricePerUnit(s.pricePerUnitRub)} ₽/шт)${isCooledDown ? ' [временно недоступно]' : ''}`;
                                         }}
                                      </SelectValue>
                                   </SelectTrigger>
                                    <SelectContent>
                                       {task.availableServices.map(s => {
                                          const isCooledDown = !!(s.cooldownUntil && new Date(s.cooldownUntil) > new Date());
                                          return (
                                             <SelectItem key={s.id} value={s.id} disabled={isCooledDown}>
                                                {s.name} ({formatPricePerUnit(s.pricePerUnitRub)} ₽/шт){isCooledDown ? ' [временно недоступно]' : ''}
                                             </SelectItem>
                                          );
                                       })}
                                    </SelectContent>
                                </Select>
                             )}
                          </div>

                          {/* Quantity Input */}
                          <div className="space-y-1.5">
                             <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Количество</label>
                             <div className="flex items-center gap-2">
                                <button
                                   type="button"
                                   onClick={() => {
                                      const svc = task.availableServices.find(s => s.id === task.serviceId);
                                      const minQty = svc?.minQty || 10;
                                      const currentVal = task.quantity || minQty;
                                      const newVal = Math.max(minQty, currentVal - 100);
                                      engine.setTaskConfig(task.id, task.serviceId, newVal, svc?.pricePerUnitRub || 0);
                                   }}
                                   disabled={!task.serviceId}
                                   className="w-14 h-12 flex items-center justify-center bg-muted border border-border/60 hover:bg-muted/80 disabled:opacity-40 disabled:pointer-events-none rounded-2xl text-xs font-black text-foreground transition-all active:scale-90 shrink-0 cursor-pointer select-none"
                                   title="Уменьшить на 100"
                                >
                                   -100
                                </button>
                                
                                 <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={task.quantity || ''}
                                    onChange={(e) => {
                                       const raw = e.target.value.replace(/\D/g, '');
                                       const val = raw ? parseInt(raw, 10) : 0;
                                       const svc = task.availableServices.find(s => s.id === task.serviceId);
                                       engine.setTaskConfig(task.id, task.serviceId, val, svc?.pricePerUnitRub || 0);
                                    }}
                                    onFocus={(e) => {
                                      const target = e.currentTarget;
                                      setTimeout(() => target.select(), 10);
                                    }}
                                    onClick={(e) => {
                                      const target = e.currentTarget;
                                      setTimeout(() => target.select(), 10);
                                    }}
                                    className="flex-1 h-12 px-4 bg-background border border-border/80 hover:border-primary rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/15 transition-all shadow-sm text-center tabular-nums"
                                 />

                                <button
                                   type="button"
                                   onClick={() => {
                                      const svc = task.availableServices.find(s => s.id === task.serviceId);
                                      const minQty = svc?.minQty || 10;
                                      const currentVal = task.quantity || minQty;
                                      const newVal = currentVal + 100;
                                      engine.setTaskConfig(task.id, task.serviceId, newVal, svc?.pricePerUnitRub || 0);
                                   }}
                                   disabled={!task.serviceId}
                                   className="w-14 h-12 flex items-center justify-center bg-muted border border-border/60 hover:bg-muted/80 disabled:opacity-40 disabled:pointer-events-none rounded-2xl text-xs font-black text-foreground transition-all active:scale-90 shrink-0 cursor-pointer select-none"
                                   title="Увеличить на 100"
                                >
                                   +100
                                </button>
                             </div>
                          </div>

                          {/* Actions */}
                          <div className="pt-2 flex flex-col sm:flex-row gap-2">
                             {task.serviceId && engine.tasks.filter(t => t.id !== task.id && t.platform === task.platform && t.status === 'new').length > 0 && (
                                <button
                                   onClick={() => {
                                      engine.applyToAllSamePlatform(task.id);
                                      setExpandedTaskId(null);
                                   }}
                                   className="h-11 w-full bg-secondary/80 text-secondary-foreground font-extrabold text-xs rounded-xl hover:bg-secondary transition-all flex items-center justify-center gap-2 active:scale-98 shadow-sm cursor-pointer"
                                >
                                   <Copy className="w-4 h-4 shrink-0" />
                                   Применить ко всем ссылкам {platformName}
                                </button>
                             )}
                             <button
                                onClick={() => {
                                   const nextUnconfigured = engine.tasks.find(t => t.id !== task.id && t.status === 'new');
                                   setExpandedTaskId(nextUnconfigured ? nextUnconfigured.id : null);
                                }}
                                disabled={!task.serviceId || task.quantity <= 0}
                                className="h-11 w-full bg-primary hover:bg-primary/95 text-primary-foreground font-extrabold text-sm rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:pointer-events-none active:scale-98 cursor-pointer"
                             >
                                Готово
                             </button>
                          </div>
                       </div>
                    </div>
                 )}
             </div>
           );
        })}
      </div>

      {/* Sticky Checkout Footer */}
      {engine.stats.totalTasks > 0 && (
         <div className="fixed bottom-0 left-0 w-full bg-background/90 backdrop-blur-xl border-t border-border/80 p-5 z-50 md:sticky md:bottom-4 md:rounded-3xl md:border md:border-border/60 md:shadow-2xl md:ring-1 md:ring-black/5 space-y-4 animate-in slide-in-from-bottom-5 duration-300">
            
            {error && (
              <div className="bg-destructive/10 border border-rose-500/20 text-destructive text-sm p-3 rounded-xl">
                {error}
              </div>
            )}

            {/* Email and Gateway settings (only shown when ready to pay) */}
            {engine.stats.isReadyToPay && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="space-y-1.5">
                     <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Email (для чека и статуса)</label>
                     <input
                        type="email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder="Ваш email"
                        className="w-full h-12 px-4 bg-background border border-border/80 hover:border-primary rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/15 transition-all shadow-sm"
                     />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Способ оплаты</label>
                      <Select
                         value={gateway}
                         onValueChange={(val) => {
                           if (val) setGateway(val as 'yookassa' | 'cryptobot' | 'balance');
                         }}
                      >
                         <SelectTrigger className="w-full h-12 bg-background border border-border/80 hover:border-primary rounded-2xl text-sm font-semibold transition-all focus:ring-2 focus:ring-primary/15 shadow-sm">
                            <SelectValue placeholder="Выберите способ оплаты">
                               {(value: string) => {
                                  if (value === 'yookassa') return 'Банковская карта (РФ) / СБП';
                                  if (value === 'cryptobot') return 'CryptoBot (USDT / TON)';
                                  if (value === 'balance') return `Баланс (${formatCents(userBalanceCents)} ₽)`;
                                  return value;
                               }}
                            </SelectValue>
                         </SelectTrigger>
                         <SelectContent>
                            <SelectItem value="yookassa">Банковская карта (РФ) / СБП</SelectItem>
                            <SelectItem value="cryptobot">CryptoBot (USDT / TON)</SelectItem>
                            {userBalanceCents >= engine.stats.totalCents && (
                              <SelectItem value="balance">Баланс ({formatCents(userBalanceCents)} ₽)</SelectItem>
                            )}
                         </SelectContent>
                      </Select>
                   </div>
               </div>
            )}

            <div className="max-w-2xl mx-auto flex items-center justify-between gap-4 border-t border-border/50 pt-3 md:pt-0 md:border-none mt-2 md:mt-0">
               <div>
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                     Настроено {engine.stats.configuredTasks} из {engine.stats.totalTasks}
                  </div>
                  <div className="text-2xl font-black tabular-nums text-foreground">
                     {formatCents(engine.stats.totalCents)} ₽
                  </div>
               </div>
               
               <button
                  disabled={isLoading}
                  onClick={handleCheckout}
                  className={`h-12 px-8 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                     engine.stats.isReadyToPay && formEmail
                     ? 'bg-primary text-primary-foreground hover:scale-105 active:scale-95 hover:shadow-lg' 
                     : 'bg-primary/80 text-primary-foreground/90 hover:bg-primary'
                  } disabled:opacity-50`}
               >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Оплатить'} <ArrowRight className="w-4 h-4" />
               </button>
            </div>
         </div>
      )}
    </div>
  );
}
