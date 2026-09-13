import { enforceSectionAccess } from "@/lib/server/rbac";
import { db } from "@/lib/db";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteArticleButton } from "./DeleteArticleButton";
import { BookOpen, Eye } from "lucide-react";
import { AdminTabbedHeader } from "@/components/admin/tabbed-header";
import { SYSTEM_TABS, ONBOARDING_CONFIGS } from "@/components/admin/navigation-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Управление базой знаний | Панель управления",
};

export default async function AdminKnowledgePage() {
  // 1. Strict access guard
  await enforceSectionAccess('content');

  // 2. Fetch all articles
  const articles = await db.article.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Calculate statistics
  const totalArticles = articles.length;
  const publishedArticles = articles.filter(a => a.status === "PUBLISHED").length;
  const totalViews = articles.reduce((sum, a) => sum + a.viewCount, 0);

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out min-h-full pb-10">
      <AdminTabbedHeader
        icon={BookOpen}
        title="База знаний & Блог"
        description="Публикуйте обучающие руководства, статьи по продвижению и новости платформы SMMplan."
        action={(
          <Link href="/admin/knowledge/create" className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-primary-foreground bg-primary shadow-sm rounded-lg hover:opacity-90 transition-all">
            + Создать Статью
          </Link>
        )}
        tabs={SYSTEM_TABS}
        onboardingKey="knowledge"
        onboarding={ONBOARDING_CONFIGS.knowledge}
      />

      {/* Metrics Widgets block */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Metric 1 */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          <div className="flex justify-between items-start mb-2">
            <span className="text-muted-foreground text-[10px] font-black uppercase tracking-wider">Всего статей</span>
            <span className="text-primary text-xs font-bold bg-primary/10 px-2 py-0.5 rounded-full">Блог</span>
          </div>
          <div className="text-2xl font-black text-foreground tabular-nums">
            {totalArticles}
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-success" />
          <div className="flex justify-between items-start mb-2">
            <span className="text-muted-foreground text-[10px] font-black uppercase tracking-wider">Опубликовано</span>
            <span className="text-success text-xs font-bold bg-success/10 px-2 py-0.5 rounded-full">Публичные</span>
          </div>
          <div className="text-2xl font-black text-foreground tabular-nums">
            {publishedArticles} / {totalArticles}
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-warning" />
          <div className="flex justify-between items-start mb-2">
            <span className="text-muted-foreground text-[10px] font-black uppercase tracking-wider">Всего просмотров</span>
            <span className="text-warning text-xs font-bold bg-warning/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
              <Eye className="w-3 h-3 shrink-0" /> Views
            </span>
          </div>
          <div className="text-2xl font-black text-foreground tabular-nums">
            {totalViews.toLocaleString("ru-RU")}
          </div>
        </div>
      </div>

      {/* Main Table section */}
      <div className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">
        {articles.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-8">
            <BookOpen className="w-12 h-12 text-muted-foreground/40 mb-3 shrink-0" />
            <h3 className="font-bold text-foreground text-lg mb-1">Статьи отсутствуют</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Вы еще не опубликовали ни одной статьи. Нажмите кнопку «Создать статью» выше, чтобы начать!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-hide">
            <Table aria-label="Таблица статей базы знаний">
              <TableHeader>
                <TableRow className="border-b border-border/40 hover:bg-transparent">
                  <TableHead className="font-bold text-xs text-muted-foreground uppercase tracking-wider py-4 pl-6">Заголовок / Slug</TableHead>
                  <TableHead className="font-bold text-xs text-muted-foreground uppercase tracking-wider py-4">Категория</TableHead>
                  <TableHead className="font-bold text-xs text-muted-foreground uppercase tracking-wider py-4">Статус</TableHead>
                  <TableHead className="font-bold text-xs text-muted-foreground uppercase tracking-wider py-4 text-center">Просмотры</TableHead>
                  <TableHead className="font-bold text-xs text-muted-foreground uppercase tracking-wider py-4">Дата создания</TableHead>
                  <TableHead className="font-bold text-xs text-muted-foreground uppercase tracking-wider py-4 text-right pr-6">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.map((item) => {
                  const dateStr = new Date(item.createdAt).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                  });

                  return (
                    <TableRow key={item.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                      {/* Title & Slug */}
                      <TableCell className="py-4 pl-6">
                        <div className="flex flex-col space-y-0.5">
                          <span className="font-bold text-sm text-foreground leading-snug line-clamp-1">
                            {item.title}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            /{item.slug}
                          </span>
                        </div>
                      </TableCell>

                      {/* Category */}
                      <TableCell className="py-4">
                        <span className="bg-primary/5 text-primary text-xs font-bold px-2.5 py-1 rounded-lg">
                          {item.category}
                        </span>
                      </TableCell>

                      {/* Publish Status */}
                      <TableCell className="py-4">
                        <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-wider ${
                          item.status === "PUBLISHED" 
                            ? "bg-success/5 text-success border-success/20" 
                            : "bg-muted text-muted-foreground border-border"
                        }`}>
                          {item.status === "PUBLISHED" ? "Опубликовано" : "Черновик"}
                        </span>
                      </TableCell>

                      {/* Views count */}
                      <TableCell className="py-4 text-center tabular-nums font-semibold text-sm text-foreground">
                        {item.viewCount}
                      </TableCell>

                      {/* Created At Date */}
                      <TableCell className="py-4 text-xs font-semibold text-muted-foreground">
                        {dateStr}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link 
                            href={`/knowledge/${item.slug}`} 
                            target="_blank"
                            className="min-h-[44px] min-w-[80px] px-3 py-2 bg-muted/60 hover:bg-muted active:scale-[0.98] text-foreground font-bold text-xs rounded-xl transition-all flex items-center justify-center cursor-pointer"
                          >
                            Просмотр
                          </Link>
                          <Link 
                            href={`/admin/knowledge/${item.id}/edit`} 
                            className="min-h-[44px] min-w-[108px] px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] font-bold text-xs rounded-xl transition-all flex items-center justify-center cursor-pointer"
                          >
                            Редактировать
                          </Link>
                          <DeleteArticleButton id={item.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
