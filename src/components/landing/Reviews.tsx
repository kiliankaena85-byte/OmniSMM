import { Star } from "lucide-react";

export function Reviews() {
  const reviews = [
    { name: "Александр В.", service: "TG Подписчики", text: "Заказывал подписчиков в канал. Выполнили даже быстрее заявленного, списаний за 2 недели не было. Рекомендую.", stars: 5 },
    { name: "Мария К.", service: "Instagram Лайки", text: "Очень удобный интерфейс, всё понятно без лишних кнопок. Заказала услугу с гарантией — всё отлично. Буду пользоваться.", stars: 5 },
    { name: "Денис П.", service: "VK Просмотры", text: "Топ за свои деньги. Пользовался другим сервисом, тут цены ниже, а качество выше. Радует что оплата без пополнений.", stars: 5 },
  ];

  return (
    <section className="py-10 md:py-20 bg-content2 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight text-balance">
            Отзывы наших клиентов
          </h2>
          <p className="mt-4 text-muted-foreground font-medium max-w-xl mx-auto text-pretty">
            Более 100 000 выполненных заказов. Доверие профессионалов. Средняя оценка 4.9/5
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((r, i) => (
            <div key={i} className="bg-content1 rounded-3xl p-6 md:p-8 border border-border/50 ring-1 ring-black/5 shadow-sm hover:shadow-xl transition-shadow relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className={`w-4 h-4 ${star <= r.stars ? 'text-warning fill-warning' : 'text-border'}`} />
                ))}
              </div>
              <p className="text-foreground font-medium mb-6 leading-relaxed relative z-10 text-pretty">
                "{r.text}"
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div>
                  <h4 className="font-bold text-foreground text-sm">{r.name}</h4>
                  <p className="text-xs text-primary font-medium mt-0.5">{r.service}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-default-100 flex items-center justify-center text-muted-foreground font-bold text-xs uppercase">
                  {r.name[0]}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
