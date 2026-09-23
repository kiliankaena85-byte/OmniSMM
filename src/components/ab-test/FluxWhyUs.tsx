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
    <section aria-labelledby="why-us-heading" className="mx-auto max-w-6xl px-4 py-12 md:py-24">
      <div className="text-center mb-16">
        <h2 id="why-us-heading" className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4 text-balance">
          Платформа нового поколения
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium text-pretty">
          Более 10 000 клиентов доверяют {companyName} своё продвижение не просто так. Мы переосмыслили опыт продвижения.
        </p>
      </div>

      {/* BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Large Span AI Selection */}
        <div className="md:col-span-2 bg-card border border-border rounded-[2.5rem] p-6 md:p-10 relative overflow-hidden group shadow-sm hover:shadow-md transition-all duration-300 min-h-[280px]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500 -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 flex flex-col justify-between md:h-full">
            <div>
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:-rotate-3 transition-transform shadow-sm">
                <Sparkles className="w-7 h-7" strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3 tracking-tight">AI-подбор услуг</h3>
              <p className="text-muted-foreground font-medium leading-relaxed max-w-md">
                Вам больше не нужно разбираться в десятках категорий. Просто вставьте ссылку — наша система 
                автоматически определит платформу и сама подберёт оптимальный пакет продвижения.
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Small Span Transparent Conditions */}
        <div className="md:col-span-1 bg-card border border-border rounded-[2.5rem] p-6 md:p-10 relative overflow-hidden group shadow-sm hover:shadow-md transition-all duration-300 min-h-[240px]">
          <div className="relative z-10 flex flex-col md:h-full">
            <div className="w-14 h-14 bg-success/10 text-success rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
              <ShieldCheck className="w-7 h-7" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3 tracking-tight">Прозрачные условия</h3>
            <p className="text-muted-foreground font-medium leading-relaxed text-sm">
              Никаких скрытых условий. Вы получаете ровно то качество и ту скорость, которые указаны в описании услуги.
            </p>
          </div>
        </div>

        {/* Card 3: Small Span Loyalty */}
        <div className="md:col-span-1 bg-card border border-border rounded-[2.5rem] p-6 md:p-10 relative overflow-hidden group shadow-sm hover:shadow-md transition-all duration-300 min-h-[240px]">
          <div className="relative z-10 flex flex-col md:h-full justify-between">
            <div>
              <div className="w-14 h-14 bg-danger/10 text-danger rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
                <Diamond className="w-7 h-7" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3 tracking-tight">Персональные скидки</h3>
              <p className="text-muted-foreground font-medium leading-relaxed text-sm">
                Получайте накопительные скидки в зависимости от вашего объема заказов. Автоматический расчет скидки в корзине.
              </p>
            </div>
          </div>
        </div>

        {/* Card 4: Large Reseller Suite & API Hub Card */}
        <div className="md:col-span-2 bg-card border border-border text-card-foreground rounded-[2.5rem] p-6 pb-8 md:p-10 md:pb-12 relative overflow-hidden group shadow-md transition-all duration-300 min-h-[380px]">
          {/* Background Ambient Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700 -translate-y-1/3 translate-x-1/3" />
          
          <div className="relative z-10 flex flex-col justify-between md:h-full">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center text-foreground backdrop-blur-sm group-hover:scale-110 transition-transform">
                  <Terminal className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">API & Интеграции</span>
              </div>
              <h3 className="text-3xl font-bold text-foreground mb-6 tracking-tight">Решения для Реселлеров & API Hub</h3>
              
              {/* Triple-Hook Feature List */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <div className="flex items-start gap-3 bg-muted/40 p-4 rounded-2xl backdrop-blur-md border border-border/50">
                  <FileSpreadsheet className="w-6 h-6 text-primary shrink-0" strokeWidth={1.5} />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Массовый заказ</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">Умный Excel-парсер с автоочисткой ссылок</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 bg-muted/40 p-4 rounded-2xl backdrop-blur-md border border-border/50">
                  <Terminal className="w-6 h-6 text-primary shrink-0" strokeWidth={1.5} />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">PerfectPanel API</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">Спецификация v2 для автоматизации</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-muted/40 p-4 rounded-2xl backdrop-blur-md border border-border/50">
                  <Diamond className="w-6 h-6 text-primary shrink-0" strokeWidth={1.5} />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Оптовые Цены</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">Накопительный дисконт до 15% пожизненно</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom CTA bar */}
            <div className="mt-8 sm:mt-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Запустите свой SMM-сервис за 5 минут без требований к минимальному балансу.
              </p>
              <Link 
                href="/login?promo=START"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-all text-sm shrink-0 shadow-sm"
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
