"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ApexLogo, ApexMark } from "@/app/ui/apex-mark";
import { BoardIcon, BriefIcon, CalendarIcon, ChartIcon, ChevronIcon } from "@/app/ui/icons";
import type { User } from "@/lib/users";

// Small per-browser preferences: which panels are open.
const remember = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch {} };
const recall = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };

// The signed-in frame. Nothing here depends on who is signed in, so it is part of the prerendered static
// shell. The account menu and Helper do depend on the person; the layout streams them in as slots.
export function AppShell({ accounts, account, helper, children }: { accounts: User[]; account: React.ReactNode; helper: React.ReactNode; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [teamOpen, setTeamOpen] = useState(true);

  useEffect(() => {
    setCollapsed(recall("apex-sidebar") === "collapsed");
    setTeamOpen(recall("apex-team") !== "closed");
  }, []);
  const toggleSidebar = () => { setCollapsed(!collapsed); remember("apex-sidebar", collapsed ? "open" : "collapsed"); };
  const toggleTeam = () => { setTeamOpen(!teamOpen); remember("apex-team", teamOpen ? "closed" : "open"); };

  return <div className="app" data-collapsed={collapsed || undefined}>
    <aside className="sidebar">
      <div className="sidebar-top">
        <Link href="/cases" className="sidebar-brand" aria-label="Apex, case board">{collapsed ? <ApexMark size={26} /> : <ApexLogo size={26} />}</Link>
        <button className="sidebar-toggle" onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}><ChevronIcon direction={collapsed ? "right" : "left"} /></button>
      </div>

      <nav className="sidebar-nav" aria-label="Workspace">
        {/* The active link depends on the URL's ?view=, which is only known at request time. */}
        <Suspense fallback={<MainLinks collapsed={collapsed} calendar={false} />}><MainLinksFromUrl collapsed={collapsed} /></Suspense>
        <button className="sidebar-heading sidebar-fold" onClick={toggleTeam} aria-expanded={teamOpen} aria-controls="sidebar-team">Team<ChevronIcon /></button>
        {teamOpen && <ul className="sidebar-team" id="sidebar-team">
          {accounts.map(person => <li key={person.id} title={collapsed ? `${person.name}, ${person.title}` : undefined}>
            <span className={`avatar small tone-${person.id}`} aria-hidden="true">{person.initials}</span>
            <span className="nav-label"><strong>{person.name}</strong><span>{person.title}</span></span>
          </li>)}
        </ul>}
        <p className="sidebar-heading">About</p>
        <NavLink href="/brief" label="Solution brief" icon={<BriefIcon />} active={false} collapsed={collapsed} />
      </nav>

      {account}
    </aside>
    <div className="app-main">{children}</div>
    {helper}
  </div>;
}

function NavLink({ href, label, icon, active, collapsed }: { href: string; label: string; icon: React.ReactNode; active: boolean; collapsed: boolean }) {
  return <Link href={href} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined}>{icon}<span className="nav-label">{label}</span></Link>;
}

function MainLinksFromUrl({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const view = useSearchParams().get("view");
  const calendar = pathname === "/cases" && view === "calendar";
  return <MainLinks collapsed={collapsed} calendar={calendar} />;
}

// Board and Calendar are two views of the same cases; Analytics is the numbers behind them.
function MainLinks({ collapsed, calendar }: { collapsed: boolean; calendar: boolean }) {
  const pathname = usePathname();
  return <>
    <NavLink href="/cases" label="Board" icon={<BoardIcon />} active={pathname.startsWith("/cases") && !calendar} collapsed={collapsed} />
    <NavLink href="/cases?view=calendar" label="Calendar" icon={<CalendarIcon />} active={calendar} collapsed={collapsed} />
    <NavLink href="/analytics" label="Analytics" icon={<ChartIcon />} active={pathname.startsWith("/analytics")} collapsed={collapsed} />
  </>;
}
