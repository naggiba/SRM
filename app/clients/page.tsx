import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clients, orders, users } from "@/lib/schema";
import { desc } from "drizzle-orm";
import ClientsTable from "@/components/ClientsTable";

export default async function ClientsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session.user as { role: string }).role;

  // Паралельні запити
  const [allClients, allOrders, allUsers] = await Promise.all([
    db.select().from(clients).orderBy(clients.createdAt),
    db.select().from(orders).orderBy(desc(orders.createdAt)),
    db.select({ id: users.id, name: users.name }).from(users),
  ]);

  // Групуємо замовлення по clientId та clientName
  const ordersByClient: Record<string, typeof allOrders> = {};
  for (const order of allOrders) {
    const key = order.clientId || order.clientName || "";
    if (!ordersByClient[key]) ordersByClient[key] = [];
    ordersByClient[key].push(order);
  }

  // Map userId to name
  const usersMap: Record<string, string> = {};
  for (const u of allUsers) {
    usersMap[u.id] = u.name;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/dashboard"
              className="text-sm text-gray-500 hover:text-gray-800 transition"
            >
              ← Дашборд
            </a>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-bold text-gray-800">Клієнти</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <ClientsTable
          initialClients={allClients}
          ordersByClient={ordersByClient}
          usersMap={usersMap}
          canEdit={role === "ADMIN" || role === "MANAGER"}
          canDelete={role === "ADMIN"}
        />
      </main>
    </div>
  );
}
