"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

function iconProps(active: boolean) {
  return {
    className: "w-5 h-5",
    fill: "none" as const,
    stroke: "currentColor" as const,
    strokeWidth: active ? 2.2 : 1.8,
    viewBox: "0 0 24 24",
  };
}

const items: NavItem[] = [
  {
    href: "/dashboard",
    label: "Головна",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4a1 1 0 001-1v-4a1 1 0 011-1h0a1 1 0 011 1v4a1 1 0 001 1h4a1 1 0 001-1V10" />
      </svg>
    ),
  },
  {
    href: "/orders",
    label: "Замовлення",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4m0-14v14m9-14v10l-9 4" />
      </svg>
    ),
  },
  {
    href: "/tasks",
    label: "Задачі",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/products",
    label: "Каталог",
    icon: (active) => (
      <svg {...iconProps(active)}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/") return null;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 sm:hidden bg-white/95 backdrop-blur-sm border-t border-gray-200"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition active:scale-95 ${
                active ? "text-blue-600" : "text-gray-400"
              }`}
            >
              {item.icon(active)}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
