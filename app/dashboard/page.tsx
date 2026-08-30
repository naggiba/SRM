import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { orders, payments, extraExpenses, withdrawals } from "@/lib/schema";
import { gte, desc } from "drizzle-orm";
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

const STATUS_LABELS: Record<string, string> = {
  WAITING_PAYMENT: "Очікуємо оплату",
  CLIENT_PAID: "Клієнт оплатив",
  ORDERED: "Замовлено",
  SENT_TO_CARGO: "На карго",
};

const STATUS_COLORS: Record<string, string> = {
  WAITING_PAYMENT: "bg-yellow-400",
  CLIENT_PAID: "bg-blue-400",
  ORDERED: "bg-indigo-400",
  SENT_TO_CARGO: "bg-emerald-400",
};

const STATUS_DOT: Record<string, string> = {
  WAITING_PAYMENT: "bg-yellow-400",
  CLIENT_PAID: "bg-blue-400",
  ORDERED: "bg-indigo-400",
  SENT_TO_CARGO: "bg-emerald-400",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session.user as { role: string }).role;

  // --- DB queries ---
  const allOrders = await db.select().from(orders);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString();

  const allPayments = await db.select().from(payments);
  const allExpenses = await db.select().from(extraExpenses);
  const allWithdrawals = await db.select().from(withdrawals);

  // --- Метрики ---
  const activeOrders = allOrders.filter((o) => o.status !== "SENT_TO_CARGO");
  const waitingPayment = allOrders.filter((o) => o.status === "WAITING_PAYMENT");

  // Заробіток за місяць (тільки відправлені за останні 30 днів)
  const recentSent = allOrders.filter(
    (o) => o.status === "SENT_TO_CARGO" && o.createdAt >= since
  );
  const recentSentIds = new Set(recentSent.map((o) => o.id));

  const sentIncome = allPayments
    .filter((p) => p.type === "CLIENT" && recentSentIds.has(p.orderId))
    .reduce((s, p) => {
      const amt = parseFloat(p.amount) || 0;
      if (p.currency === "UAH") {
        const rate = parseFloat(p.exchangeRate ?? "0") || 0;
        return s + (rate > 0 ? amt / rate : 0);
      }
      return s + amt;
    }, 0);

  const sentSupplier = allPayments
    .filter((p) => p.type === "SUPPLIER" && recentSentIds.has(p.orderId))
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  const sentExtra = allExpenses
    .filter((e) => recentSentIds.has(e.orderId))
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  const profitMonth = sentIncome - sentSupplier - sentExtra;

  // Казна (за весь час)
  const totalIncome = allPayments
    .filter((p) => p.type === "CLIENT")
    .reduce((s, p) => {
      const amt = parseFloat(p.amount) || 0;
      if (p.currency === "UAH") {
        const rate = parseFloat(p.exchangeRate ?? "0") || 0;
        return s + (rate > 0 ? amt / rate : 0);
      }
      return s + amt;
    }, 0);

  const totalSupplier = allPayments
    .filter((p) => p.type === "SUPPLIER")
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  const totalExtra = allExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalWithdrawals = allWithdrawals.reduce((s, w) => s + (parseFloat(w.amount) || 0), 0);
  const treasury = totalIncome - totalSupplier - totalExtra - totalWithdrawals;

  // --- Останні 5 замовлень ---
  const recentOrders = [...allOrders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // --- Розподіл по статусах ---
  const statusCounts: Record<string, number> = {};
  for (const o of allOrders) {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
  }
  const totalOrders = allOrders.length;

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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
        <p className="text-sm text-gray-500 mb-4 sm:hidden">
          Привіт, <span className="font-medium text-gray-700">{session.user?.name}</span>
        </p>

        {/* === 4 Метрики === */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <MetricCard
            label="Активних замовлень"
            value={String(activeOrders.length)}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4m0-14v14m9-14v10l-9 4" /></svg>}
            color="blue"
          />
          <MetricCard
            label="Очікують оплати"
            value={String(waitingPayment.length)}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            color="yellow"
          />
          <MetricCard
            label="Заробіток (міс.)"
            value={`${profitMonth >= 0 ? "+" : ""}${profitMonth.toFixed(0)} ¥`}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
            color={profitMonth >= 0 ? "emerald" : "red"}
          />
          <MetricCard
            label="Казна"
            value={`${treasury.toFixed(0)} ¥`}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" /><path strokeLinecap="round" strokeLinejoin="round" d="M2 10h20" /></svg>}
            color="indigo"
          />
        </div>

        {/* === Аналітика: останні замовлення + статуси === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          {/* Останні замовлення */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Останні замовлення</h2>
              <a href="/orders" className="text-xs text-blue-600 hover:underline">Всі →</a>
            </div>
            {recentOrders.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {recentOrders.map((o) => (
                  <a key={o.id} href={`/orders/${o.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[o.status] ?? "bg-gray-300"}`} />
                        <span className="text-sm font-medium text-gray-800 truncate">{o.clientName ?? "—"}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-4 mt-0.5">
                        <span className="text-xs text-gray-400">{o.orderDate ?? new Date(o.createdAt).toLocaleDateString("uk-UA")}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{STATUS_LABELS[o.status] ?? o.status}</span>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-700 shrink-0 ml-3">
                      {o.totalPrice ? `${o.totalPrice} ¥` : "—"}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 px-4 py-6 text-center">Замовлень поки немає</p>
            )}
          </div>

          {/* Розподіл по статусах */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">По статусах</h2>
              <p className="text-xs text-gray-400 mt-0.5">Всього: {totalOrders}</p>
            </div>
            <div className="px-4 py-3 space-y-3">
              {/* Progress bar */}
              {totalOrders > 0 && (
                <div className="flex rounded-full overflow-hidden h-3 bg-gray-100">
                  {(["WAITING_PAYMENT", "CLIENT_PAID", "ORDERED", "SENT_TO_CARGO"] as const).map((st) => {
                    const count = statusCounts[st] ?? 0;
                    if (count === 0) return null;
                    const pct = (count / totalOrders) * 100;
                    return (
                      <div
                        key={st}
                        className={`${STATUS_COLORS[st]} transition-all`}
                        style={{ width: `${pct}%` }}
                        title={`${STATUS_LABELS[st]}: ${count}`}
                      />
                    );
                  })}
                </div>
              )}

              {/* Легенда */}
              <div className="space-y-2">
                {(["WAITING_PAYMENT", "CLIENT_PAID", "ORDERED", "SENT_TO_CARGO"] as const).map((st) => {
                  const count = statusCounts[st] ?? 0;
                  return (
                    <div key={st} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[st]}`} />
                        <span className="text-sm text-gray-600">{STATUS_LABELS[st]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">{count}</span>
                        {totalOrders > 0 && (
                          <span className="text-xs text-gray-400">{((count / totalOrders) * 100).toFixed(0)}%</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* === Навігаційні картки === */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Головне</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <NavCard href="/orders" title="Замовлення" desc="Список, фото товарів" color="blue" icon="orders" />
          <NavCard href="/tasks" title="Задачі" desc="Що робити зараз" color="orange" icon="tasks" />
          <NavCard href="/products" title="Каталог товарів" desc="Моделі, фото, ціни" color="green" icon="catalog" />
        </div>

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ще</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <NavCard href="/clients" title="Клієнти" desc="Пошук, додавання" compact icon="clients" />
          <NavCard href="/finance" title="Фінанси" desc="Підсумок, прибутки" compact icon="finance" />
          {role === "ADMIN" && (
            <NavCard href="/admin/users" title="Користувачі" desc="Акаунти, ролі" compact icon="users" />
          )}
        </div>
      </main>
    </div>
  );
}

// === Компоненти ===

function MetricCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorMap: Record<string, { bg: string; iconBg: string; iconText: string; valueText: string }> = {
    blue:    { bg: "bg-white", iconBg: "bg-blue-100", iconText: "text-blue-600", valueText: "text-gray-900" },
    yellow:  { bg: "bg-white", iconBg: "bg-yellow-100", iconText: "text-yellow-600", valueText: "text-gray-900" },
    emerald: { bg: "bg-white", iconBg: "bg-emerald-100", iconText: "text-emerald-600", valueText: "text-emerald-700" },
    red:     { bg: "bg-white", iconBg: "bg-red-100", iconText: "text-red-600", valueText: "text-red-600" },
    indigo:  { bg: "bg-gradient-to-br from-blue-50 to-indigo-50", iconBg: "bg-blue-100", iconText: "text-blue-600", valueText: "text-blue-700" },
  };
  const c = colorMap[color] ?? colorMap.blue;

  return (
    <div className={`${c.bg} rounded-2xl border border-gray-100 p-4 shadow-sm`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg ${c.iconBg} flex items-center justify-center ${c.iconText}`}>
          {icon}
        </div>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className={`text-xl sm:text-2xl font-bold ${c.valueText}`}>{value}</p>
    </div>
  );
}

const navColorMap: Record<string, { bg: string; text: string; border: string }> = {
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
  const c = navColorMap[color] ?? navColorMap.blue;

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
