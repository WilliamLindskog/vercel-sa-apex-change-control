"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountMenu } from "@/app/ui/account-menu";
import { ApexLogo, ApexMark } from "@/app/ui/apex-mark";
import { BoardIcon, BriefIcon, CaseIcon, ChevronIcon } from "@/app/ui/icons";
import type { User } from "@/lib/users";

// The signed-in frame: a sidebar that collapses to an icon rail (remembered per browser), and the page.
export function AppShell({ user, accounts, openCases, children }: { user: User; accounts: User[]; openCases: { id: string; title: string }[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("apex-sidebar") === "collapsed"); } catch {}
  }, []);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("apex-sidebar", next ? "collapsed" : "open"); } catch {}
  };

  const link = (href: string, label: string, icon: React.ReactNode, active: boolean) =>
    <Link key={href} href={href} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined}>{icon}<span className="nav-label">{label}</span></Link>;

  return <div className="app" data-collapsed={collapsed || undefined}>
    <aside className="sidebar">
      <div className="sidebar-top">
        <Link href="/cases" className="sidebar-brand" aria-label="Apex, case board">{collapsed ? <ApexMark size={26} /> : <ApexLogo size={26} />}</Link>
        <button className="sidebar-toggle" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}><ChevronIcon direction={collapsed ? "right" : "left"} /></button>
      </div>

      <nav className="sidebar-nav" aria-label="Workspace">
        {link("/cases", "Board", <BoardIcon />, pathname === "/cases")}
        <p className="sidebar-heading">Open cases</p>
        {openCases.map(item => link(`/cases/${item.id}`, item.title, <CaseIcon />, pathname === `/cases/${item.id}`))}
        <p className="sidebar-heading">Team</p>
        <ul className="sidebar-team">
          {accounts.map(person => <li key={person.id} title={collapsed ? `${person.name}, ${person.role}` : undefined}>
            <span className={`avatar small tone-${person.id}`} aria-hidden="true">{person.initials}</span>
            <span className="nav-label"><strong>{person.name}</strong><span>{person.role}</span></span>
          </li>)}
        </ul>
        <p className="sidebar-heading">About</p>
        {link("/brief", "Solution brief", <BriefIcon />, false)}
      </nav>

      <AccountMenu user={user} accounts={accounts} />
    </aside>
    <div className="app-main">{children}</div>
  </div>;
}
