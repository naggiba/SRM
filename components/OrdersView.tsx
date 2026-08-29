"use client";

import { useState } from "react";
import OrdersList from "@/components/OrdersList";
import OrdersKanban from "@/components/OrdersKanban";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function OrdersView({ orders, canEdit, canDelete }: { orders: any[]; canEdit: boolean; canDelete: boolean }) {
  const [view, setView] = useState<"kanban" | "list">("kanban");

  return (
    <div>
      {/* Перемикач */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setView("kanban")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            view === "kanban"
              ? "bg-blue-600 text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:border-blue-400"
          }`}
        >
          Дошка
        </button>
        <button
          onClick={() => setView("list")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            view === "list"
              ? "bg-blue-600 text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:border-blue-400"
          }`}
        >
          Список
        </button>
      </div>

      {view === "kanban" ? (
        <OrdersKanban orders={orders} canEdit={canEdit} />
      ) : (
        <OrdersList initialOrders={orders} canEdit={canEdit} canDelete={canDelete} />
      )}
    </div>
  );
}
