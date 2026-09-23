import { db as prisma } from "@/lib/db";
import { enforceSectionAccess } from "@/lib/server/rbac";
import CMSForm from "@/components/admin/cms/CMSForm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Редактировать статью | CMS",
};

interface EditPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCmsPage({ params }: EditPageProps) {
  await enforceSectionAccess('content');
  const resolvedParams = await params;

  const item = await prisma.contentItem.findUnique({
    where: { id: resolvedParams.id },
  });

  if (!item) {
    notFound();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild intent="ghost">
            <Link href="/admin/cms">
              ← Назад
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Редактировать статью</h1>
            <p className="text-sm text-muted-foreground mt-1">ID: {item.id}</p>
          </div>
        </div>
        <Button asChild intent="secondary">
          <Link href={`/api/draft?slug=${item.slug}`} target="_blank">
            Предпросмотр (Draft Mode)
          </Link>
        </Button>
      </div>

      <CMSForm initialData={item} />
    </div>
  );
}
