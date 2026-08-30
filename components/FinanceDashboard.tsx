"use client";

import { useState, useEffect, useCallback } from "react";

type Period = "all" | "month" | "week";

interface OrderRow {
  id: string;
  clientName: string | null;
  orderDate: string | null;
  createdAt: string;
  status: string;
  totalCNY: number;
  clientPaidCNY: number;
  wePaidCNY: number;
  expensesCNY: number;
  profit: number;
}

interface FinanceData {
  period: Period;
  orderCount: number;
  totalCNY: number;
  clientPaidCNY: number;
  clientPaidUAH: number;
  wePaidCNY: number;
  expensesCNY: number;
  profit: number;
  withdrawalsCNY: number;
  withdrawalsByCategory: Record<string, number>;
  balanceAfterWithdrawals: number;
  byOrder: OrderRow[];
}

interface WithdrawalCategory {
  id: string;
  name: string;
}

interface WithdrawalRow {
  id: string;
  categoryId: string | null;
  categoryName: string;
  amount: string;
  note: string | null;
  createdAt: string;
  createdBy: string;
}

const STATUS_LABELS: Record<string, string> = {
  WAITING_PAYMENT: "Очікуємо оплату",
  CLIENT_PAID: "Клієнт оплатив",
  ORDERED: "Замовлено",
  SENT_TO_CARGO: "На карго",
};

const PERIOD_LABELS: Record<Period, string> = {
  all: "За весь час",
  month: "За місяць",
  week: "За тиждень",
};

export default function FinanceDashboard() {
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<WithdrawalCategory[]>([]);
  const [withdrawalsList, setWithdrawalsList] = useState<WithdrawalRow[]>([]);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [wCategoryId, setWCategoryId] = useState("");
  const [wNewCategory, setWNewCategory] = useState("");
  const [wAmount, setWAmount] = useState("");
  const [wNote, setWNote] = useState("");
  const [wSaving, setWSaving] = useState(false);
  const [wError, setWError] = useState("");

  const loadFinance = useCallback(() => {
    fetch(`/api/finance?period=${period}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period]);

  const loadWithdrawals = useCallback(() => {
    fetch(`/api/withdrawals?period=${period}`)
      .then((r) => r.json())
      .then((d) => setWithdrawalsList(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [period]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      loadFinance();
      loadWithdrawals();
    }, 0);
    return () => clearTimeout(timer);
  }, [period, loadFinance, loadWithdrawals]);

  useEffect(() => {
    fetch("/api/withdrawal-categories")
      .then((r) => r.json())
      .then((d) => setCategories(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  async function handleAddWithdrawal(e: React.FormEvent) {
    e.preventDefault();
    setWError("");

    const categoryName = wCategoryId
      ? categories.find((c) => c.id === wCategoryId)?.name ?? ""
      : wNewCategory.trim();

    if (!categoryName) {
      setWError("Оберіть або введіть категорію");
      return;
    }
    if (!wAmount || parseFloat(wAmount) <= 0) {
      setWError("Вкажіть коректну суму");
      return;
    }

    setWSaving(true);
    const res = await fetch("/api/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: wCategoryId || null,
        categoryName,
        amount: wAmount,
        note: wNote,
      }),
    });
    setWSaving(false);

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setWError(d.error ?? "Помилка збереження");
      return;
    }

    setWCategoryId("");
    setWNewCategory("");
    setWAmount("");
    setWNote("");
    setShowWithdrawForm(false);

    // Оновлюємо категорії (могла з'явитись нова) та дані
    fetch("/api/withdrawal-categories").then((r) => r.json()).then((d) => setCategories(Array.isArray(d) ? d : []));
    loadFinance();
    loadWithdrawals();
  }

  async function handleDeleteWithdrawal(id: string) {
    if (!confirm("Видалити виплату?")) return;
    const res = await fetch(`/api/withdrawals/${id}`, { method: "DELETE" });
    if (res.ok) {
      loadFinance();
      loadWithdrawals();
    }
  }

  return (
    <div className="space-y-6">
      {/* Перемикач періоду */}
      <div className="flex gap-2">
        {(["week", "month", "all"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              period === p
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-blue-400"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Завантаження...</div>
      ) : !data ? (
        <div className="text-center py-16 text-gray-400">Помилка завантаження</div>
      ) : (
        <>
          {/* Картки підсумку */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <SummaryCard
              label="Замовлень"
              value={String(data.orderCount)}
              unit=""
              color="blue"
            />
            <SummaryCard
              label="Вартість"
              value={data.totalCNY.toFixed(2)}
              unit="¥"
              color="indigo"
            />
            <SummaryCard
              label="Надходження"
              value={data.clientPaidCNY.toFixed(2)}
              unit="¥"
              sub={data.clientPaidUAH > 0 ? `+ ${data.clientPaidUAH.toFixed(0)} ₴` : undefined}
              color="green"
            />
            <SummaryCard
              label="Витрати"
              value={(data.wePaidCNY + data.expensesCNY).toFixed(2)}
              unit="¥"
              sub={data.expensesCNY > 0 ? `вкл. ${data.expensesCNY.toFixed(2)} ¥ доп.` : undefined}
              color="orange"
            />
            <SummaryCard
              label="Заробіток"
              value={(data.profit >= 0 ? "+" : "") + data.profit.toFixed(2)}
              unit="¥"
              color={data.profit >= 0 ? "emerald" : "red"}
              big
            />
          </div>

          {/* Виплати (вивід зароблених коштів) */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-800">Виплати собі</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Заробіток за період: <span className="font-medium text-gray-600">{data.profit.toFixed(2)} ¥</span>
                  {" · "}Виведено: <span className="font-medium text-gray-600">{data.withdrawalsCNY.toFixed(2)} ¥</span>
                  {" · "}Залишок: <span className={`font-semibold ${data.balanceAfterWithdrawals >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {data.balanceAfterWithdrawals >= 0 ? "+" : ""}{data.balanceAfterWithdrawals.toFixed(2)} ¥
                  </span>
                </p>
              </div>
              <button
                onClick={() => setShowWithdrawForm((v) => !v)}
                className="text-sm px-3 py-1.5 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg font-medium transition shrink-0"
              >
                {showWithdrawForm ? "Скасувати" : "+ Забрати кошти"}
              </button>
            </div>

            {showWithdrawForm && (
              <form onSubmit={handleAddWithdrawal} className="px-5 py-4 border-b border-gray-100 bg-purple-50/40 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Категорія</label>
                    <select
                      value={wCategoryId}
                      onChange={(e) => { setWCategoryId(e.target.value); if (e.target.value) setWNewCategory(""); }}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                    >
                      <option value="">— нова категорія —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {!wCategoryId && (
                      <input
                        value={wNewCategory}
                        onChange={(e) => setWNewCategory(e.target.value)}
                        placeholder="Напр. Особисті витрати"
                        className="w-full mt-2 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Сума (¥)</label>
                    <input
                      value={wAmount}
                      onChange={(e) => setWAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Примітка (опційно)</label>
                    <input
                      value={wNote}
                      onChange={(e) => setWNote(e.target.value)}
                      placeholder="Деталі..."
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {wError && (
                  <p className="text-red-500 text-sm bg-red-50 px-3 py-1.5 rounded-lg">{wError}</p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={wSaving}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                  >
                    {wSaving ? "Збереження..." : "Забрати кошти"}
                  </button>
                </div>
              </form>
            )}

            {withdrawalsList.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {withdrawalsList.map((w) => (
                  <div key={w.id} className="flex items-center justify-between px-5 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          {w.categoryName}
                        </span>
                        <span className="text-sm text-gray-500">{new Date(w.createdAt).toLocaleDateString("uk-UA")}</span>
                      </div>
                      {w.note && <p className="text-xs text-gray-400 mt-0.5 truncate">{w.note}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-semibold text-purple-700">-{parseFloat(w.amount).toFixed(2)} ¥</span>
                      <button
                        onClick={() => handleDeleteWithdrawal(w.id)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 px-5 py-4">Ще не забирали кошти за цей період</p>
            )}
          </div>

          {/* Таблиця по замовленнях */}
          {data.byOrder.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">По замовленнях</h2>
                <span className="text-xs text-gray-400">{PERIOD_LABELS[period]}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Клієнт</th>
                      <th className="px-4 py-3 text-left">Дата</th>
                      <th className="px-4 py-3 text-left">Статус</th>
                      <th className="px-4 py-3 text-right">Вартість</th>
                      <th className="px-4 py-3 text-right">Надійшло</th>
                      <th className="px-4 py-3 text-right">Витрачено</th>
                      <th className="px-4 py-3 text-right">Заробіток</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.byOrder.map((o) => (
                      <tr key={o.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          <a href={`/orders/${o.id}`} className="hover:text-blue-600 hover:underline">
                            {o.clientName ?? "—"}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {o.orderDate ?? new Date(o.createdAt).toLocaleDateString("uk-UA")}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {STATUS_LABELS[o.status] ?? o.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{o.totalCNY.toFixed(2)} ¥</td>
                        <td className="px-4 py-3 text-right text-green-700 font-medium">{o.clientPaidCNY.toFixed(2)} ¥</td>
                        <td className="px-4 py-3 text-right text-orange-700">{(o.wePaidCNY + o.expensesCNY).toFixed(2)} ¥</td>
                        <td className={`px-4 py-3 text-right font-semibold ${o.profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                          {o.profit >= 0 ? "+" : ""}{o.profit.toFixed(2)} ¥
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Підсумковий рядок */}
                  <tfoot className="bg-gray-50 font-semibold text-sm border-t-2 border-gray-200">
                    <tr>
                      <td className="px-4 py-3 text-gray-600" colSpan={3}>Разом</td>
                      <td className="px-4 py-3 text-right text-gray-700">{data.totalCNY.toFixed(2)} ¥</td>
                      <td className="px-4 py-3 text-right text-green-700">{data.clientPaidCNY.toFixed(2)} ¥</td>
                      <td className="px-4 py-3 text-right text-orange-700">{(data.wePaidCNY + data.expensesCNY).toFixed(2)} ¥</td>
                      <td className={`px-4 py-3 text-right ${data.profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                        {data.profit >= 0 ? "+" : ""}{data.profit.toFixed(2)} ¥
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400">
              Немає даних за обраний період
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  unit,
  sub,
  color,
  big,
}: {
  label: string;
  value: string;
  unit: string;
  sub?: string;
  color: "blue" | "indigo" | "green" | "orange" | "emerald" | "red";
  big?: boolean;
}) {
  const colors = {
    blue:    "bg-blue-50 text-blue-700 text-blue-500",
    indigo:  "bg-indigo-50 text-indigo-700 text-indigo-500",
    green:   "bg-green-50 text-green-700 text-green-500",
    orange:  "bg-orange-50 text-orange-700 text-orange-500",
    emerald: "bg-emerald-50 text-emerald-700 text-emerald-500",
    red:     "bg-red-50 text-red-700 text-red-500",
  };
  const [bg, textVal, textLabel] = colors[color].split(" ");

  return (
    <div className={`${bg} rounded-xl p-4`}>
      <p className={`text-xs ${textLabel} mb-1`}>{label}</p>
      <p className={`${big ? "text-3xl" : "text-2xl"} font-bold ${textVal}`}>
        {value} <span className="text-base font-normal">{unit}</span>
      </p>
      {sub && <p className={`text-xs ${textLabel} mt-0.5`}>{sub}</p>}
    </div>
  );
}
