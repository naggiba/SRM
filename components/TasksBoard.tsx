"use client";

import { useState } from "react";
import type { Order, OrderItem } from "@/lib/schema";

type OrderWithItems = Order & { items: OrderItem[] };

interface ColorQty {
  color: string;
  qty: number;
}

interface PartTask {
  order: OrderWithItems;
  supplier: string;
  items: OrderItem[];
  itemIds: string[];
  status: string;
  totalQty: number;
  subtotal: number;
  index: number;
  count: number;
}

const COLUMNS = [
  { status: "WAITING_PAYMENT", title: "Очікуємо оплату", color: "border-yellow-400", headerBg: "bg-yellow-50", badge: "bg-yellow-100 text-yellow-800" },
  { status: "CLIENT_PAID", title: "Замовити", color: "border-blue-400", headerBg: "bg-blue-50", badge: "bg-blue-100 text-blue-800" },
  { status: "ORDERED", title: "Очікуємо товар", color: "border-indigo-400", headerBg: "bg-indigo-50", badge: "bg-indigo-100 text-indigo-800" },
  { status: "SENT_TO_CARGO", title: "Відправлено", color: "border-green-400", headerBg: "bg-green-50", badge: "bg-green-100 text-green-800" },
];

const ALL_STATUSES = ["WAITING_PAYMENT", "CLIENT_PAID", "ORDERED", "SENT_TO_CARGO"];
const STATUS_LABELS: Record<string, string> = {
  WAITING_PAYMENT: "Очік. оплату",
  CLIENT_PAID: "Замовити",
  ORDERED: "Очік. товар",
  SENT_TO_CARGO: "Відправлено",
};
const STATUS_SELECT_CLASS: Record<string, string> = {
  WAITING_PAYMENT: "bg-yellow-100 text-yellow-800",
  CLIENT_PAID: "bg-blue-100 text-blue-800",
  ORDERED: "bg-indigo-100 text-indigo-800",
  SENT_TO_CARGO: "bg-green-100 text-green-800",
};

// Палітра акцентів для замовлень — всі частини одного замовлення мають однаковий колір
const ACCENTS = [
  { border: "border-l-sky-500", chip: "bg-sky-100 text-sky-700" },
  { border: "border-l-rose-500", chip: "bg-rose-100 text-rose-700" },
  { border: "border-l-emerald-500", chip: "bg-emerald-100 text-emerald-700" },
  { border: "border-l-amber-500", chip: "bg-amber-100 text-amber-700" },
  { border: "border-l-violet-500", chip: "bg-violet-100 text-violet-700" },
  { border: "border-l-teal-500", chip: "bg-teal-100 text-teal-700" },
];

function parseColors(colorsStr: string | null): ColorQty[] {
  if (!colorsStr) return [];
  try {
    const parsed = JSON.parse(colorsStr);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    if (colorsStr.includes(",")) {
      return colorsStr.split(",").map((c) => ({ color: c.trim(), qty: 1 }));
    }
    if (colorsStr.trim()) {
      return [{ color: colorsStr.trim(), qty: 1 }];
    }
  }
  return [];
}

function parsePrice(s: string | null | undefined): number {
  if (!s) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function itemQty(item: OrderItem): number {
  return parseColors(item.colors).reduce((q, c) => q + (Number(c.qty) || 0), 0) || 1;
}

// Розбиваємо замовлення на частини за постачальниками
function buildParts(order: OrderWithItems): PartTask[] {
  const map = new Map<string, OrderItem[]>();
  for (const item of order.items) {
    const key = item.supplier?.trim() || "Без постачальника";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  const groups = Array.from(map.entries());
  if (groups.length === 0) {
    return [{ order, supplier: "Без постачальника", items: [], itemIds: [], status: order.status, totalQty: 0, subtotal: 0, index: 0, count: 1 }];
  }
  return groups.map(([supplier, items], index) => ({
    order,
    supplier,
    items,
    itemIds: items.map((i) => i.id),
    status: items[0]?.status ?? order.status,
    totalQty: items.reduce((sum, it) => sum + itemQty(it), 0),
    subtotal: items.reduce((sum, it) => sum + parsePrice(it.price) * itemQty(it), 0),
    index,
    count: groups.length,
  }));
}

function orderAccent(orderId: string) {
  let h = 0;
  for (let i = 0; i < orderId.length; i++) h = (h * 31 + orderId.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

export default function TasksBoard({
  orders,
  canEdit,
}: {
  orders: OrderWithItems[];
  canEdit: boolean;
}) {
  const [updating, setUpdating] = useState<string | null>(null);

  const allParts = orders.flatMap((o) => buildParts(o));

  const grouped: Record<string, PartTask[]> = {};
  for (const col of COLUMNS) {
    grouped[col.status] = allParts.filter((p) => p.status === col.status);
  }

  async function movePart(orderId: string, itemIds: string[], status: string) {
    setUpdating(orderId);
    if (itemIds.length === 0) {
      // Замовлення без товарів — рухаємо сам статус замовлення
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } else {
      await fetch(`/api/orders/${orderId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds, status }),
      });
    }
    window.location.reload();
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {COLUMNS.map((col) => {
        const colParts = grouped[col.status] || [];
        return (
          <div key={col.status} className={`rounded-lg border-t-4 ${col.color} bg-white border border-gray-200`}>
            {/* Header */}
            <div className={`px-3 py-2 ${col.headerBg} border-b border-gray-100`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 text-sm">{col.title}</h3>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${col.badge}`}>
                  {colParts.length}
                </span>
              </div>
            </div>

            {/* Список частин */}
            <div className="divide-y divide-gray-100 min-h-[60px]">
              {colParts.length === 0 && (
                <p className="text-xs text-gray-300 text-center py-6">Немає задач</p>
              )}

              {colParts.map((part) => {
                const accent = orderAccent(part.order.id);
                const multi = part.count > 1;
                return (
                  <div key={part.itemIds[0] || part.order.id} className={`px-2 py-1.5 border-l-4 ${accent.border} hover:bg-gray-50 transition`}>
                    <div className="flex items-center justify-between gap-1">
                      <a
                        href={`/orders/${part.order.id}`}
                        className="text-xs font-semibold text-gray-800 hover:text-blue-600 truncate"
                      >
                        {part.order.clientName || "Без клієнта"}
                      </a>
                      {canEdit && (
                        <select
                          value={part.status}
                          onChange={(e) => movePart(part.order.id, part.itemIds, e.target.value)}
                          disabled={updating === part.order.id}
                          className={`text-[10px] font-semibold px-1 py-0.5 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${STATUS_SELECT_CLASS[part.status] ?? "bg-gray-100 text-gray-700"}`}
                        >
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${accent.chip}`}>{part.supplier}</span>
                      {multi && (
                        <span className="text-[10px] text-gray-400">
                          частина {part.index + 1}/{part.count}
                        </span>
                      )}
                    </div>

                    {part.items.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {part.items.map((item) => (
                          <span key={item.id} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-1 py-0.5 rounded text-[10px]">
                            <span className="font-mono">{item.modelNumber || "—"}</span>
                            <span className="text-gray-400">×{itemQty(item)}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="text-[10px] text-gray-400 mt-1">
                      {part.subtotal > 0 && <span>{part.subtotal.toFixed(0)} ¥</span>}
                      {part.subtotal > 0 && part.order.totalPrice && <span> · </span>}
                      {part.order.totalPrice && <span>всього {part.order.totalPrice} ¥</span>}
                      {part.order.deliveryType && (
                        <span className={`ml-1 px-1 py-0.5 rounded ${part.order.deliveryType === "AIR" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>
                          {part.order.deliveryType === "AIR" ? "Авіа" : "ЖД"}
                        </span>
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
