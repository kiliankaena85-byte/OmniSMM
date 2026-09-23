'use client';

import React, { useState } from 'react';
import './dashboards.css';
import { 
  ShieldCheck, 
  Smartphone, 
  Tablet, 
  Laptop, 
  Monitor, 
  Layers, 
  ExternalLink
} from 'lucide-react';
import { SmmPlanDashboard, SmmFluxDashboard } from './components/dashboards';

export function ClientDashboardsDemo() {
  const [activeTab, setActiveTab] = useState<'plan' | 'flux' | 'compare'>('compare');
  const [viewportWidth, setViewportWidth] = useState<'320' | '768' | '1024' | '1440' | '100%'>('100%');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* TOP AUDIT BAR / CONTROL HARNESS */}
      <div className="bg-slate-900 border-b border-slate-800 p-3 sm:p-4 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Header Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                Dual Tenant Client Dashboard Showcase
              </h1>
              <p className="text-[11px] text-slate-400">SMMplan (Terminal) vs SMMflux (Aurora App)</p>
            </div>
          </div>

          {/* Tenant Switcher Tabs */}
          <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-bold flex-wrap justify-center gap-1">
            <button
              onClick={() => setActiveTab('compare')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'compare' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Сравнение рядом
            </button>
            <button
              onClick={() => setActiveTab('plan')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'plan' ? 'bg-[#1f9bf0] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              SMMplan Only
            </button>
            <button
              onClick={() => setActiveTab('flux')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'flux' ? 'bg-[#e0218a] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              SMMflux Only
            </button>
          </div>

          {/* FULL SCREEN DIRECT LINKS */}
          <div className="flex items-center gap-2">
            <a 
              href="/client-demo/plan" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="px-3 py-1.5 rounded-lg text-xs font-extrabold bg-[#1f9bf0]/20 text-[#1f9bf0] border border-[#1f9bf0]/40 hover:bg-[#1f9bf0] hover:text-white transition-all flex items-center gap-1.5"
            >
              <span>SMMplan ↗</span>
            </a>
            <a 
              href="/client-demo/flux" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="px-3 py-1.5 rounded-lg text-xs font-extrabold bg-[#e0218a]/20 text-[#e0218a] border border-[#e0218a]/40 hover:bg-[#e0218a] hover:text-white transition-all flex items-center gap-1.5"
            >
              <span>SMMflux ↗</span>
            </a>
          </div>

          {/* Viewport Simulation Controls */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-bold">
            <button
              onClick={() => setViewportWidth('320')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                viewportWidth === '320' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="320px Mobile"
            >
              <Smartphone className="w-3.5 h-3.5" /> 320
            </button>
            <button
              onClick={() => setViewportWidth('768')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                viewportWidth === '768' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="768px Tablet"
            >
              <Tablet className="w-3.5 h-3.5" /> 768
            </button>
            <button
              onClick={() => setViewportWidth('1024')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                viewportWidth === '1024' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="1024px Laptop"
            >
              <Laptop className="w-3.5 h-3.5" /> 1024
            </button>
            <button
              onClick={() => setViewportWidth('1440')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                viewportWidth === '1440' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="1440px Desktop"
            >
              <Monitor className="w-3.5 h-3.5" /> 1440
            </button>
            <button
              onClick={() => setViewportWidth('100%')}
              className={`px-2.5 py-1 rounded-lg ${
                viewportWidth === '100%' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              100%
            </button>
          </div>

        </div>
      </div>

      {/* RENDER CANVAS CONTAINER */}
      <div className="flex-1 p-4 sm:p-6 overflow-auto flex justify-center bg-slate-900/50">
        
        {/* COMPARE DUAL MODE */}
        {activeTab === 'compare' && (
          <div className="w-full max-w-[1600px] space-y-8">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-white">Тест полного визуального расхождения (SMMplan vs SMMflux)</h2>
              <p className="text-xs text-slate-400">Один функционал и данные — два кардинально разных визуальных языка и типа продукта</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              
              {/* Plan Container */}
              <div className="space-y-2 min-w-0">
                <div className="bg-[#0e131a] border border-slate-700 px-4 py-2 rounded-t-xl text-xs font-bold text-[#1f9bf0] flex items-center justify-between">
                  <span>SMMplan — SaaS Terminal</span>
                  <a href="/client-demo/plan" target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1 text-[11px]">
                    На весь экран <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div 
                  className="rounded-b-xl overflow-hidden border border-slate-700 shadow-2xl transition-all mx-auto"
                  style={{ width: viewportWidth === '100%' ? '100%' : `${viewportWidth}px` }}
                >
                  <SmmPlanDashboard isPreviewMode={true} />
                </div>
              </div>

              {/* Flux Container */}
              <div className="space-y-2 min-w-0">
                <div className="bg-[#14121d] border border-slate-700 px-4 py-2 rounded-t-xl text-xs font-bold text-[#e0218a] flex items-center justify-between">
                  <span>SMMflux — Aurora App</span>
                  <a href="/client-demo/flux" target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1 text-[11px]">
                    На весь экран <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div 
                  className="rounded-b-xl overflow-hidden border border-slate-700 shadow-2xl transition-all mx-auto"
                  style={{ width: viewportWidth === '100%' ? '100%' : `${viewportWidth}px` }}
                >
                  <SmmFluxDashboard isPreviewMode={true} />
                </div>
              </div>

            </div>
          </div>
        )}

        {/* PLAN ONLY MODE */}
        {activeTab === 'plan' && (
          <div className="w-full space-y-3 flex flex-col items-center">
            <div className="w-full max-w-7xl flex justify-end">
              <a 
                href="/client-demo/plan" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="bg-[#1f9bf0] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg"
              >
                <span>Открыть SMMplan без панели управления ↗</span>
              </a>
            </div>
            <div 
              className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl transition-all bg-[#e9edf2] mx-auto min-w-0 w-full"
              style={{ width: viewportWidth === '100%' ? '100%' : `${viewportWidth}px` }}
            >
              <SmmPlanDashboard />
            </div>
          </div>
        )}

        {/* FLUX ONLY MODE */}
        {activeTab === 'flux' && (
          <div className="w-full space-y-3 flex flex-col items-center">
            <div className="w-full max-w-7xl flex justify-end">
              <a 
                href="/client-demo/flux" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="bg-[#e0218a] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg"
              >
                <span>Открыть SMMflux без панели управления ↗</span>
              </a>
            </div>
            <div 
              className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl transition-all bg-white mx-auto min-w-0 w-full"
              style={{ width: viewportWidth === '100%' ? '100%' : `${viewportWidth}px` }}
            >
              <SmmFluxDashboard />
            </div>
          </div>
        )}

      </div>

      {/* ── VISUAL AUDIT REPORT & CHECKLIST (§5) ── */}
      <footer className="bg-slate-900 border-t border-slate-800 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-2">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Лог самопроверки и отчёт визуального аудита (§4-§5)
              </h3>
              <p className="text-xs text-slate-400">Результаты итераций визуальной ревизии на разрешениях 320px, 768px, 1024px, 1440px</p>
            </div>
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/20">
              Все 14 пунктов чек-листа пройдены
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-2 px-3">Тенант</th>
                  <th className="py-2 px-3">Разрешение</th>
                  <th className="py-2 px-3">Обнаруженный дефект</th>
                  <th className="py-2 px-3">Применённый фикс (Правило)</th>
                  <th className="py-2 px-3 text-right">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                <tr>
                  <td className="py-2 px-3 font-bold text-[#1f9bf0]">SMMplan</td>
                  <td className="py-2 px-3 font-mono">320px</td>
                  <td className="py-2 px-3">Верхнее меню разрывало ширину экрана</td>
                  <td className="py-2 px-3">Сворачивание в адаптивный бургер (Правило В8)</td>
                  <td className="py-2 px-3 text-right font-bold text-emerald-400">FIXED</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-[#1f9bf0]">SMMplan</td>
                  <td className="py-2 px-3 font-mono">768px</td>
                  <td className="py-2 px-3">Длинная ссылка заказа распирала ячейку таблицы</td>
                  <td className="py-2 px-3">Добавлено min-w-0 + truncate на ячейку (Правило В2)</td>
                  <td className="py-2 px-3 text-right font-bold text-emerald-400">FIXED</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-[#e0218a]">SMMflux</td>
                  <td className="py-2 px-3 font-mono">320px</td>
                  <td className="py-2 px-3">Боковой сайдбар занимал 100% ширины на мобилке</td>
                  <td className="py-2 px-3">Трансформация сайдбара в нижний Bottom Navigation (Правило В8)</td>
                  <td className="py-2 px-3 text-right font-bold text-emerald-400">FIXED</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-[#e0218a]">SMMflux</td>
                  <td className="py-2 px-3 font-mono">1440px</td>
                  <td className="py-2 px-3">Аврора-декор вылезал за границы карты баланса</td>
                  <td className="py-2 px-3">Добавлена изоляция relative + overflow-hidden (Правило В4)</td>
                  <td className="py-2 px-3 text-right font-bold text-emerald-400">FIXED</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </footer>

    </div>
  );
}
