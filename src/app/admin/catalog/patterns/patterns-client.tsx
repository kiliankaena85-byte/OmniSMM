'use client';

import React, { useState, useTransition } from 'react';
import { 
  PatternDTO, 
  saveLinkPatternAction, 
  deleteLinkPatternAction, 
  testLinkPatternAction,
  generateAiPatternAction
} from '@/actions/admin/link-patterns';
import { 
  Link as LinkIcon, 
  Plus, 
  Pencil, 
  Trash2, 
  Play, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  X, 
  AlertTriangle,
  Code2,
  Filter,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface NetworkOption {
  id: string;
  name: string;
  slug: string;
}

interface PatternsClientProps {
  initialPatterns: PatternDTO[];
  networks: NetworkOption[];
}

export function PatternsClient({ initialPatterns, networks }: PatternsClientProps) {
  const [patterns, setPatterns] = useState<PatternDTO[]>(initialPatterns);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('ALL');
  const [isPending, startTransition] = useTransition();

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState<PatternDTO | null>(null);
  const [formData, setFormData] = useState<{
    networkId: string;
    pattern: string;
    contentType: string;
    sort: number;
  }>({
    networkId: networks[0]?.id || '',
    pattern: '',
    contentType: 'post',
    sort: 0,
  });

  // Live Test state
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<{
    isValid?: boolean;
    isSafe?: boolean;
    isMatch?: boolean;
    reason?: string;
    matchGroups?: string[];
    cleanedUrl?: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // AI Generator state
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiSampleUrls, setAiSampleUrls] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Delete Confirm Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingPattern, setDeletingPattern] = useState<PatternDTO | null>(null);

  // Filtered patterns
  const filteredPatterns = patterns.filter(p => 
    selectedNetwork === 'ALL' || p.networkId === selectedNetwork
  );

  // Open Create Modal
  function handleOpenCreate() {
    setEditingPattern(null);
    setFormData({
      networkId: networks[0]?.id || '',
      pattern: '',
      contentType: 'post',
      sort: 0,
    });
    setTestUrl('');
    setTestResult(null);
    setIsAiOpen(false);
    setIsModalOpen(true);
  }

  // Open Edit Modal
  function handleOpenEdit(pattern: PatternDTO) {
    setEditingPattern(pattern);
    setFormData({
      networkId: pattern.networkId,
      pattern: pattern.pattern,
      contentType: pattern.contentType,
      sort: pattern.sort,
    });
    setTestUrl('');
    setTestResult(null);
    setIsAiOpen(false);
    setIsModalOpen(true);
  }

  // Run Test
  async function handleRunTest() {
    if (!formData.pattern.trim() || !testUrl.trim()) {
      toast.error('Введите регулярное выражение и тестовый URL');
      return;
    }

    setIsTesting(true);
    try {
      const res = await testLinkPatternAction({
        pattern: formData.pattern.trim(),
        sampleUrl: testUrl.trim(),
      });

      if (res.success && res.data) {
        setTestResult(res.data);
      } else {
        toast.error(('error' in res && res.error) || 'Ошибка проверки');
      }
    } catch {
      toast.error('Сбой проверки паттерна');
    } finally {
      setIsTesting(false);
    }
  }

  // Run AI Generator
  async function handleRunAiGenerate() {
    const selectedNetObj = networks.find(n => n.id === formData.networkId);
    const urls = aiSampleUrls
      .split('\n')
      .map(u => u.trim())
      .filter(Boolean);

    if (urls.length === 0) {
      toast.error('Введите примеры ссылок (по одной на строку)');
      return;
    }

    setIsGeneratingAi(true);
    try {
      const res = await generateAiPatternAction({
        platformName: selectedNetObj?.name || 'Social Network',
        sampleUrls: urls,
        contentTypeHint: formData.contentType,
      });

      if (res.success && res.data) {
        setFormData(prev => ({
          ...prev,
          pattern: res.data.pattern,
          contentType: res.data.contentType || prev.contentType,
        }));
        toast.success(`Паттерн сгенерирован (уверенность ${res.data.confidence || 'высокая'})`);
        setIsAiOpen(false);
      } else {
        toast.error(res.error || 'Не удалось сгенерировать паттерн');
      }
    } catch {
      toast.error('Сбой вызова AI генератора');
    } finally {
      setIsGeneratingAi(false);
    }
  }

  // Save Pattern
  async function handleSavePattern(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.networkId || !formData.pattern.trim() || !formData.contentType.trim()) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    startTransition(async () => {
      const res = await saveLinkPatternAction({
        id: editingPattern?.id,
        networkId: formData.networkId,
        pattern: formData.pattern.trim(),
        contentType: formData.contentType.trim().toLowerCase(),
        sort: Number(formData.sort) || 0,
      });

      if (res.success) {
        toast.success(editingPattern ? 'Паттерн обновлен' : 'Паттерн создан');
        // Refresh local list
        const updatedNet = networks.find(n => n.id === formData.networkId);
        const updatedItem: PatternDTO = {
          id: editingPattern?.id || `pattern-${Date.now()}`,
          networkId: formData.networkId,
          networkName: updatedNet?.name || 'Соцсеть',
          pattern: formData.pattern.trim(),
          contentType: formData.contentType.trim().toLowerCase(),
          sort: Number(formData.sort) || 0,
          createdAt: new Date().toISOString(),
        };

        if (editingPattern) {
          setPatterns(prev => prev.map(p => p.id === editingPattern.id ? updatedItem : p));
        } else {
          setPatterns(prev => [updatedItem, ...prev]);
        }
        setIsModalOpen(false);
      } else {
        toast.error(res.error || 'Ошибка сохранения паттерна');
      }
    });
  }

  // Open Delete
  function handleOpenDelete(pattern: PatternDTO) {
    setDeletingPattern(pattern);
    setIsDeleteModalOpen(true);
  }

  // Execute Delete
  async function handleExecuteDelete() {
    if (!deletingPattern) return;

    startTransition(async () => {
      const res = await deleteLinkPatternAction(deletingPattern.id);
      if (res.success) {
        toast.success('Паттерн удален');
        setPatterns(prev => prev.filter(p => p.id !== deletingPattern.id));
        setIsDeleteModalOpen(false);
      } else {
        toast.error(res.error || 'Ошибка удаления');
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Top Filter & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border/70 rounded-lg p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="w-4 h-4" />
            <span>Соцсеть:</span>
          </div>
          <select
            value={selectedNetwork}
            onChange={e => setSelectedNetwork(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="ALL">Все соцсети ({patterns.length})</option>
            {networks.map(net => {
              const count = patterns.filter(p => p.networkId === net.id).length;
              return (
                <option key={net.id} value={net.id}>
                  {net.name} ({count})
                </option>
              );
            })}
          </select>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Добавить паттерн
        </button>
      </div>

      {/* Patterns Table */}
      <div className="bg-card border border-border/70 rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground uppercase font-medium border-b border-border text-[11px]">
              <tr>
                <th className="px-4 py-3">Соцсеть</th>
                <th className="px-4 py-3">Тип контента</th>
                <th className="px-4 py-3">Регулярное выражение (RegEx)</th>
                <th className="px-4 py-3 text-center">Сортировка</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredPatterns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">
                    Паттерны не найдены. Нажмите «Добавить паттерн», чтобы создать правила валидации ссылок.
                  </td>
                </tr>
              ) : (
                filteredPatterns.map(pattern => (
                  <tr key={pattern.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-muted">
                        <LinkIcon className="w-3.5 h-3.5 text-primary" />
                        {pattern.networkName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                        {pattern.contentType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-foreground max-w-md truncate" title={pattern.pattern}>
                      <code className="bg-muted/80 px-2 py-1 rounded border border-border/80">
                        {pattern.pattern}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {pattern.sort}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(pattern)}
                          title="Редактировать и протестировать"
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(pattern)}
                          title="Удалить паттерн"
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <div className="bg-card border border-border/70 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {editingPattern ? 'Редактирование паттерна' : 'Новый паттерн валидации ссылки'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Настройка регулярного выражения с ReDoS-аудитом и песочницей проверки
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSavePattern} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Соцсеть <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={formData.networkId}
                      onChange={e => setFormData(prev => ({ ...prev, networkId: e.target.value }))}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                      required
                    >
                      {networks.map(n => (
                        <option key={n.id} value={n.id}>{n.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Тип контента <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.contentType}
                      onChange={e => setFormData(prev => ({ ...prev, contentType: e.target.value }))}
                      placeholder="post, channel, profile, video, story"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">
                      Регулярное выражение (RegEx) <span className="text-destructive">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAiOpen(!isAiOpen)}
                      className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isAiOpen ? 'Скрыть AI-генератор' : 'Сгенерировать через ИИ'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formData.pattern}
                    onChange={e => setFormData(prev => ({ ...prev, pattern: e.target.value }))}
                    placeholder="^(?:https?:\/\/)?(?:www\.)?t\.me\/([a-zA-Z0-9_]{5,32})\/([0-9]+)\/?$"
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>

                {/* AI Generator Accordion */}
                {isAiOpen && (
                  <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <Sparkles className="w-4 h-4" />
                      AI-генерация безопасного регулярного выражения (gemini-3-flash)
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Вставьте 1–3 примера валидных ссылок для этой соцсети (по одной на строке):
                    </p>
                    <textarea
                      rows={2}
                      value={aiSampleUrls}
                      onChange={e => setAiSampleUrls(e.target.value)}
                      placeholder="https://t.me/channel/123&#10;https://telegram.me/channel/124"
                      className="w-full p-2 text-xs font-mono rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={isGeneratingAi}
                        onClick={handleRunAiGenerate}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1.5"
                      >
                        {isGeneratingAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {isGeneratingAi ? 'Генерация...' : 'Создать RegEx'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Live Testing Sandbox */}
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-3">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5 text-emerald-500" />
                    Песочница проверки ссылки (Live Sandbox)
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testUrl}
                      onChange={e => setTestUrl(e.target.value)}
                      placeholder="Вставьте ссылку для проверки (например: https://t.me/durov/12)"
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      disabled={isTesting}
                      onClick={handleRunTest}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-muted border border-border hover:bg-muted/80 text-foreground transition-colors shrink-0"
                    >
                      {isTesting ? 'Проверка...' : 'Тест'}
                    </button>
                  </div>

                  {testResult && (
                    <div className="p-2.5 rounded-lg text-xs space-y-1.5 border border-border bg-background">
                      <div className="flex items-center gap-2">
                        {testResult.isMatch ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-4 h-4" /> Ссылка успешно распознана
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-destructive font-semibold">
                            <XCircle className="w-4 h-4" /> Ссылка не соответствует паттерну
                          </span>
                        )}
                        {!testResult.isSafe && (
                          <span className="inline-flex items-center gap-1 text-amber-500 font-semibold ml-2">
                            <AlertTriangle className="w-3.5 h-3.5" /> Обнаружен риск ReDoS!
                          </span>
                        )}
                      </div>
                      {testResult.matchGroups && testResult.matchGroups.length > 0 && (
                        <div className="text-[11px] text-muted-foreground font-mono">
                          Извлеченные группы: {JSON.stringify(testResult.matchGroups)}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Порядок сортировки (приоритет)
                  </label>
                  <input
                    type="number"
                    value={formData.sort}
                    onChange={e => setFormData(prev => ({ ...prev, sort: parseInt(e.target.value) || 0 }))}
                    className="w-28 px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-sm disabled:opacity-60"
                >
                  {isPending ? 'Сохранение...' : editingPattern ? 'Сохранить изменения' : 'Создать паттерн'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {isDeleteModalOpen && deletingPattern && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <div className="bg-card border border-border/70 rounded-lg shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-destructive font-semibold text-base">
              <AlertTriangle className="w-5 h-5" />
              Удаление паттерна
            </div>
            <p className="text-xs text-muted-foreground">
              Вы уверены, что хотите удалить паттерн валидации для соцсети <strong>{deletingPattern.networkName}</strong> ({deletingPattern.contentType})?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleExecuteDelete}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {isPending ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
