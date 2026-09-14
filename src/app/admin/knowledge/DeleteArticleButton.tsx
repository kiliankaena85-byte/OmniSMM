'use client';

import { deleteArticle } from "@/actions/knowledge";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import React from "react";

interface DeleteArticleButtonProps {
  id: string;
}

export function DeleteArticleButton({ id }: DeleteArticleButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!confirm("Вы действительно хотите удалить эту статью? Это действие необратимо.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await deleteArticle(id);
      if (res.success) {
        toast.success("Статья успешно удалена!");
        router.refresh();
      } else {
        toast.error(res.error || "Не удалось удалить статью");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Произошла ошибка при удалении статьи";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="px-3 py-1.5 bg-destructive/10 hover:bg-destructive/20 active:scale-[0.98] disabled:opacity-50 text-destructive font-semibold text-xs rounded-lg transition-all flex items-center justify-center cursor-pointer"
      title="Удалить статью"
    >
      {isDeleting ? "Удаление..." : "Удалить"}
    </button>
  );
}
