import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clients } from "@/lib/schema";
import NewOrderForm from "@/components/NewOrderForm";

export default async function NewOrderPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session.user as { role: string }).role;
  if (role === "VIEWER") redirect("/orders");

  const allClients = await db.select({
    id: clients.id,
    name: clients.name,
  }).from(clients).orderBy(clients.name);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 sm:px-6 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <a href="/orders" className="text-sm text-gray-500 hover:text-gray-800 transition">
            ← Замовлення
          </a>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-bold text-gray-800">Нове замовлення</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <NewOrderForm clients={allClients} />
      </main>
    </div>
  );
}
