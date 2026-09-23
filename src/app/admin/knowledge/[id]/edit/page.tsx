import { enforceSectionAccess } from "@/lib/server/rbac";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { ArticleForm } from "../../ArticleForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const article = await db.article.findUnique({
    where: { id },
    select: { title: true }
  });

  return {
    title: article 
      ? `Редактирование: ${article.title} | Панель управления` 
      : "Редактирование статьи | Панель управления"
  };
}

export default async function AdminEditArticlePage({ params }: PageProps) {
  // 1. Strict access guard
  await enforceSectionAccess('content');

  // 2. Resolve parameters & fetch article
  const { id } = await params;
  const article = await db.article.findUnique({
    where: { id }
  });

  if (!article) {
    notFound();
  }

  // 3. Format state structure matching initialData shape
  const initialData = {
    id: article.id,
    title: article.title,
    slug: article.slug,
    description: article.description,
    content: article.content,
    status: article.status as "DRAFT" | "PUBLISHED",
    category: article.category,
    authorName: article.authorName,
    authorRole: article.authorRole,
  };

  return (
    <div className="min-h-full pb-10">
      <ArticleForm initialData={initialData} />
    </div>
  );
}
