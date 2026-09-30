import Link from "next/link";
import { 
  Sparkles, 
  ShieldCheck, 
  Diamond, 
  Terminal, 
  FileSpreadsheet, 
  ArrowUpRight 
} from "lucide-react";

export function FluxWhyUs({ companyName = "SMMflux" }: { companyName?: string }) {
  return (
    <section aria-labelledby="why-us-heading" className="mx-auto max-w-6xl px-4 py-12 md:py-20">
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300 text-xs font-bold uppercase tracking-wider mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Преимущества платформы</span>
        </div>
        <h2 id="why-us-heading" className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4 text-balance">
          Платформа нового поколения
        </h2>
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-medium text-pretty">
          Более 10 000 клиентов доверяют {companyName} своё продвижение. Мы переосмыслили опыт и надежность запуска.
        </p>
      </div>

      {/* BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Large Span AI Selection */}
        <div className="md:col-span-2 bg-white dark:bg-[#0f172a] border border-slate-200/90 dark:border-white/10 rounded-[2.5rem] p-6 md:p-10 relative overflow-hidden group shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.08)] transition-all duration-300 min-h-[280px]">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-purple-500/15 via-indigo-500/10 to-transparent rounded-full blur-3xl opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="relative z-10 flex flex-col justify-between md:h-full">
            <div>
              <div className="w-14 h-14 bg-purple-50 dark:bg-purple-950/60 border border-purple-200/60 dark:border-purple-800/40 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:-rotate-3 transition-transform shadow-sm">
                <Sparkles className="w-7 h-7" strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">AI-подбор услуг</h3>
              <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-lg">
                Вам больше не нужно разбираться в десятках категорий. Просто вставьте ссылку — наша система 
                автоматически определит платформу и сама подберёт оптимальный пакет продвижения.
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Small Span Transparent Conditions */}
        <div className="md:col-span-1 bg-white dark:bg-[#0f172a] border border-slate-200/90 dark:border-white/10 rounded-[2.5rem] p-6 md:p-10 relative overflow-hidden group shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.08)] transition-all duration-300 min-h-[240px]">
          <div className="relative z-10 flex flex-col md:h-full">
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
              <ShieldCheck className="w-7 h-7" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">Прозрачные условия</h3>
            <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed text-sm">
              Никаких скрытых условий. Вы получаете ровно то качество и ту скорость, которые указаны в описании услуги.
            </p>
          </div>
        </div>

        {/* Card 3: Small Span Loyalty */}
        <div className="md:col-span-1 bg-white dark:bg-[#0f172a] border border-slate-200/90 dark:border-white/10 rounded-[2.5rem] p-6 md:p-10 relative overflow-hidden group shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.08)] transition-all duration-300 min-h-[240px]">
          <div className="relative z-10 flex flex-col md:h-full justify-between">
            <div>
              <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
                <Diamond className="w-7 h-7" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">Персональные скидки</h3>
              <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed text-sm">
                Получайте накопительные скидки в зависимости от вашего объема заказов. Автоматический расчет скидки в корзине.
              </p>
            </div>
          </div>
        </div>

        {/* Card 4: High-Contrast Dark Obsidian Reseller Suite & API Hub Card */}
        <div className="md:col-span-2 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white border border-slate-800/80 rounded-[2.5rem] p-6 pb-8 md:p-10 md:pb-12 relative overflow-hidden group shadow-xl transition-all duration-300 min-h-[380px]">
          {/* Background Ambient Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700 -translate-y-1/3 translate-x-1/3 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col justify-between md:h-full">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-110 transition-transform border border-white/10">
                  <Terminal className="w-6 h-6 text-purple-300" strokeWidth={1.5} />
                </div>
                <span className="text-xs font-bold text-purple-300 uppercase tracking-widest">API & Интеграции</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-6 tracking-tight">Решения для Реселлеров & API Hub</h3>
              
              {/* Triple-Hook Feature List */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <div className="flex items-start gap-3 bg-white/[0.06] hover:bg-white/[0.10] p-4 rounded-2xl backdrop-blur-md border border-white/10 transition-colors">
                  <FileSpreadsheet className="w-6 h-6 text-purple-400 shrink-0" strokeWidth={1.5} />
                  <div>
                    <h4 className="text-sm font-semibold text-white">Массовый заказ</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-snug">Умный Excel-парсер с автоочисткой ссылок</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 bg-white/[0.06] hover:bg-white/[0.10] p-4 rounded-2xl backdrop-blur-md border border-white/10 transition-colors">
                  <Terminal className="w-6 h-6 text-sky-400 shrink-0" strokeWidth={1.5} />
                  <div>
                    <h4 className="text-sm font-semibold text-white">PerfectPanel API</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-snug">Спецификация v2 для автоматизации</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white/[0.06] hover:bg-white/[0.10] p-4 rounded-2xl backdrop-blur-md border border-white/10 transition-colors">
                  <Diamond className="w-6 h-6 text-pink-400 shrink-0" strokeWidth={1.5} />
                  <div>
                    <h4 className="text-sm font-semibold text-white">Оптовые Цены</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-snug">Накопительный дисконт до 15% пожизненно</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom CTA bar */}
            <div className="mt-8 sm:mt-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 border-t border-white/10">
              <p className="text-sm text-slate-300">
                Запустите свой SMM-сервис за 5 минут без требований к минимальному балансу.
              </p>
              <Link 
                href="/login?promo=START"
                className="inline-flex items-center gap-2 bg-white text-slate-950 font-bold px-6 py-3 rounded-xl hover:bg-slate-100 active:scale-[0.98] transition-all text-sm shrink-0 shadow-md cursor-pointer"
              >
                Получить API-доступ
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
