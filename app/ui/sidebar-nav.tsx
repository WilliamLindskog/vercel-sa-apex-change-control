"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SidebarNav({ openCases }: { openCases: { id: string; title: string }[] }) {
  const pathname = usePathname();
  return <nav className="sidebar-nav" aria-label="Workspace">
    <Link href="/cases" aria-current={pathname === "/cases" ? "page" : undefined}>All cases</Link>
    <p className="sidebar-heading" id="open-cases">Open cases</p>
    <ul aria-labelledby="open-cases">
      {openCases.map(item => {
        const href = `/cases/${item.id}`;
        return <li key={item.id}><Link href={href} aria-current={pathname === href ? "page" : undefined}><span className="nav-id">{item.id}</span>{item.title}</Link></li>;
      })}
    </ul>
  </nav>;
}
