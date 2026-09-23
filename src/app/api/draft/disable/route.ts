import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
  const draft = await draftMode();
  draft.disable();

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  // После отключения возвращаем пользователя на ту же страницу (или на главную)
  if (slug) {
    redirect(`/p/${slug}`);
  } else {
    redirect("/");
  }
}
