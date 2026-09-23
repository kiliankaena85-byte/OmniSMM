import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-500">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-extrabold text-foreground mb-2">403 — Доступ ограничен</h1>
      <p className="text-muted-foreground max-w-md mb-6 text-sm leading-relaxed">
        У вашей текущей роли персонала нет разрешений для просмотра этого раздела административной панели.
        Если вам нужен доступ, обратитесь к Владельцу или Администратору системы.
      </p>
      <Link
        href="/admin/dashboard"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-all shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Вернуться на Дашборд
      </Link>
    </div>
  );
}
