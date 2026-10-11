"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks() {
  const path = usePathname();
  return (
    <>
      <Link href="/" aria-current={path === "/" ? "page" : undefined}>
        Prognoze
      </Link>
      <Link href="/povijest" aria-current={path.startsWith("/povijest") ? "page" : undefined}>
        Povijest
      </Link>
    </>
  );
}
