import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { orders, orderItems, Order, OrderItem } from "@/lib/schema";
import { desc } from "drizzle-orm";
import TasksBoard from "@/components/TasksBoard";

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session.user as { role: string }).role;

  const [allOrders, allItems] = await Promise.all([
    db.select().from(orders).orderBy(desc(orders.createdAt)) as Promise<Order[]>,
    db.select().from(orderItems) as Promise<OrderItem[]>,
  ]);

  const data = allOrders.map((o: Order) => ({
    ...o,
    items: allItems
      .filter((i: OrderItem) => i.orderId === o.id)
      .sort((a: OrderItem, b: OrderItem) => a.sortOrder - b.sortOrder),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 sm:px-6 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800 transition">
            ← Дашборд
          </a>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-bold text-gray-800">Задачі</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <TasksBoard orders={data} canEdit={role !== "VIEWER"} />
      </main>
    </div>
  );
}
