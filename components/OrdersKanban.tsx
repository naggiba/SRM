"use client";

import { useState } from "react";
import Image from "next/image";

interface OrderData {
  id: string;
  clientName: string | null;
  note: string | null;
  totalPrice: string | null;
  clientPaid: string | null;
  status: string;
  orderDate: string | null;
  deliveryType: string | null;
  createdAt: string;
  items: {
    id: string;
    photoPath: string | null;
    modelNumber: string | null;
    price: string | null;
  }[];
  payments: {
    type: string;
    amount: string;
  }[];
}

const COLUMNS = [
  {
    status: "WAITING_PAYMENT",
    title: "Очікуємо оплату",
    action: "Потрібно отримати оплату",
    color: "border-yellow-400",
    bg: "bg-yellow-50",
    badge: "bg-yellow-100 text-yellow-700",
    icon: "💰",
  },
  {
    status: "CLIENT_PAID",
    title: "Замовити",
    action: "Клієнт оплатив — замовляй!",
    color: "border-blue-400",
    bg: "bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
    icon: "🛒",
  },
  {
    status: "ORDERED",
    title: "Очікуємо товар",
    action: "Замовлено — чекаємо доставку",
    color: "border-indigo-400",
    bg: "bg-indigo-50",
    badge: "bg-indigo-100 text-indigo-700",
    icon: "📦",
  },
  {
    status: "SENT_TO_CARGO",
    title: "Відправлено",
    action: "Товар на карго",
    color: "border-green-400",
    bg: "bg-green-50",
    badge: "bg-green-100 text-green-700",
    icon: "✅",
  },
];

export default function OrdersKanban({
  orders,
  canEdit,
}: {
  orders: OrderData[];
  canEdit: boolean;
}) {
  const [updating, setUpdating] = useState<string | null>(null);

  // Групуємо замовлення по статусу
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

  // Знаходимо наступний статус
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
          <div key={col.status} className={`rounded-xl border-t-4 ${col.color} bg-white border border-gray-200 overflow-hidden`}>
            {/* Header */}
            <div className={`px-4 py-3 ${col.bg} border-b border-gray-100`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{col.icon}</span>
                  <h3 className="font-semibold text-gray-800 text-sm">{col.title}</h3>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.badge}`}>
                  {colOrders.length}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{col.action}</p>
            </div>

            {/* Cards */}
            <div className="p-3 space-y-3 min-h-[120px]">
              {colOrders.length === 0 && (
                <p className="text-xs text-gray-300 text-center py-6">Порожньо</p>
              )}

              {colOrders.map((order) => {
                const next = getNextStatus(order.status);
                const firstPhoto = order.items.find((i) => i.photoPath)?.photoPath;
                const itemCount = order.items.length;
                const clientPaid = order.payments
                  .filter((p) => p.type === "CLIENT")
                  .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition overflow-hidden"
                  >
                    {/* Мініатюра фото */}
                    {firstPhoto && (
                      <div className="relative h-24 bg-gray-100">
                        <Image
                          src={firstPhoto}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        {itemCount > 1 && (
                          <span className="absolute top-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                            +{itemCount - 1}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="p-3 space-y-2">
                      {/* Клієнт */}
                      <div className="flex items-center justify-between">
                        <a
                          href={`/orders/${order.id}`}
                          className="font-medium text-sm text-gray-800 hover:text-blue-600 truncate"
                        >
                          {order.clientName || "Без клієнта"}
                        </a>
                        {order.deliveryType && (
                          <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                            order.deliveryType === "AIR"
                              ? "bg-sky-100 text-sky-700"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {order.deliveryType === "AIR" ? "Авіа" : "ЖД"}
                          </span>
                        )}
                      </div>

                      {/* Сума */}
                      {order.totalPrice && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Вартість:</span>
                          <span className="font-semibold text-gray-700">{order.totalPrice} ¥</span>
                        </div>
                      )}

                      {clientPaid > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Оплачено:</span>
                          <span className="font-semibold text-green-600">{clientPaid.toFixed(2)} ¥</span>
                        </div>
                      )}

                      {/* Дата */}
                      <p className="text-xs text-gray-400">
                        {order.orderDate || new Date(order.createdAt).toLocaleDateString("uk-UA")}
                      </p>

                      {/* Примітка */}
                      {order.note && (
                        <p className="text-xs text-gray-500 truncate">{order.note}</p>
                      )}

                      {/* Кнопки */}
                      <div className="flex gap-2 pt-1 border-t border-gray-100">
                        <a
                          href={`/orders/${order.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Редагувати
                        </a>
                        {canEdit && next && (
                          <button
                            onClick={() => moveOrder(order.id, next.status)}
                            disabled={updating === order.id}
                            className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-2 py-0.5 rounded ml-auto transition disabled:opacity-50"
                          >
                            {updating === order.id ? "..." : `→ ${next.label}`}
                          </button>
                        )}
                      </div>
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
