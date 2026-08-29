"use client";

import { useState } from "react";
import type { Order, OrderItem, Payment } from "@/lib/schema";

interface ColorQty {
  color: string;
  qty: number;
}

type OrderWithItems = Order & { items: OrderItem[]; payments: Payment[] };

const STATUS_COLORS: Record<string, string> = {
  WAITING_PAYMENT: "bg-yellow-100 text-yellow-700",
  CLIENT_PAID: "bg-blue-100 text-blue-700",
  ORDERED: "bg-indigo-100 text-indigo-700",
  SENT_TO_CARGO: "bg-purple-100 text-purple-700",
};

const STATUS_LABELS: Record<string, string> = {
  WAITING_PAYMENT: "Очікуємо оплату",
  CLIENT_PAID: "Клієнт оплатив",
  ORDERED: "Замовлено",
  SENT_TO_CARGO: "На карго",
};

const ALL_STATUSES = ["WAITING_PAYMENT", "CLIENT_PAID", "ORDERED", "SENT_TO_CARGO"];

const DELIVERY_LABELS: Record<string, string> = {
  AIR: "Авіа",
  RAIL: "ЖД",
};

function parseColors(colorsStr: string | null): ColorQty[] {
  if (!colorsStr) return [];
  try {
    const parsed = JSON.parse(colorsStr);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    if (colorsStr.includes(",")) {
      return colorsStr.split(",").map(c => ({ color: c.trim(), qty: 1 }));
    }
    if (colorsStr.trim()) {
      return [{ color: colorsStr.trim(), qty: 1 }];
    }
  }
  return [];
}

export default function OrdersList({
  initialOrders,
  canEdit,
  canDelete,
}: {
  initialOrders: OrderWithItems[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [orders, setOrders] = useState<OrderWithItems[]>(initialOrders);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleStatusChange(orderId: string, status: string) {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    }
  }

  async function handleDelete(orderId: string) {
    if (!confirm("Видалити замовлення?")) return;
    const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
    if (res.ok) setOrders((prev) => prev.filter((o) => o.id !== orderId));
    else setError("Помилка видалення");
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-4xl mb-3">📦</p>
        <p className="text-gray-500">Замовлень ще немає</p>
        {canEdit && (
          <a href="/orders/new" className="inline-block mt-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
            Створити перше замовлення
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
      <p className="text-xs text-gray-400">Усього: {orders.length}</p>

      {orders.map((order) => {
        const isOpen = expanded === order.id;

        const clientPaid = order.payments
          ?.filter(p => p.type === "CLIENT")
          .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
        const wePaid = order.payments
          ?.filter(p => p.type === "SUPPLIER")
          .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
        const total = parseFloat(order.totalPrice || "0") || 0;
        const debt = total - clientPaid;

        return (
          <div key={order.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header row */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 px-3 py-2">
              <div className="flex items-center gap-2.5 flex-1 min-w-0 w-full sm:w-auto">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">
                    {order.clientName || "Без клієнта"}
                    {order.deliveryType && (
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${order.deliveryType === "AIR" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>
                        {DELIVERY_LABELS[order.deliveryType] || order.deliveryType}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {order.orderDate ? `${order.orderDate}` : new Date(order.createdAt).toLocaleDateString("uk-UA")} · {order.items.length} товарів
                    {total > 0 && ` · ${total.toFixed(0)}`}
                    {debt > 0 && <span className="text-red-500 ml-1">(борг: {debt.toFixed(0)})</span>}
                    {order.estimatedShipDate && <span className="ml-1">· відпр. {order.estimatedShipDate}</span>}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto sm:ml-0 shrink-0">
                {canEdit ? (
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${STATUS_COLORS[order.status] ?? "bg-gray-100"}`}
                  >
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                    ))}
                  </select>
                ) : (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100"}`}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                )}

                <button
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                  className="text-gray-400 hover:text-gray-700 transition text-lg leading-none"
                >
                  {isOpen ? "▲" : "▼"}
                </button>

                {canDelete && (
                  <button onClick={() => handleDelete(order.id)} className="text-red-400 hover:text-red-600 transition text-sm">
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Expanded */}
            {isOpen && (
              <div className="border-t border-gray-100 px-3 py-3">
                {/* Payment summary */}
                {(total > 0 || clientPaid > 0 || wePaid > 0) && (
                  <div className="mb-3 p-2.5 bg-blue-50 rounded-lg">
                    <div className="flex flex-wrap gap-4 text-sm">
                      {total > 0 && <span>Загалом: <b>{total.toFixed(2)}</b></span>}
                      {clientPaid > 0 && <span className="text-green-700">Клієнт оплатив: <b>{clientPaid.toFixed(2)}</b></span>}
                      {wePaid > 0 && <span className="text-orange-700">Ми оплатили: <b>{wePaid.toFixed(2)}</b></span>}
                      {debt > 0 && <span className="text-red-600">Борг: <b>{debt.toFixed(2)}</b></span>}
                    </div>
                  </div>
                )}

                {order.note && (
                  <p className="text-sm text-gray-600 mb-3 bg-gray-50 px-3 py-2 rounded-lg">{order.note}</p>
                )}

                {order.items.length === 0 && <p className="text-sm text-gray-400">Товарів немає</p>}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {order.items.map((item) => {
                    const colors = parseColors(item.colors);
                    return (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-2.5 space-y-0.5 text-xs">
                        {item.supplier && (
                          <p className="text-gray-700 truncate">{item.supplier}</p>
                        )}
                        {item.modelNumber && (
                          <p className="font-mono text-gray-800 bg-gray-50 px-1.5 py-0.5 rounded inline-block truncate">{item.modelNumber}</p>
                        )}
                        {item.price && <p className="text-green-700 font-semibold">{item.price}</p>}

                        {/* Colors with qty */}
                        {colors.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {colors.map((c, ci) => (
                              <span key={ci} className="bg-gray-100 px-1.5 py-0.5 rounded">
                                {c.color} × {c.qty}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {canEdit && (
                  <div className="mt-3 flex justify-end">
                    <a href={`/orders/${order.id}`} className="text-sm text-blue-600 hover:underline">
                      Редагувати замовлення →
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
