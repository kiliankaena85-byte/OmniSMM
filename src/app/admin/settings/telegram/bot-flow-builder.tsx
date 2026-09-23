'use client';

/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * Visual Step Sequence (Flow) Builder for Telegram Bots.
 */

import React, { useState } from 'react';
import { Plus, Trash2, ArrowRight, CornerDownRight, MessageSquare, Play } from 'lucide-react';
import type { BotFlowStep, BotFlowButton } from '@/types/telegram-builder';

interface BotFlowBuilderProps {
  steps: BotFlowStep[];
  onChange: (steps: BotFlowStep[]) => void;
}

export function BotFlowBuilder({ steps, onChange }: BotFlowBuilderProps) {
  const [activeStepId, setActiveStepId] = useState<string | null>(steps[0]?.id || null);

  const activeStep = steps.find((s) => s.id === activeStepId) || steps[0];

  const handleAddStep = () => {
    const newId = `step_${Date.now()}`;
    const newStep: BotFlowStep = {
      id: newId,
      title: `Шаг ${steps.length + 1}`,
      triggerType: steps.length === 0 ? 'entry' : 'callback',
      triggerValue: steps.length === 0 ? '/start' : newId,
      messageText: 'Текст сообщения для этого шага...',
      actionType: 'reply',
      buttons: []
    };
    const updated = [...steps, newStep];
    onChange(updated);
    setActiveStepId(newId);
  };

  const handleDeleteStep = (id: string) => {
    const updated = steps.filter((s) => s.id !== id);
    onChange(updated);
    if (activeStepId === id) {
      setActiveStepId(updated[0]?.id || null);
    }
  };

  const handleUpdateActiveStep = (partial: Partial<BotFlowStep>) => {
    if (!activeStep) return;
    const updated = steps.map((s) => (s.id === activeStep.id ? { ...s, ...partial } : s));
    onChange(updated);
  };

  const handleAddButton = () => {
    if (!activeStep) return;
    const newButton: BotFlowButton = {
      id: `btn_${Date.now()}`,
      label: 'Кнопка действия',
      action: 'next_step',
      targetStepId: steps.find((s) => s.id !== activeStep.id)?.id,
      style: 'default'
    };
    handleUpdateActiveStep({
      buttons: [...(activeStep.buttons || []), newButton]
    });
  };

  const handleUpdateButton = (btnId: string, partial: Partial<BotFlowButton>) => {
    if (!activeStep) return;
    const updatedButtons = (activeStep.buttons || []).map((b) =>
      b.id === btnId ? { ...b, ...partial } : b
    );
    handleUpdateActiveStep({ buttons: updatedButtons });
  };

  const handleDeleteButton = (btnId: string) => {
    if (!activeStep) return;
    handleUpdateActiveStep({
      buttons: (activeStep.buttons || []).filter((b) => b.id !== btnId)
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" />
            Последовательность действий (Сценарии и переходы)
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Настройте цепочку шагов, сообщения и интерактивные кнопки ветвления.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddStep}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Добавить шаг
        </button>
      </div>

      {steps.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-xl bg-muted/20">
          <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">В этом боте пока нет настроенных сценариев.</p>
          <button
            type="button"
            onClick={handleAddStep}
            className="mt-3 text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Создать первый приветственный шаг
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Steps Navigation Sidebar */}
          <div className="lg:col-span-4 space-y-1.5 border-r border-border/50 pr-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Шаги сценария ({steps.length})
            </div>
            {steps.map((step, idx) => {
              const isSelected = step.id === activeStep?.id;
              return (
                <div
                  key={step.id}
                  onClick={() => setActiveStepId(step.id)}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-primary/10 border border-primary/30 text-primary font-medium'
                      : 'hover:bg-muted/50 text-foreground border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-mono shrink-0">
                      {idx + 1}
                    </span>
                    <span className="truncate">{step.title}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {step.triggerType === 'entry' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-500 font-mono">
                        START
                      </span>
                    )}
                    {steps.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStep(step.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                        title="Удалить шаг"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Step Details & Editor */}
          {activeStep && (
            <div className="lg:col-span-8 space-y-3 bg-muted/10 p-4 rounded-xl border border-border">
              <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">Параметры шага:</span>
                  <input
                    type="text"
                    value={activeStep.title}
                    onChange={(e) => handleUpdateActiveStep({ title: e.target.value })}
                    className="text-xs font-medium bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-primary w-48"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-muted-foreground">Тип триггера:</label>
                  <select
                    value={activeStep.triggerType}
                    onChange={(e) => handleUpdateActiveStep({ triggerType: e.target.value as any })}
                    className="text-xs bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none"
                  >
                    <option value="entry">Точка входа (/start)</option>
                    <option value="callback">Инлайн-кнопка (Callback)</option>
                    <option value="text">Текст сообщения</option>
                  </select>
                </div>
              </div>

              {/* Message Textarea */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Текст ответа (поддерживает HTML: &lt;b&gt;, &lt;i&gt;, &lt;code&gt;):
                </label>
                <textarea
                  rows={4}
                  value={activeStep.messageText}
                  onChange={(e) => handleUpdateActiveStep({ messageText: e.target.value })}
                  className="w-full text-xs bg-background border border-border rounded-lg p-2.5 text-foreground font-mono focus:outline-none focus:border-primary resize-y"
                  placeholder="Введите текст сообщения бота..."
                />
              </div>

              {/* Step Buttons (Transitions) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground flex items-center gap-1">
                    <CornerDownRight className="w-3.5 h-3.5 text-primary" />
                    Кнопки перехода к следующим действиям:
                  </span>
                  <button
                    type="button"
                    onClick={handleAddButton}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Добавить кнопку
                  </button>
                </div>

                {(activeStep.buttons || []).length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">Кнопки не добавлены (сообщение без инлайн-меню).</p>
                ) : (
                  <div className="space-y-2">
                    {activeStep.buttons.map((btn) => (
                      <div
                        key={btn.id}
                        className="flex items-center gap-2 p-2 bg-background border border-border/80 rounded-lg text-xs"
                      >
                        <input
                          type="text"
                          value={btn.label}
                          onChange={(e) => handleUpdateButton(btn.id, { label: e.target.value })}
                          placeholder="Текст на кнопке"
                          className="flex-1 bg-muted/20 border border-border rounded px-2 py-1 text-foreground focus:outline-none"
                        />

                        <select
                          value={btn.action}
                          onChange={(e) => handleUpdateButton(btn.id, { action: e.target.value as any })}
                          className="bg-muted/20 border border-border rounded px-2 py-1 text-foreground focus:outline-none"
                        >
                          <option value="next_step">Перейти к шагу ➔</option>
                          <option value="open_url">Открыть сайт (URL)</option>
                          <option value="call_operator">Вызвать оператора</option>
                          <option value="open_catalog">Открыть каталог</option>
                        </select>

                        {btn.action === 'next_step' && (
                          <select
                            value={btn.targetStepId || ''}
                            onChange={(e) => handleUpdateButton(btn.id, { targetStepId: e.target.value })}
                            className="bg-muted/20 border border-border rounded px-2 py-1 text-foreground focus:outline-none max-w-[140px] truncate"
                          >
                            <option value="">Выберите шаг...</option>
                            {steps.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.title}
                              </option>
                            ))}
                          </select>
                        )}

                        {btn.action === 'open_url' && (
                          <input
                            type="url"
                            value={btn.url || ''}
                            onChange={(e) => handleUpdateButton(btn.id, { url: e.target.value })}
                            placeholder="https://..."
                            className="w-36 bg-muted/20 border border-border rounded px-2 py-1 text-foreground focus:outline-none"
                          />
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteButton(btn.id)}
                          className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
