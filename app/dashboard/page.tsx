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
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">CRM Система</h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-800">
                {session.user?.name}
              </p>
              <p className="text-xs text-gray-500">{session.user?.email}</p>
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleColors[role] ?? "bg-gray-100 text-gray-700"}`}
            >
              {roleLabels[role] ?? role}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <a href="/orders" className="block">
            <StatCard label="Замовлення" value={String(orderCount)} note="переглянути список →" />
          </a>
          <a href="/orders" className="block">
            <StatCard label="Відправлені товари" value={String(sentCount)} note="статус: На карго →" />
          </a>
          <a href="/clients" className="block">
            <StatCard label="Клієнти" value={String(clientCount)} note="переглянути список →" />
          </a>
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <NavCard href="/orders" title="Замовлення" desc="Список замовлень, фото товарів" />
          <NavCard href="/clients" title="Клієнти" desc="Список клієнтів, пошук, додавання" />
          <NavCard href="/products" title="Каталог товарів" desc="Моделі, фото, ціни" />
          <NavCard href="/finance" title="Фінанси" desc="Загальний підсумок, прибутки, витрати" />
          {role === "ADMIN" && (
            <NavCard href="/admin/users" title="Користувачі" desc="Управління акаунтами та ролями" />
          )}
        </div>

        <div className="mt-2 bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-gray-500 text-sm">
            Наступний крок — статистика та фільтри по замовленнях.
          </p>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 transition">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{note}</p>
    </div>
  );
}

function NavCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <a
      href={href}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-400 hover:shadow-sm transition flex items-center justify-between group"
    >
      <div>
        <p className="font-semibold text-gray-800 group-hover:text-blue-600 transition">{title}</p>
        <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
      </div>
      <span className="text-gray-400 group-hover:text-blue-500 transition text-lg">→</span>
    </a>
  );
}
