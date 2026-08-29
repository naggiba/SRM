import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import FinanceDashboard from "@/components/FinanceDashboard";

export default async function FinancePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800 transition">
            ← Дашборд
          </a>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-bold text-gray-800">Фінанси</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <FinanceDashboard />
      </main>
    </div>
  );
}
