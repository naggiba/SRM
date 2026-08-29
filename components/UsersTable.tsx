"use client";

import { useState } from "react";
import type { User } from "@/lib/schema";

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

export default function UsersTable({
  users,
  currentUserId,
}: {
  users: User[];
  currentUserId: string;
}) {
  const [list, setList] = useState<User[]>(users);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete(id: string) {
    if (!confirm("Видалити користувача?")) return;
    setLoading(true);
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) setList((p) => p.filter((u) => u.id !== id));
    else setError("Помилка видалення");
    setLoading(false);
  }

  function handleEdit(user: User) {
    setEditUser(user);
    setShowForm(true);
  }

  function handleCreate() {
    setEditUser(null);
    setShowForm(true);
  }

  function handleSaved(user: User) {
    setList((prev) => {
      const exists = prev.find((u) => u.id === user.id);
      if (exists) return prev.map((u) => (u.id === user.id ? user : u));
      return [...prev, user];
    });
    setShowForm(false);
    setEditUser(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-gray-600 text-sm">Усього: {list.length}</p>
        <button
          onClick={handleCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          + Новий користувач
        </button>
      </div>

      {error && (
        <p className="text-red-500 text-sm mb-4 bg-red-50 px-4 py-2 rounded-lg">
          {error}
        </p>
      )}

      {showForm && (
        <UserForm
          user={editUser}
          onSaved={handleSaved}
          onCancel={() => { setShowForm(false); setEditUser(null); }}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Ім&apos;я</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Роль</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Дата</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium text-gray-800">
                  {user.name}
                  {user.id === currentUserId && (
                    <span className="ml-2 text-xs text-gray-400">(ви)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleColors[user.role] ?? ""}`}>
                    {roleLabels[user.role] ?? user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString("uk-UA")}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleEdit(user)}
                    className="text-blue-600 hover:underline mr-3"
                  >
                    Редагувати
                  </button>
                  {user.id !== currentUserId && (
                    <button
                      onClick={() => handleDelete(user.id)}
                      disabled={loading}
                      className="text-red-500 hover:underline disabled:opacity-50"
                    >
                      Видалити
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Немає користувачів
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserForm({
  user,
  onSaved,
  onCancel,
}: {
  user: User | null;
  onSaved: (u: User) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>(user?.role ?? "VIEWER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const body: Record<string, string> = { name, email, role };
    if (password) body.password = password;

    const res = user
      ? await fetch(`/api/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, password }),
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
        {user ? "Редагувати користувача" : "Новий користувач"}
      </h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ім&apos;я</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Пароль {user && <span className="text-gray-400">(залиште порожнім, щоб не змінювати)</span>}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!user}
            minLength={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder={user ? "••••••" : "мін. 6 символів"}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Роль</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
          >
            <option value="ADMIN">Адміністратор</option>
            <option value="MANAGER">Менеджер</option>
            <option value="VIEWER">Читач</option>
          </select>
        </div>

        {error && (
          <p className="col-span-2 text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <div className="col-span-2 flex gap-3 justify-end">
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
