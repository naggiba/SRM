import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { orders, payments, extraExpenses, withdrawals } from "@/lib/schema";

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

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

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
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 sm:px-6 py-3 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-800">Аналітика</h1>
          <a href="/dashboard" className="text-sm text-blue-600 hover:underline">← Головна</a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5">
        {/* === 4 Метрики === */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

        {/* === Останні замовлення + Статуси === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[o.status] ?? "bg-gray-300"}`} />
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
              <div className="space-y-2">
                {(["WAITING_PAYMENT", "CLIENT_PAID", "ORDERED", "SENT_TO_CARGO"] as const).map((st) => {
                  const count = statusCounts[st] ?? 0;
                  return (
                    <div key={st} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[st]}`} />
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
      </main>
    </div>
  );
}

// === MetricCard ===

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
