import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { db } from "@/lib/db";
import { clients, orders } from "@/lib/schema";
import { count, eq } from "drizzle-orm";

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

  // Паралельні запити
  const [clientResult, orderResult, sentResult] = await Promise.all([
    db.select({ value: count() }).from(clients),
    db.select({ value: count() }).from(orders),
    db.select({ value: count() }).from(orders).where(eq(orders.status, "SENT_TO_CARGO")),
  ]);
  const clientCount = clientResult[0].value;
  const orderCount = orderResult[0].value;
  const sentCount = sentResult[0].value;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h1 className="text-lg font-bold text-gray-800">CRM Система</h1>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="text-right min-w-0">
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
        {/* Compact stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <a href="/orders" className="block">
            <StatCard label="Замовлення" value={String(orderCount)} />
          </a>
          <a href="/orders" className="block">
            <StatCard label="Відправлено" value={String(sentCount)} />
          </a>
          <a href="/clients" className="block">
            <StatCard label="Клієнти" value={String(clientCount)} />
          </a>
        </div>

        {/* Головні розділи */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <NavCard href="/orders" title="Замовлення" desc="Список, фото товарів" primary />
          <NavCard href="/tasks" title="Задачі" desc="Що робити зараз" primary />
          <NavCard href="/products" title="Каталог товарів" desc="Моделі, фото, ціни" primary />
        </div>

        {/* Другорядні розділи */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
          <NavCard href="/clients" title="Клієнти" desc="Пошук, додавання" />
          <NavCard href="/finance" title="Фінанси" desc="Підсумок, прибутки" />
          {role === "ADMIN" && (
            <NavCard href="/admin/users" title="Користувачі" desc="Акаунти, ролі" />
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-3 py-2.5 hover:border-blue-300 transition">
      <p className="text-xs text-gray-500 leading-tight">{label}</p>
      <p className="text-xl font-bold text-gray-800 leading-tight mt-0.5">{value}</p>
    </div>
  );
}

function NavCard({
  href,
  title,
  desc,
  primary,
}: {
  href: string;
  title: string;
  desc: string;
  primary?: boolean;
}) {
  if (primary) {
    return (
      <a
        href={href}
        className="bg-white rounded-xl border-2 border-blue-100 p-4 hover:border-blue-400 hover:shadow-sm transition flex items-center justify-between group"
      >
        <div>
          <p className="font-semibold text-gray-800 group-hover:text-blue-600 transition">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
        </div>
        <span className="text-blue-400 group-hover:text-blue-600 transition text-lg">→</span>
      </a>
    );
  }
  return (
    <a
      href={href}
      className="bg-white rounded-lg border border-gray-200 px-3 py-2 hover:border-gray-300 transition flex items-center justify-between group"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-600 group-hover:text-gray-800 transition truncate">{title}</p>
        <p className="text-xs text-gray-400 truncate">{desc}</p>
      </div>
      <span className="text-gray-300 group-hover:text-gray-500 transition text-sm shrink-0 ml-2">→</span>
    </a>
  );
}
