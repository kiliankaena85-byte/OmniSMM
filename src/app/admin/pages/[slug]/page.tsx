import { db } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminPageEditorRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  if (slug === 'new') {
    redirect('/admin/cms/new');
  }

  // Find the page in ContentItem by slug
  const contentItem = await db.contentItem.findFirst({
    where: { slug }
  });

  if (!contentItem) {
    // Check legacy Page table just in case
    const legacyPage = await db.page.findUnique({
      where: { slug }
    });
    if (legacyPage) {
      // Legacy page found, we redirect to CMS list or notFound
      redirect('/admin/pages');
    }
    return notFound();
  }

  // Redirect to the newer editor
  redirect(`/admin/cms/${contentItem.id}`);
}
