import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { db as prisma } from "@/lib/db";
import { enforcePageRole } from "@/lib/server/rbac";

export async function GET(request: Request) {
  // Защищаем роут. Только админ может включить Draft Mode.
  try {
    await enforcePageRole(["ADMIN", "OWNER"]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Парсим параметры
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return new Response("Missing slug", { status: 400 });
  }

  // Проверяем существование статьи
  const post = await prisma.contentItem.findUnique({
    where: { slug },
  });

  if (!post) {
    return new Response("Post not found", { status: 404 });
  }

  // Включаем Draft Mode (Next.js устанавливает cookie)
  const draft = await draftMode();
  draft.enable();

  // Редирект на страницу со статьей
  if (post.type === 'ACADEMY_LESSON') {
    redirect(`/academy/${post.slug}`);
  } else if (post.type === 'PAGE' && ['terms', 'privacy', 'refund', 'cookie'].includes(post.slug)) {
    redirect(`/legal/${post.slug}`);
  } else {
    redirect(`/p/${post.slug}`);
  }
}
