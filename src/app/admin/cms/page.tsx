import { db as prisma } from "@/lib/db";
import { enforceSectionAccess } from "@/lib/server/rbac";
import Link from "next/link";
import { CMSTable } from "@/components/admin/cms/CMSTable";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { AdminTabbedHeader } from "@/components/admin/tabbed-header";
import { SYSTEM_TABS, ONBOARDING_CONFIGS } from "@/components/admin/navigation-data";

export const metadata = {
  title: "CMS | Управление контентом",
};

export default async function AdminCmsPage() {
  await enforceSectionAccess('content');

  const items = await prisma.contentItem.findMany({
    orderBy: { createdAt: "desc" },
    include: { category: true },
  });

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out min-h-full pb-10">
      <AdminTabbedHeader
        icon={FileText}
        title="Контент (CMS)"
        description="Управление страницами сайта, статьями блога и уроками академии"
        action={(
          <Button asChild intent="primary">
            <Link href="/admin/cms/new">
              + Создать контент
            </Link>
          </Button>
        )}
        tabs={SYSTEM_TABS}
        onboardingKey="pages"
        onboarding={ONBOARDING_CONFIGS.pages}
      />

      <div className="rounded-lg border border-border/70 shadow-xs bg-card overflow-hidden">
        <CMSTable items={items} />
      </div>
    </div>
  );
}
