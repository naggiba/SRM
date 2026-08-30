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
  income: number;
  incomeUAH: number;
  expenses: number;
  profitSentOnly: number;
  treasury: number;
  withdrawalsCNY: number;
  withdrawalsByCategory: Record<string, number>;
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
  const [tableOpen, setTableOpen] = useState(true);

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
    if (!categoryName) { setWError("Оберіть або введіть категорію"); return; }
    if (!wAmount || parseFloat(wAmount) <= 0) { setWError("Вкажіть коректну суму"); return; }

    setWSaving(true);
    const res = await fetch("/api/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: wCategoryId || null, categoryName, amount: wAmount, note: wNote }),
    });
    setWSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setWError(d.error ?? "Помилка"); return; }

    setWCategoryId(""); setWNewCategory(""); setWAmount(""); setWNote(""); setShowWithdrawForm(false);
    fetch("/api/withdrawal-categories").then((r) => r.json()).then((d) => setCategories(Array.isArray(d) ? d : []));
    loadFinance();
    loadWithdrawals();
  }

  async function handleDeleteWithdrawal(id: string) {
    if (!confirm("Видалити виплату?")) return;
    const res = await fetch(`/api/withdrawals/${id}`, { method: "DELETE" });
    if (res.ok) { loadFinance(); loadWithdrawals(); }
  }

  if (loading) return <div className="text-center py-16 text-gray-400">Завантаження...</div>;
  if (!data) return <div className="text-center py-16 text-gray-400">Помилка завантаження</div>;

  const treasuryAfterWithdrawals = data.treasury - data.withdrawalsCNY;

  return (
    <div className="space-y-5">
      {/* Перемикач періоду */}
      <div className="flex gap-2">
        {(["week", "month", "all"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              period === p
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white border border-gray-200 text-gray-600 hover:border-blue-400"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* === 4 Головні картки === */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Надходження */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600 text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7-7 7 7"/></svg>
            </div>
            <span className="text-xs text-gray-500 font-medium">Надходження</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{data.income.toFixed(0)} <span className="text-sm font-normal text-gray-400">¥</span></p>
          {data.incomeUAH > 0 && <p className="text-xs text-gray-400 mt-0.5">вкл. {data.incomeUAH.toFixed(0)} ₴</p>}
        </div>

        {/* Витрати */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7 7 7-7"/></svg>
            </div>
            <span className="text-xs text-gray-500 font-medium">Витрати</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{data.expenses.toFixed(0)} <span className="text-sm font-normal text-gray-400">¥</span></p>
        </div>

        {/* Заробіток (тільки відправлені) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${data.profitSentOnly >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8l-8 8M8 8h8v8"/></svg>
            </div>
            <span className="text-xs text-gray-500 font-medium">Заробіток</span>
          </div>
          <p className={`text-xl sm:text-2xl font-bold ${data.profitSentOnly >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            {data.profitSentOnly >= 0 ? "+" : ""}{data.profitSentOnly.toFixed(0)} <span className="text-sm font-normal text-gray-400">¥</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">тільки відправлені</p>
        </div>

        {/* Казна */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/></svg>
            </div>
            <span className="text-xs text-blue-600 font-medium">Казна</span>
          </div>
          <p className={`text-xl sm:text-2xl font-bold ${treasuryAfterWithdrawals >= 0 ? "text-blue-700" : "text-red-600"}`}>
            {treasuryAfterWithdrawals.toFixed(0)} <span className="text-sm font-normal text-gray-400">¥</span>
          </p>
          {data.withdrawalsCNY > 0 && (
            <p className="text-xs text-blue-400 mt-0.5">після виплат ({data.withdrawalsCNY.toFixed(0)} ¥)</p>
          )}
        </div>
      </div>

      {/* === Таблиця: замовлення + виплати === */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setTableOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 text-sm">Рух коштів</span>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{data.orderCount + withdrawalsList.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setShowWithdrawForm((v) => !v); setTableOpen(true); }}
              className="text-xs px-2.5 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg font-medium transition"
            >
              {showWithdrawForm ? "Скасувати" : "+ Виплата"}
            </button>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${tableOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </div>
        </button>

        {tableOpen && (
          <div className="border-t border-gray-100">
            {/* Форма додавання виплати */}
            {showWithdrawForm && (
              <form onSubmit={handleAddWithdrawal} className="px-5 py-4 border-b border-gray-100 bg-purple-50/30 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Категорія</label>
                    <select
                      value={wCategoryId}
                      onChange={(e) => { setWCategoryId(e.target.value); if (e.target.value) setWNewCategory(""); }}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                    >
                      <option value="">-- нова --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {!wCategoryId && (
                      <input
                        value={wNewCategory}
                        onChange={(e) => setWNewCategory(e.target.value)}
                        placeholder="Назва категорії"
                        className="w-full mt-2 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Сума (¥)</label>
                    <input value={wAmount} onChange={(e) => setWAmount(e.target.value)} placeholder="0.00" className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Примітка</label>
                    <input value={wNote} onChange={(e) => setWNote(e.target.value)} placeholder="Опційно" className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>
                {wError && <p className="text-red-500 text-sm bg-red-50 px-3 py-1.5 rounded-lg">{wError}</p>}
                <div className="flex justify-end">
                  <button type="submit" disabled={wSaving} className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
                    {wSaving ? "..." : "Зберегти"}
                  </button>
                </div>
              </form>
            )}

            {(() => {
              // Об'єднуємо замовлення і виплати в один список, сортуємо по даті
              type MergedRow = { type: "order"; data: OrderRow; date: string } | { type: "withdrawal"; data: WithdrawalRow; date: string };
              const merged: MergedRow[] = [
                ...data.byOrder.map((o) => ({ type: "order" as const, data: o, date: o.createdAt })),
                ...withdrawalsList.map((w) => ({ type: "withdrawal" as const, data: w, date: w.createdAt })),
              ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              if (merged.length === 0) {
                return <p className="text-sm text-gray-400 px-5 py-4">Немає даних за цей період</p>;
              }

              return (
                <>
                  {/* Мобільні картки */}
                  <div className="sm:hidden divide-y divide-gray-50">
                    {merged.map((row) => {
                      if (row.type === "order") {
                        const o = row.data;
                        return (
                          <a key={`o-${o.id}`} href={`/orders/${o.id}`} className="block px-4 py-3 hover:bg-gray-50 transition">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-gray-800 text-sm">{o.clientName ?? "—"}</span>
                              <span className={`text-sm font-semibold ${o.profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                                {o.profit >= 0 ? "+" : ""}{o.profit.toFixed(0)} ¥
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span>{o.orderDate ?? new Date(o.createdAt).toLocaleDateString("uk-UA")}</span>
                              <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{STATUS_LABELS[o.status] ?? o.status}</span>
                            </div>
                            <div className="flex gap-3 mt-1 text-xs">
                              <span className="text-green-600">+{o.clientPaidCNY.toFixed(0)}</span>
                              <span className="text-orange-600">-{(o.wePaidCNY + o.expensesCNY).toFixed(0)}</span>
                            </div>
                          </a>
                        );
                      } else {
                        const w = row.data;
                        return (
                          <div key={`w-${w.id}`} className="flex items-center justify-between px-4 py-3 bg-purple-50/40">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-semibold text-purple-700">Виплата</span>
                                <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">{w.categoryName}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span>{new Date(w.createdAt).toLocaleDateString("uk-UA")}</span>
                                {w.note && <span className="truncate">{w.note}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-semibold text-purple-700">-{parseFloat(w.amount).toFixed(0)} ¥</span>
                              <button onClick={() => handleDeleteWithdrawal(w.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>

                  {/* Десктопна таблиця */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50/80 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Опис</th>
                          <th className="px-4 py-2.5 text-left">Дата</th>
                          <th className="px-4 py-2.5 text-left">Статус</th>
                          <th className="px-4 py-2.5 text-right">Надійшло</th>
                          <th className="px-4 py-2.5 text-right">Витрачено</th>
                          <th className="px-4 py-2.5 text-right">Прибуток</th>
                          <th className="px-4 py-2.5 text-right w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {merged.map((row) => {
                          if (row.type === "order") {
                            const o = row.data;
                            return (
                              <tr key={`o-${o.id}`} className="hover:bg-gray-50 transition">
                                <td className="px-4 py-2.5 font-medium text-gray-800">
                                  <a href={`/orders/${o.id}`} className="hover:text-blue-600 hover:underline">{o.clientName ?? "—"}</a>
                                </td>
                                <td className="px-4 py-2.5 text-gray-500">{o.orderDate ?? new Date(o.createdAt).toLocaleDateString("uk-UA")}</td>
                                <td className="px-4 py-2.5">
                                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{STATUS_LABELS[o.status] ?? o.status}</span>
                                </td>
                                <td className="px-4 py-2.5 text-right text-green-700">{o.clientPaidCNY.toFixed(2)} ¥</td>
                                <td className="px-4 py-2.5 text-right text-orange-700">{(o.wePaidCNY + o.expensesCNY).toFixed(2)} ¥</td>
                                <td className={`px-4 py-2.5 text-right font-semibold ${o.profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                                  {o.profit >= 0 ? "+" : ""}{o.profit.toFixed(2)} ¥
                                </td>
                                <td className="px-4 py-2.5"></td>
                              </tr>
                            );
                          } else {
                            const w = row.data;
                            return (
                              <tr key={`w-${w.id}`} className="bg-purple-50/40 hover:bg-purple-50/60 transition">
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Виплата</span>
                                    <span className="text-sm text-gray-700">{w.categoryName}</span>
                                    {w.note && <span className="text-xs text-gray-400 truncate max-w-[150px]">{w.note}</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-gray-500">{new Date(w.createdAt).toLocaleDateString("uk-UA")}</td>
                                <td className="px-4 py-2.5">
                                  <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">Виплата</span>
                                </td>
                                <td className="px-4 py-2.5 text-right text-gray-300">—</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-purple-700">{parseFloat(w.amount).toFixed(2)} ¥</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-purple-700">-{parseFloat(w.amount).toFixed(2)} ¥</td>
                                <td className="px-4 py-2.5 text-right">
                                  <button onClick={() => handleDeleteWithdrawal(w.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                                </td>
                              </tr>
                            );
                          }
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50/80 font-semibold text-sm border-t border-gray-200">
                        <tr>
                          <td className="px-4 py-2.5 text-gray-600" colSpan={3}>Разом</td>
                          <td className="px-4 py-2.5 text-right text-green-700">{data.income.toFixed(2)} ¥</td>
                          <td className="px-4 py-2.5 text-right text-orange-700">{(data.expenses + data.withdrawalsCNY).toFixed(2)} ¥</td>
                          <td className={`px-4 py-2.5 text-right ${data.profitSentOnly - data.withdrawalsCNY >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {data.profitSentOnly - data.withdrawalsCNY >= 0 ? "+" : ""}{(data.profitSentOnly - data.withdrawalsCNY).toFixed(2)} ¥
                          </td>
                          <td className="px-4 py-2.5"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
