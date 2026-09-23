'use client';

import React, { useState, useTransition } from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SocialIcon } from '@/components/ui/SocialIcon';
import { toast } from 'sonner';
import { toggleClientCampaignStatus } from '@/actions/order/smart';
import { 
  Pause, 
  Play, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';

export interface TaskDTO {
  id: string;
  quantity: number;
  runAt: Date;
  status: 'PLANNED' | 'SENT' | 'COMPLETED' | 'ERROR';
  error: string | null;
  externalOrderId: string | null;
  execStatus: string | null;
}

export interface CampaignDTO {
  id: string;
  serviceName: string;
  networkSlug: string;
  networkName: string;
  link: string;
  totalQuantity: number;
  totalDays: number;
  status: 'PLANNED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ERROR';
  createdAt: Date;
  progress: number;
  tasks: TaskDTO[];
}

interface SmartDripDashboardClientProps {
  initialCampaigns: CampaignDTO[];
}

export function SmartDripDashboardClient({ initialCampaigns }: SmartDripDashboardClientProps) {
  const [campaigns, setCampaigns] = useState<CampaignDTO[]>(initialCampaigns);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  
  const [isPending, startTransition] = useTransition();

  const handleToggleStatus = (campaignId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'RUNNING' ? 'PAUSED' : 'RUNNING';
    
    startTransition(async () => {
      try {
        const res = await toggleClientCampaignStatus(campaignId, nextStatus);
        if (res.success) {
          setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: nextStatus } : c));
          toast.success(
            nextStatus === 'RUNNING' 
              ? 'Кампания успешно возобновлена' 
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

  const toggleExpand = (campaignId: string) => {
    setExpandedCampaignId(prev => prev === campaignId ? null : campaignId);
  };

  const filtered = campaigns.filter(c => 
    c.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.link.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Поиск по тарифу, ссылке или ID..." 
          className="pl-10 h-11 bg-card border-border/80 text-foreground"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Campaigns list */}
      {filtered.length === 0 ? (
        <Card className="rounded-2xl border border-border/50 shadow-sm bg-card p-12 text-center">
          <p className="text-muted-foreground text-sm font-medium">
            У вас пока нет активных или завершенных кампаний умного Dripfeed
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((c) => {
            const isExpanded = expandedCampaignId === c.id;

            return (
              <Card key={c.id} className="rounded-2xl border border-border shadow-xs bg-card overflow-hidden transition-all duration-300">
                <CardContent className="p-0">
                  {/* Campaign summary card header */}
                  <div 
                    onClick={() => toggleExpand(c.id)}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-muted/30 transition-colors select-none"
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="shrink-0 mt-0.5">
                        <SocialIcon slug={c.networkSlug} size={22} />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-sm leading-tight truncate">
                            {c.serviceName}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            (ID: {c.id})
                          </span>
                        </div>
                        <a 
                          href={c.link} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] text-muted-foreground hover:text-primary hover:underline font-mono truncate block max-w-[320px] md:max-w-md"
                        >
                          {c.link}
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 flex-wrap md:flex-nowrap justify-between md:justify-end shrink-0">
                      {/* Qty & Period */}
                      <div className="text-left md:text-right">
                        <div className="font-extrabold text-foreground text-xs leading-none">
                          {c.totalQuantity.toLocaleString('ru-RU')} шт
                        </div>
                        <div className="text-[10px] text-muted-foreground font-semibold mt-1">
                          растянуто на {c.totalDays} дней
                        </div>
                      </div>

                      {/* Progress Bar & Status */}
                      <div className="w-[140px] space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-foreground">{c.progress}%</span>
                          <span className="text-muted-foreground font-medium">
                            {c.tasks.filter(t => t.status === 'COMPLETED').length}/{c.tasks.length}
                          </span>
                        </div>
                        <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
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
                              c.status === 'COMPLETED' ? 'bg-success/10 text-emerald-800 dark:text-success border-emerald-500/20' :
                              c.status === 'RUNNING' ? 'bg-primary/10 text-blue-800 dark:text-primary border-primary/20' :
                              c.status === 'PAUSED' ? 'bg-amber-500/10 text-amber-800 dark:text-warning border-amber-500/20' : 'bg-destructive/10 text-red-800 dark:text-destructive border-destructive/20'
                            }`}
                          >
                            {c.status === 'COMPLETED' ? 'Завершено' :
                             c.status === 'RUNNING' ? 'Активна' :
                             c.status === 'PAUSED' ? 'Пауза' :
                             c.status === 'PLANNED' ? 'В очереди' : 'Сбой'}
                          </Badge>
                        </div>
                      </div>

                      {/* Expand & Pause Actions */}
                      <div className="flex items-center gap-2">
                        {c.status !== 'COMPLETED' && c.status !== 'ERROR' && (
                          <Button
                            intent={c.status === 'RUNNING' ? 'outline' : 'primary'}
                            size="icon"
                            className="shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(c.id, c.status);
                            }}
                            disabled={isPending}
                          >
                            {c.status === 'RUNNING' ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        <div className="p-1 hover:bg-muted rounded-lg text-muted-foreground transition-colors shrink-0">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Campaign breakdown tasks list details */}
                  {isExpanded && (
                    <div className="border-t border-border/60 bg-muted/20 px-5 py-4 space-y-3 animate-in slide-in-from-top-3 duration-300">
                      <div className="font-bold text-foreground text-xs uppercase tracking-wider mb-2">
                        График выполнения порций (Транши)
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {c.tasks.map((t, index) => (
                          <div 
                            key={t.id} 
                            className="bg-card border border-border/50 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-xs"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground text-xs">Порция #{index + 1}</span>
                                <span className="text-[10px] font-mono text-muted-foreground/80 tabular-nums">({t.quantity} шт)</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                <span className="tabular-nums">
                                  {new Date(t.runAt).toLocaleString('ru-RU', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              {t.externalOrderId && (
                                <div className="text-[9px] font-mono text-primary flex items-center gap-1">
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  <span>Заказ провайдера: {t.externalOrderId}</span>
                                </div>
                              )}
                            </div>

                            <div className="shrink-0 flex flex-col items-end gap-1">
                              {t.status === 'COMPLETED' && (
                                <span className="text-[10px] font-bold text-emerald-800 dark:text-success flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Выполнено
                                </span>
                              )}
                              {t.status === 'SENT' && (
                                <span className="text-[10px] font-bold text-blue-800 dark:text-primary flex items-center gap-1 animate-pulse">
                                  <Clock className="w-3.5 h-3.5" /> В процессе
                                </span>
                              )}
                              {t.status === 'PLANNED' && (
                                <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" /> Ожидает
                                </span>
                              )}
                              {t.status === 'ERROR' && (
                                <span className="text-[10px] font-bold text-red-800 dark:text-destructive flex items-center gap-1" title={t.error || ''}>
                                  <AlertCircle className="w-3.5 h-3.5" /> Ошибка
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
