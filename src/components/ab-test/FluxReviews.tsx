import { Star } from "lucide-react";

export function FluxReviews() {
  const reviews = [
    { name: "Александр В.", service: "TG Подписчики", text: "Заказывал подписчиков в канал. Выполнили даже быстрее заявленного, списаний за 2 недели не было. Рекомендую.", stars: 5 },
    { name: "Мария К.", service: "Instagram Лайки", text: "Очень удобный интерфейс, всё понятно без лишних кнопок. Заказала услугу с гарантией — всё отлично. Буду пользоваться.", stars: 5 },
    { name: "Денис П.", service: "VK Просмотры", text: "Топ за свои деньги. Пользовался другим сервисом, тут цены ниже, а качество выше. Радует что оплата без пополнений.", stars: 5 },
  ];

  const reviewsJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "SMMflux Platform",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "1280",
      "bestRating": "5",
    },
    "review": reviews.map((r) => ({
      "@type": "Review",
      "author": {
        "@type": "Person",
        "name": r.name,
      },
      "reviewBody": r.text,
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": r.stars,
        "bestRating": "5",
      },
    })),
  };

  const avatarColors = [
    { bg: "bg-purple-100 dark:bg-purple-950/60", text: "text-purple-600 dark:text-purple-300", badge: "text-purple-600 dark:text-purple-400" },
    { bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-600 dark:text-emerald-300", badge: "text-emerald-600 dark:text-emerald-400" },
    { bg: "bg-sky-100 dark:bg-sky-950/60", text: "text-sky-600 dark:text-sky-300", badge: "text-sky-600 dark:text-sky-400" },
  ];

  return (
    <section aria-label="Примеры отзывов реальных клиентов" className="w-full py-14 px-4 max-w-7xl mx-auto border-t border-slate-200/60 dark:border-white/10 relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewsJsonLd).replace(/</g, '\\u003c') }}
      />
      <div className="max-w-6xl mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-4">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>Реальный опыт клиентов</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight text-balance">
            Отзывы наших клиентов
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300 font-medium max-w-xl mx-auto text-pretty">
            Более 100 000 выполненных заказов. Доверие профессионалов. Средняя оценка 4.9/5
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((r, i) => {
            const color = avatarColors[i % avatarColors.length];
            return (
              <div key={i} className="bg-white dark:bg-[#0f172a] rounded-3xl p-6 md:p-8 border border-slate-200/90 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.08)] transition-all relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl opacity-50 pointer-events-none group-hover:scale-125 transition-transform" />
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className={`w-4 h-4 ${star <= r.stars ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-slate-700'}`} />
                  ))}
                </div>
                <p className="text-slate-700 dark:text-slate-200 font-medium mb-6 leading-relaxed relative z-10 text-pretty">
                  "{r.text}"
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/10">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{r.name}</h4>
                    <p className={`text-xs font-semibold mt-0.5 ${color.badge}`}>{r.service}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-full ${color.bg} ${color.text} flex items-center justify-center font-bold text-sm uppercase shadow-sm border border-black/5`}>
                    {r.name[0]}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
