import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import UsersTable from "@/components/UsersTable";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN") redirect("/dashboard");

  const allUsers = await db.select().from(users).orderBy(users.createdAt);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 sm:px-6 py-3 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/dashboard"
              className="text-sm text-gray-500 hover:text-gray-800 transition"
            >
              ← Дашборд
            </a>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-bold text-gray-800">Користувачі</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <UsersTable users={allUsers} currentUserId={(session.user as { id: string }).id} />
      </main>
    </div>
  );
}
