'use server';

import { db as prisma } from "@/lib/db";
import { requireStaffPermission } from "@/lib/server/rbac";
import { revalidateTag } from "next/cache";
import { z } from "zod";

const contentSchema = z.object({
  title: z.string().min(3, "Заголовок должен быть длиннее 3 символов"),
  slug: z.string().min(2, "Slug обязателен").refine((val) => {
    const reservedWords = ["api", "admin", "auth", "_next", "static", "dashboard", "orders", "draft"];
    return !reservedWords.includes(val.toLowerCase());
  }, "Этот URL зарезервирован системой"),
  type: z.enum(["PAGE", "ACADEMY_LESSON", "GLOSSARY_TERM", "NEWS_POST"]),
  categoryId: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  contentJson: z.string().nullable().optional(),
  isPublished: z.boolean().default(false),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
});

const invalidateTag = revalidateTag as (tag: string) => void;

export async function createContent(formData: FormData) {
  return requireStaffPermission('content', 'edit', async () => {
    const data = {
      title: formData.get("title") as string,
      slug: formData.get("slug") as string,
      type: formData.get("type") as "PAGE" | "ACADEMY_LESSON" | "GLOSSARY_TERM" | "NEWS_POST",
      categoryId: formData.get("categoryId") as string || null,
    };

    const parsed = contentSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false as const, errors: parsed.error.flatten().fieldErrors };
    }

    try {
      const item = await prisma.contentItem.create({
        data: {
          ...parsed.data,
          authorName: "Администратор", 
        },
      });

      invalidateTag("cms-list");
      return { success: true as const, item };
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "P2002") {
        return { success: false as const, error: "Статья с таким URL (slug) уже существует." };
      }
      return { success: false as const, error: "Ошибка базы данных" };
    }
  });
}

const contentUpdateSchema = z.object({
  title: z.string().min(3).optional(),
  slug: z.string().min(2).refine((val) => {
    const reservedWords: string[] = ["api", "admin", "auth", "_next", "static", "dashboard", "orders", "draft"];
    return !reservedWords.includes(val.toLowerCase());
  }, "Этот URL зарезервирован системой").optional(),
  type: z.enum(["PAGE", "ACADEMY_LESSON", "GLOSSARY_TERM", "NEWS_POST"]).optional(),
  categoryId: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  contentJson: z.string().nullable().optional(),
  isPublished: z.boolean().optional(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
}).strict(); 

export async function updateContent(id: string, updateData: Partial<z.infer<typeof contentSchema>>) {
  return requireStaffPermission('content', 'edit', async () => {
    const parsed = contentUpdateSchema.safeParse(updateData);
    if (!parsed.success) {
      return { success: false as const, error: "Невалидные данные для обновления", errors: parsed.error.flatten().fieldErrors };
    }

    try {
      const item = await prisma.contentItem.update({
        where: { id },
        data: parsed.data,
      });

      invalidateTag(`article-${item.slug}`);
      invalidateTag("cms-list");

      return { success: true as const, item };
    } catch {
      return { success: false as const, error: "Ошибка при обновлении статьи" };
    }
  });
}

export async function publishContent(id: string) {
  return requireStaffPermission('content', 'edit', async () => {
    try {
      const item = await prisma.contentItem.findUnique({ where: { id } });
      if (!item || !item.contentJson) {
        return { success: false as const, error: "Статья не найдена или пустая" };
      }

      const { ServerBlockNoteEditor } = await import("@blocknote/server-util");
      
      const editor = ServerBlockNoteEditor.create();
      const blocks = JSON.parse(item.contentJson);
      const contentHtml = await editor.blocksToHTMLLossy(blocks);

      const updated = await prisma.contentItem.update({
        where: { id },
        data: {
          contentHtml,
          isPublished: true,
          publishedAt: item.publishedAt || new Date(),
        },
      });

      invalidateTag(`article-${item.slug}`);
      invalidateTag("cms-list");

      return { success: true as const, item: updated };
    } catch (error) {
      console.error("Publish error:", error);
      return { success: false as const, error: "Ошибка при генерации HTML или публикации" };
    }
  });
}

export async function unpublishContent(id: string) {
  return requireStaffPermission('content', 'edit', async () => {
    try {
      const updated = await prisma.contentItem.update({
        where: { id },
        data: {
          isPublished: false,
        },
      });

      invalidateTag(`article-${updated.slug}`);
      invalidateTag("cms-list");

      return { success: true as const, item: updated };
    } catch {
      return { success: false as const, error: "Ошибка при снятии с публикации" };
    }
  });
}
