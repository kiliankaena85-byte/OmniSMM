'use client';

import React, { useState } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Copy, Check, Terminal, Code, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getCurlCode, getNodeCode, jsonResponse } from './ApiReferenceDocsData';

interface ApiReferenceDocsProps {
  userApiKey: string | null;
}

export function ApiReferenceDocs({ userApiKey }: ApiReferenceDocsProps) {
  const [activeAction, setActiveAction] = useState<'services' | 'add' | 'status' | 'balance'>('services');
  const [copiedTextId, setCopiedTextId] = useState<string | null>(null);

  const displayKey = userApiKey || '<ВАШ_API_КЛЮЧ>';
  const host = typeof window !== 'undefined' ? window.location.origin : 'https://smmplan.pro';

  const copyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTextId(id);
    toast.success('Код скопирован!');
    setTimeout(() => setCopiedTextId(null), 2000);
  };

  const curlCode = getCurlCode(host, displayKey);
  const nodeCode = getNodeCode(host, displayKey);

  return (
    <div className="space-y-6">
      
      {/* ── API Action Selector Tabs ── */}
      <div className="flex flex-wrap border-b border-border/60 select-none gap-2 pb-2">
        <button
          onClick={() => setActiveAction('services')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeAction === 'services' ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          services (Список услуг)
        </button>
        <button
          onClick={() => setActiveAction('add')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeAction === 'add' ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          add (Новый заказ)
        </button>
        <button
          onClick={() => setActiveAction('status')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeAction === 'status' ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          status (Статус заказа)
        </button>
        <button
          onClick={() => setActiveAction('balance')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeAction === 'balance' ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          balance (Запрос баланса)
        </button>
      </div>

      {/* ── API Details and Parameter Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Description & Parameters */}
        <div className="space-y-5">
          <div>
            <h4 className="font-extrabold text-foreground text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary shrink-0" />
              <span>Описание метода</span>
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1">
              {activeAction === 'services' && 'Возвращает полный каталог активных услуг, доступных лимитов и тарифов с учетом вашей персональной скидки реселлера.'}
              {activeAction === 'add' && 'Создает новый заказ в системе продвижения. Сумма заказа рассчитывается автоматически и списывается с баланса вашего API-аккаунта.'}
              {activeAction === 'status' && 'Query-опрос состояния заказа. Позволяет узнать остаток невыполненной продвижения (remains) и текущий статус выполнения.'}
              {activeAction === 'balance' && 'Быстрый запрос текущего остатка средств на балансе в рублях РФ.'}
            </p>
          </div>

          {/* Parameters Table */}
          <div className="space-y-3">
            <h5 className="font-extrabold text-foreground text-xs uppercase tracking-wider">Параметры запроса</h5>
            <div className="border border-border/60 rounded-xl overflow-hidden shadow-sm bg-muted/20">
              <table className="w-full text-xs" aria-label="Параметры API">
                <thead>
                  <tr className="bg-muted text-left text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border/40 select-none">
                    <th className="py-2.5 px-4 font-bold">Поле</th>
                    <th className="py-2.5 px-4 font-bold">Тип</th>
                    <th className="py-2.5 px-4 font-bold">Обяз.</th>
                    <th className="py-2.5 px-4 font-bold">Описание</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/40">
                    <td className="py-2.5 px-4 font-mono font-bold text-foreground">key</td>
                    <td className="py-2.5 px-4 text-muted-foreground">string</td>
                    <td className="py-2.5 px-4 text-rose-500 font-bold">Да</td>
                    <td className="py-2.5 px-4 text-muted-foreground">Ваш уникальный API-ключ реселлера.</td>
                  </tr>
                  <tr className="border-b border-border/40">
                    <td className="py-2.5 px-4 font-mono font-bold text-foreground">action</td>
                    <td className="py-2.5 px-4 text-muted-foreground">string</td>
                    <td className="py-2.5 px-4 text-rose-500 font-bold">Да</td>
                    <td className="py-2.5 px-4 text-muted-foreground">Название метода: <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{activeAction}</code></td>
                  </tr>
                  
                  {activeAction === 'services' && (
                    <tr>
                      <td className="py-2.5 px-4 font-mono font-bold text-foreground">offset</td>
                      <td className="py-2.5 px-4 text-muted-foreground">int</td>
                      <td className="py-2.5 px-4 text-muted-foreground">Нет</td>
                      <td className="py-2.5 px-4 text-muted-foreground">Смещение для пагинации каталога (по умолчанию 0).</td>
                    </tr>
                  )}

                  {activeAction === 'add' && (
                    <>
                      <tr className="border-b border-border/40">
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground">service</td>
                        <td className="py-2.5 px-4 text-muted-foreground">int</td>
                        <td className="py-2.5 px-4 text-rose-500 font-bold">Да</td>
                        <td className="py-2.5 px-4 text-muted-foreground">ID тарифа (например, из списка услуг).</td>
                      </tr>
                      <tr className="border-b border-border/40">
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground">link</td>
                        <td className="py-2.5 px-4 text-muted-foreground">string</td>
                        <td className="py-2.5 px-4 text-rose-500 font-bold">Да</td>
                        <td className="py-2.5 px-4 text-muted-foreground">Ссылка на объект продвижения (профиль, пост, канал).</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground">quantity</td>
                        <td className="py-2.5 px-4 text-muted-foreground">int</td>
                        <td className="py-2.5 px-4 text-rose-500 font-bold">Да</td>
                        <td className="py-2.5 px-4 text-muted-foreground">Количество продвижения (в рамках мин/макс лимитов).</td>
                      </tr>
                    </>
                  )}

                  {activeAction === 'status' && (
                    <>
                      <tr className="border-b border-border/40">
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground">order</td>
                        <td className="py-2.5 px-4 text-muted-foreground">int</td>
                        <td className="py-2.5 px-4 text-muted-foreground">Част.</td>
                        <td className="py-2.5 px-4 text-muted-foreground">Порядковый ID заказа для одиночной проверки.</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground">orders</td>
                        <td className="py-2.5 px-4 text-muted-foreground">string</td>
                        <td className="py-2.5 px-4 text-muted-foreground">Част.</td>
                        <td className="py-2.5 px-4 text-muted-foreground">Список ID через запятую для пакетной проверки (макс 100).</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Code Blocks (CURL, Node.js, JSON responses) */}
        <div className="space-y-4">
          
          {/* CURL Command */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
              <span>CURL Запрос</span>
              <button
                onClick={() => copyCode(curlCode[activeAction], `curl-${activeAction}`)}
                className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer select-none"
              >
                {copiedTextId === `curl-${activeAction}` ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedTextId === `curl-${activeAction}` ? 'Скопировано' : 'Копировать'}</span>
              </button>
            </div>
            <div className="bg-zinc-950 text-zinc-100 rounded-xl p-4 font-mono text-[11px] leading-relaxed shadow-inner overflow-x-auto border border-zinc-800">
              {curlCode[activeAction]}
            </div>
          </div>

          {/* Node.js script */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
              <span>Node.js Fetch</span>
              <button
                onClick={() => copyCode(nodeCode[activeAction], `node-${activeAction}`)}
                className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer select-none"
              >
                {copiedTextId === `node-${activeAction}` ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedTextId === `node-${activeAction}` ? 'Скопировано' : 'Копировать'}</span>
              </button>
            </div>
            <div className="bg-zinc-950 text-zinc-100 rounded-xl p-4 font-mono text-[11px] leading-relaxed shadow-inner overflow-x-auto border border-zinc-800">
              {nodeCode[activeAction]}
            </div>
          </div>

          {/* JSON Response Model */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
              <span>Пример ответа (JSON)</span>
            </div>
            <div className="bg-zinc-950 text-zinc-100 rounded-xl p-4 font-mono text-[11px] leading-relaxed shadow-inner overflow-x-auto border border-zinc-800">
              {jsonResponse[activeAction]}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
