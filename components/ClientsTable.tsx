"use client";

import { useState, useEffect, useCallback } from "react";
import type { Client, Order } from "@/lib/schema";

const STATUS_LABELS: Record<string, string> = {
  WAITING_PAYMENT: "Очікуємо оплату",
  CLIENT_PAID: "Клієнт оплатив",
  ORDERED: "Замовлено",
  SENT_TO_CARGO: "На карго",
};

const STATUS_COLORS: Record<string, string> = {
  WAITING_PAYMENT: "bg-yellow-100 text-yellow-700",
  CLIENT_PAID: "bg-blue-100 text-blue-700",
  ORDERED: "bg-indigo-100 text-indigo-700",
  SENT_TO_CARGO: "bg-purple-100 text-purple-700",
};

export default function ClientsTable({
  initialClients,
  ordersByClient,
  usersMap,
  canEdit,
  canDelete,
}: {
  initialClients: Client[];
  ordersByClient: Record<string, Order[]>;
  usersMap: Record<string, string>;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [list, setList] = useState<Client[]>(initialClients);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchClients = useCallback(async (q: string) => {
    const res = await fetch(`/api/clients${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    if (res.ok) setList(await res.json());
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchClients(search), 300);
    return () => clearTimeout(timer);
  }, [search, fetchClients]);

  async function handleDelete(id: string) {
    if (!confirm("Видалити клієнта?")) return;
    setLoading(true);
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    if (res.ok) setList((p) => p.filter((c) => c.id !== id));
    else setError("Помилка видалення");
    setLoading(false);
  }

  function handleEdit(client: Client) {
    setEditClient(client);
    setShowForm(true);
  }

  function handleCreate() {
    setEditClient(null);
    setShowForm(true);
  }

  function handleSaved(client: Client) {
    setList((prev) => {
      const exists = prev.find((c) => c.id === client.id);
      if (exists) return prev.map((c) => (c.id === client.id ? client : c));
      return [...prev, client];
    });
    setShowForm(false);
    setEditClient(null);
  }

  function getClientOrders(client: Client): Order[] {
    return ordersByClient[client.id] || ordersByClient[client.name] || [];
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-6">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук за ім'ям, TG, кодом..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
        </div>

        {canEdit && (
          <button
            onClick={handleCreate}
            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            + Новий клієнт
          </button>
        )}
      </div>

      {error && (
        <p className="text-red-500 text-sm mb-4 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
      )}

      {showForm && (
        <ClientForm
          client={editClient}
          onSaved={handleSaved}
          onCancel={() => { setShowForm(false); setEditClient(null); }}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Ім&apos;я</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Telegram</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Код карго</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Замовлень</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Додано</th>
              {(canEdit || canDelete) && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.map((client) => {
              const clientOrders = getClientOrders(client);
              const isExpanded = expanded === client.id;
              
              return (
                <Fragment key={client.id}>
                  <tr className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-800">{client.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {client.telegram ? (
                        <a
                          href={`https://t.me/${client.telegram.replace(/^@/, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {client.telegram.startsWith("@") ? client.telegram : `@${client.telegram}`}
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {client.cargoCode ? (
                        <span className="font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                          {client.cargoCode}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {clientOrders.length > 0 ? (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : client.id)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          {clientOrders.length} {isExpanded ? "▲" : "▼"}
                        </button>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(client.createdAt).toLocaleDateString("uk-UA")}
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {canEdit && (
                          <button
                            onClick={() => handleEdit(client)}
                            className="text-blue-600 hover:underline mr-3 text-sm"
                          >
                            Редагувати
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(client.id)}
                            disabled={loading}
                            className="text-red-500 hover:underline text-sm disabled:opacity-50"
                          >
                            Видалити
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                  
                  {/* Expanded orders */}
                  {isExpanded && clientOrders.length > 0 && (
                    <tr>
                      <td colSpan={6} className="bg-gray-50 px-4 py-3">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-gray-500 mb-2">Замовлення клієнта:</p>
                          {clientOrders.map((order) => (
                            <div key={order.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-200">
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] || "bg-gray-100"}`}>
                                  {STATUS_LABELS[order.status] || order.status}
                                </span>
                                <span className="text-sm text-gray-700">
                                  {order.orderDate || new Date(order.createdAt).toLocaleDateString("uk-UA")}
                                </span>
                                {order.totalPrice && (
                                  <span className="text-sm font-medium text-gray-800">{order.totalPrice}</span>
                                )}
                                {order.deliveryType && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${order.deliveryType === "AIR" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>
                                    {order.deliveryType === "AIR" ? "Авіа" : "ЖД"}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                <span>Створив: {usersMap[order.createdBy] || "Невідомо"}</span>
                                <a href={`/orders/${order.id}`} className="text-blue-600 hover:underline">
                                  Переглянути →
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-gray-400"
                >
                  {search ? "Нічого не знайдено" : "Клієнтів ще немає"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">Усього: {list.length}</p>
    </div>
  );
}

import { Fragment } from "react";

function ClientForm({
  client,
  onSaved,
  onCancel,
}: {
  client: Client | null;
  onSaved: (c: Client) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(client?.name ?? "");
  const [telegram, setTelegram] = useState(client?.telegram ?? "");
  const [cargoCode, setCargoCode] = useState(client?.cargoCode ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const body = { name, telegram, cargoCode };
    const res = client
      ? await fetch(`/api/clients/${client.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Помилка збереження");
      return;
    }

    const saved = await res.json();
    onSaved(saved);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h2 className="font-semibold text-gray-800 mb-4">
        {client ? "Редагувати клієнта" : "Новий клієнт"}
      </h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ім&apos;я <span className="text-red-500">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Іваненко Іван"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Telegram
          </label>
          <input
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            placeholder="@username"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Код карго
          </label>
          <input
            value={cargoCode}
            onChange={(e) => setCargoCode(e.target.value)}
            placeholder="UA-12345"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
          />
        </div>

        {error && (
          <p className="col-span-3 text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <div className="col-span-3 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition"
          >
            Скасувати
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Збереження..." : "Зберегти"}
          </button>
        </div>
      </form>
    </div>
  );
}
