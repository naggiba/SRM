"use client";

import { useState } from "react";

interface OrderData {
  id: string;
  clientName: string | null;
  note: string | null;
  totalPrice: string | null;
  status: string;
  orderDate: string | null;
  deliveryType: string | null;
  createdAt: string;
}

const COLUMNS = [
  {
    status: "WAITING_PAYMENT",
    title: "Очікуємо оплату",
    hint: "Потрібно отримати оплату від клієнта",
    color: "border-yellow-400",
    headerBg: "bg-yellow-50",
    badge: "bg-yellow-100 text-yellow-800",
    dot: "bg-yellow-400",
  },
  {
    status: "CLIENT_PAID",
    title: "Замовити",
    hint: "Клієнт оплатив — потрібно замовити товар",
    color: "border-blue-400",
    headerBg: "bg-blue-50",
    badge: "bg-blue-100 text-blue-800",
    dot: "bg-blue-400",
  },
  {
    status: "ORDERED",
    title: "Очікуємо товар",
    hint: "Замовлено — чекаємо поставку",
    color: "border-indigo-400",
    headerBg: "bg-indigo-50",
    badge: "bg-indigo-100 text-indigo-800",
    dot: "bg-indigo-400",
  },
  {
    status: "SENT_TO_CARGO",
    title: "Відправлено",
    hint: "Товар відправлено на карго",
    color: "border-green-400",
    headerBg: "bg-green-50",
    badge: "bg-green-100 text-green-800",
    dot: "bg-green-400",
  },
];

export default function TasksBoard({
  orders,
  canEdit,
}: {
  orders: OrderData[];
  canEdit: boolean;
}) {
  const [updating, setUpdating] = useState<string | null>(null);

  const grouped: Record<string, OrderData[]> = {};
  for (const col of COLUMNS) {
    grouped[col.status] = orders.filter((o) => o.status === col.status);
  }

  async function moveOrder(orderId: string, newStatus: string) {
    setUpdating(orderId);
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    window.location.reload();
  }

  function getNextStatus(current: string): { status: string; label: string } | null {
    const idx = COLUMNS.findIndex((c) => c.status === current);
    if (idx < 0 || idx >= COLUMNS.length - 1) return null;
    return { status: COLUMNS[idx + 1].status, label: COLUMNS[idx + 1].title };
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const colOrders = grouped[col.status] || [];
        return (
          <div key={col.status} className={`rounded-xl border-t-4 ${col.color} bg-white border border-gray-200`}>
            {/* Header */}
            <div className={`px-4 py-3 ${col.headerBg} border-b border-gray-100`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 text-sm">{col.title}</h3>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.badge}`}>
                  {colOrders.length}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{col.hint}</p>
            </div>

            {/* Список задач */}
            <div className="divide-y divide-gray-100 min-h-[80px]">
              {colOrders.length === 0 && (
                <p className="text-xs text-gray-300 text-center py-8">Немає задач</p>
              )}

              {colOrders.map((order) => {
                const next = getNextStatus(order.status);
                return (
                  <div key={order.id} className="px-4 py-3 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <a
                          href={`/orders/${order.id}`}
                          className="text-sm font-medium text-gray-800 hover:text-blue-600 block truncate"
                        >
                          {order.clientName || "Без клієнта"}
                        </a>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          {order.totalPrice && (
                            <span>{order.totalPrice} ¥</span>
                          )}
                          {order.deliveryType && (
                            <span className={`px-1 py-0.5 rounded ${
                              order.deliveryType === "AIR" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"
                            }`}>
                              {order.deliveryType === "AIR" ? "Авіа" : "ЖД"}
                            </span>
                          )}
                          <span>{order.orderDate || new Date(order.createdAt).toLocaleDateString("uk-UA")}</span>
                        </div>
                        {order.note && (
                          <p className="text-xs text-gray-400 mt-1 truncate">{order.note}</p>
                        )}
                      </div>

                      {canEdit && next && (
                        <button
                          onClick={() => moveOrder(order.id, next.status)}
                          disabled={updating === order.id}
                          className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap flex-shrink-0 mt-0.5 disabled:opacity-50"
                        >
                          {updating === order.id ? "..." : `${next.label} →`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
