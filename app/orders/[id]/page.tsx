import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { orders, orderItems, clients, payments, extraExpenses } from "@/lib/schema";
import { eq } from "drizzle-orm";
import EditOrderForm from "@/components/EditOrderForm";

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session.user as { role: string }).role;
  if (role === "VIEWER") redirect("/orders");

  const { id } = await params;

  // Всі запити паралельно — замість 5 послідовних
  const [orderResult, items, orderPayments, orderExpenses, allClients] = await Promise.all([
    db.select().from(orders).where(eq(orders.id, id)).limit(1),
    db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(orderItems.sortOrder),
    db.select().from(payments).where(eq(payments.orderId, id)).orderBy(payments.createdAt),
    db.select().from(extraExpenses).where(eq(extraExpenses.orderId, id)).orderBy(extraExpenses.createdAt),
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(clients.name),
  ]);

  const order = orderResult[0];
  if (!order) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <a href="/orders" className="text-sm text-gray-500 hover:text-gray-800 transition">
            ← Замовлення
          </a>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-bold text-gray-800">Редагувати замовлення</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <EditOrderForm
          order={order}
          items={items}
          payments={orderPayments}
          expenses={orderExpenses}
          clients={allClients}
        />
      </main>
    </div>
  );
}
