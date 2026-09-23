import React, { useMemo } from "react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { CategoryIcon, cleanCategoryName } from "@/components/ui/CategoryIcon";
import { ChevronRight } from "lucide-react";

function getCategoryDemandScore(name: string): number {
  const n = name.toLowerCase();
  
  if ((n.includes('подписчик') || n.includes('участник') || n.includes('follow') || n.includes('member')) && !n.includes('premium') && !n.includes('премиум') && !n.includes('бот')) {
    return 10;
  }
  if (n.includes('просмотр') || n.includes('охват') || n.includes('view') || n.includes('watch') || n.includes('stat') || n.includes('стат')) {
    return 20;
  }
  if (n.includes('лайк') || n.includes('like') || n.includes('нравится') || n.includes('heart')) {
    return 30;
  }
  if (n.includes('реакц') || n.includes('reaction') || n.includes('emoji') || n.includes('эмоци')) {
    return 40;
  }
  if (n.includes('premium') || n.includes('премиум')) {
    return 95;
  }
  if (n.includes('буст') || n.includes('boost') || n.includes('level')) {
    return 60;
  }
  if (n.includes('коммент') || n.includes('comment') || n.includes('отзыв') || n.includes('review')) {
    return 70;
  }
  if (n.includes('репост') || n.includes('repost') || n.includes('share') || n.includes('поделит')) {
    return 80;
  }
  if (n.includes('звезд') || n.includes('star') || n.includes('coin')) {
    return 90;
  }
  if (n.includes('бот') || n.includes('bot') || n.includes('инвайт') || n.includes('invite') || n.includes('referral') || n.includes('рефер')) {
    return 100;
  }
  return 999;
}

export function CategorySidebar({ engine }: { engine: OrderEngine }) {
  const { availableCategories, categoryId, setCategoryId } = engine;
  
  if (availableCategories.length === 0) {
    return null;
  }
 
  const sortedCategories = useMemo(() => {
    return [...availableCategories].sort((a, b) => {
      const scoreA = getCategoryDemandScore(a.name);
      const scoreB = getCategoryDemandScore(b.name);
      
      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }
      return a.name.localeCompare(b.name);
    });
  }, [availableCategories]);

  return (
    <div data-testid="category-sidebar" className="hidden md:flex lg:flex-col flex-row flex-wrap lg:flex-nowrap lg:border-r border-border/50 p-4 lg:p-6 gap-3 bg-content2/50 shrink-0 lg:w-[280px] xl:w-[320px] items-center lg:items-stretch lg:sticky lg:top-24">
      {sortedCategories.map(cat => (
        <button
          key={cat.id}
          onClick={(e) => {
            e.preventDefault();
            engine.setSelectedService(null);
            setCategoryId(cat.id);
          }}
          className={`text-left px-5 py-3 lg:py-4 rounded-full lg:rounded-[1.5rem] text-[15px] font-bold transition-all duration-200 whitespace-nowrap lg:whitespace-normal shrink-0 lg:shrink group flex items-center justify-between active:scale-95 ${
            categoryId === cat.id 
              ? 'bg-content1 text-primary shadow-[0_8px_30px_-6px_rgba(0,0,0,0.08)] ring-1 ring-slate-100 scale-[1.02]'
              : 'bg-transparent text-muted-foreground hover:bg-default-100/80 hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-3">
            <CategoryIcon name={cat.name} icon={(cat as { icon?: string | null }).icon} className={categoryId === cat.id ? "text-primary" : "text-muted-foreground"} />
            <span>{cleanCategoryName(cat.name)}</span>
          </div>
          {categoryId === cat.id && <ChevronRight className="hidden lg:block w-5 h-5 opacity-100 translate-x-0 shrink-0" />}
        </button>
      ))}
    </div>
  );
}
