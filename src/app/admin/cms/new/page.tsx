import { enforceSectionAccess } from "@/lib/server/rbac";
import CMSForm from "@/components/admin/cms/CMSForm";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Создать статью | CMS",
};

export default async function NewCmsPage() {
  await enforceSectionAccess('content');

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button asChild intent="ghost">
          <Link href="/admin/cms">
            ← Назад
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Новая статья</h1>
        </div>
      </div>

      <CMSForm initialData={null} />
    </div>
  );
}
