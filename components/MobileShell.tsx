"use client";

import { usePathname } from "next/navigation";

export default function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname === "/login" || pathname === "/";

  return <div className={hideNav ? "" : "pb-16 sm:pb-0"}>{children}</div>;
}
