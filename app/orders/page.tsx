import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { orders, orderItems, payments, Order, OrderItem, Payment } from "@/lib/schema";
import { desc } from "drizzle-orm";
import OrdersList from "@/components/OrdersList";

export default async function OrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session.user as { role: string }).role;

  const [allOrders, allItems, allPayments] = await Promise.all([
    db.select().from(orders).orderBy(desc(orders.createdAt)) as Promise<Order[]>,
    db.select().from(orderItems) as Promise<OrderItem[]>,
    db.select().from(payments) as Promise<Payment[]>,
  ]);

  const data = allOrders.map((o: Order) => ({
    ...o,
    items: allItems
      .filter((i: OrderItem) => i.orderId === o.id)
      .sort((a: OrderItem, b: OrderItem) => a.sortOrder - b.sortOrder),
    payments: allPayments.filter((p: Payment) => p.orderId === o.id),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800 transition">
              ← Дашборд
            </a>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-bold text-gray-800">Замовлення</h1>
          </div>
          {role !== "VIEWER" && (
            <a
              href="/orders/new"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              + Нове замовлення
            </a>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <OrdersList
          initialOrders={data}
          canEdit={role !== "VIEWER"}
          canDelete={role === "ADMIN"}
        />
      </main>
    </div>
  );
}
