import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

const roleLabels: Record<string, string> = {
  ADMIN: "Адміністратор",
  MANAGER: "Менеджер",
  VIEWER: "Читач",
};

const roleColors: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700",
  MANAGER: "bg-blue-100 text-blue-700",
  VIEWER: "bg-gray-100 text-gray-700",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session.user as { role: string }).role;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 sm:px-6 py-3 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-bold">C</span>
            </div>
            <h1 className="text-lg font-bold text-gray-800">CRM Система</h1>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="text-right min-w-0 hidden sm:block">
              <p className="text-sm font-medium text-gray-800 truncate leading-tight">
                {session.user?.name}
              </p>
              <p className="text-xs text-gray-500 truncate leading-tight">{session.user?.email}</p>
            </div>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${roleColors[role] ?? "bg-gray-100 text-gray-700"}`}
            >
              {roleLabels[role] ?? role}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
        <p className="text-sm text-gray-500 mb-4 sm:hidden">
          Привіт, <span className="font-medium text-gray-700">{session.user?.name}</span>
        </p>

        {/* Головні розділи */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Головне</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <NavCard href="/orders" title="Замовлення" desc="Список, фото товарів" color="blue" icon="orders" />
          <NavCard href="/tasks" title="Задачі" desc="Що робити зараз" color="orange" icon="tasks" />
          <NavCard href="/products" title="Каталог товарів" desc="Моделі, фото, ціни" color="green" icon="catalog" />
        </div>

        {/* Другорядні розділи */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ще</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <NavCard href="/clients" title="Клієнти" desc="Пошук, додавання" compact icon="clients" />
          <NavCard href="/finance" title="Фінанси" desc="Підсумок, прибутки" compact icon="finance" />
          <NavCard href="/analytics" title="Аналітика" desc="Метрики, статуси" compact icon="analytics" />
          {role === "ADMIN" && (
            <NavCard href="/admin/users" title="Користувачі" desc="Акаунти, ролі" compact icon="users" />
          )}
        </div>
      </main>
    </div>
  );
}

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: "bg-blue-50", text: "text-blue-600", border: "hover:border-blue-300" },
  orange: { bg: "bg-orange-50", text: "text-orange-600", border: "hover:border-orange-300" },
  green: { bg: "bg-green-50", text: "text-green-600", border: "hover:border-green-300" },
};

function CardIcon({ name, className }: { name: string; className: string }) {
  const common = { className, fill: "none" as const, stroke: "currentColor" as const, strokeWidth: 1.8, viewBox: "0 0 24 24" };
  switch (name) {
    case "orders":
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4m0-14v14m9-14v10l-9 4" /></svg>;
    case "tasks":
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
    case "catalog":
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
    case "clients":
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m5-3.13a4 4 0 100-8 4 4 0 000 8zm6 3.13V16a4 4 0 00-4-4h-4a4 4 0 00-4 4v.13" /></svg>;
    case "finance":
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m0-14a9 9 0 100 18 9 9 0 000-18z" /></svg>;
    case "analytics":
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
    case "users":
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
    default:
      return null;
  }
}

function NavCard({
  href,
  title,
  desc,
  color = "blue",
  icon,
  compact,
}: {
  href: string;
  title: string;
  desc: string;
  color?: string;
  icon: string;
  compact?: boolean;
}) {
  const c = colorMap[color] ?? colorMap.blue;

  if (compact) {
    return (
      <a
        href={href}
        className="bg-white rounded-lg border border-gray-200 px-3 py-2.5 hover:border-gray-300 hover:shadow-sm transition flex items-center gap-2.5 group active:scale-[0.98]"
      >
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-gray-200 transition">
          <CardIcon name={icon} className="w-4 h-4 text-gray-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-700 truncate">{title}</p>
          <p className="text-xs text-gray-400 truncate">{desc}</p>
        </div>
      </a>
    );
  }

  return (
    <a
      href={href}
      className={`bg-white rounded-xl border border-gray-200 p-4 ${c.border} hover:shadow-md transition flex items-center gap-3 group active:scale-[0.98]`}
    >
      <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
        <CardIcon name={icon} className={`w-5 h-5 ${c.text}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-800 transition">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{desc}</p>
      </div>
      <span className="text-gray-300 group-hover:text-gray-400 transition text-lg shrink-0">→</span>
    </a>
  );
}
