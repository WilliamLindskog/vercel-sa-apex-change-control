"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountMenu } from "@/app/ui/account-menu";
import { Assistant, HelperMark } from "@/app/ui/assistant";
import { ApexLogo, ApexMark } from "@/app/ui/apex-mark";
import { BoardIcon, BriefIcon, ChevronIcon } from "@/app/ui/icons";
import type { User } from "@/lib/users";

// The signed-in frame: a sidebar that collapses to an icon rail (remembered per browser), and the page.
export function AppShell({ user, accounts, children }: { user: User; accounts: User[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [helperOpen, setHelperOpen] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("apex-sidebar") === "collapsed"); } catch {}
    // The helper starts open on wide screens, and remembers if someone closes or opens it.
    let saved: string | null = null;
    try { saved = localStorage.getItem("apex-helper"); } catch {}
    // On phones it is a sheet over the page, so it always starts closed there.
    const roomy = window.matchMedia("(min-width: 861px)").matches;
    setHelperOpen(roomy && (saved ? saved === "open" : window.matchMedia("(min-width: 1360px)").matches));
  }, []);
  const setHelper = (open: boolean) => {
    setHelperOpen(open);
    try { localStorage.setItem("apex-helper", open ? "open" : "closed"); } catch {}
  };
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("apex-sidebar", next ? "collapsed" : "open"); } catch {}
  };

  const link = (href: string, label: string, icon: React.ReactNode, active: boolean) =>
    <Link key={href} href={href} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined}>{icon}<span className="nav-label">{label}</span></Link>;

  return <div className="app" data-collapsed={collapsed || undefined} data-helper={helperOpen || undefined}>
    <aside className="sidebar">
      <div className="sidebar-top">
        <Link href="/cases" className="sidebar-brand" aria-label="Apex, case board">{collapsed ? <ApexMark size={26} /> : <ApexLogo size={26} />}</Link>
        <button className="sidebar-toggle" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}><ChevronIcon direction={collapsed ? "right" : "left"} /></button>
      </div>

      <nav className="sidebar-nav" aria-label="Workspace">
        {link("/cases", "Board", <BoardIcon />, pathname.startsWith("/cases"))}
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
    {helperOpen
      ? <Assistant user={user} onClose={() => setHelper(false)} />
      : <button className="as-launcher" onClick={() => setHelper(true)}><HelperMark size={30} />Ask Helper</button>}
  </div>;
}
