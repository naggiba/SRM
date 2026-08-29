import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { orders, Order } from "@/lib/schema";
import { desc } from "drizzle-orm";
import TasksBoard from "@/components/TasksBoard";

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session.user as { role: string }).role;
  const allOrders: Order[] = await db.select().from(orders).orderBy(desc(orders.createdAt));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800 transition">
            ← Дашборд
          </a>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-bold text-gray-800">Задачі</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <TasksBoard orders={allOrders} canEdit={role !== "VIEWER"} />
      </main>
    </div>
  );
}
