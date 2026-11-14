"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountMenu } from "@/app/ui/account-menu";
import { Assistant } from "@/app/ui/assistant";
import { ApexLogo, ApexMark } from "@/app/ui/apex-mark";
import { BoardIcon, BriefIcon, CalendarIcon, ChartIcon, ChevronIcon } from "@/app/ui/icons";
import type { User } from "@/lib/users";

// Small per-browser preferences: which panels are open.
const remember = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch {} };
const recall = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };

// The signed-in frame: a sidebar that collapses to an icon rail, the page, and the Helper on the right.
export function AppShell({ user, accounts, children }: { user: User; accounts: User[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const calendar = pathname === "/cases" && searchParams.get("view") === "calendar";
  const [collapsed, setCollapsed] = useState(false);
  const [teamOpen, setTeamOpen] = useState(true);
  const [helperOpen, setHelperOpen] = useState(false);

  useEffect(() => {
    setCollapsed(recall("apex-sidebar") === "collapsed");
    setTeamOpen(recall("apex-team") !== "closed");
    // The helper starts open on wide screens and remembers the person's choice. On phones it is a sheet, so it starts closed.
    const saved = recall("apex-helper");
    const roomy = window.matchMedia("(min-width: 861px)").matches;
    setHelperOpen(roomy && (saved ? saved === "open" : window.matchMedia("(min-width: 1360px)").matches));
  }, []);
  const toggleSidebar = () => { setCollapsed(!collapsed); remember("apex-sidebar", collapsed ? "open" : "collapsed"); };
  const toggleTeam = () => { setTeamOpen(!teamOpen); remember("apex-team", teamOpen ? "closed" : "open"); };
  const toggleHelper = () => { setHelperOpen(!helperOpen); remember("apex-helper", helperOpen ? "closed" : "open"); };

  const link = (href: string, label: string, icon: React.ReactNode, active: boolean) =>
    <Link key={href} href={href} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined}>{icon}<span className="nav-label">{label}</span></Link>;

  return <div className="app" data-collapsed={collapsed || undefined} data-helper={helperOpen || undefined}>
    <aside className="sidebar">
      <div className="sidebar-top">
        <Link href="/cases" className="sidebar-brand" aria-label="Apex, case board">{collapsed ? <ApexMark size={26} /> : <ApexLogo size={26} />}</Link>
        <button className="sidebar-toggle" onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}><ChevronIcon direction={collapsed ? "right" : "left"} /></button>
      </div>

      <nav className="sidebar-nav" aria-label="Workspace">
        {/* Two views of the same cases: the board for daily work, the calendar for long-range planning. */}
        {link("/cases", "Board", <BoardIcon />, pathname.startsWith("/cases") && !calendar)}
        {link("/cases?view=calendar", "Calendar", <CalendarIcon />, calendar)}
        {link("/analytics", "Analytics", <ChartIcon />, pathname.startsWith("/analytics"))}
        <button className="sidebar-heading sidebar-fold" onClick={toggleTeam} aria-expanded={teamOpen} aria-controls="sidebar-team">Team<ChevronIcon /></button>
        {teamOpen && <ul className="sidebar-team" id="sidebar-team">
          {accounts.map(person => <li key={person.id} title={collapsed ? `${person.name}, ${person.role}` : undefined}>
            <span className={`avatar small tone-${person.id}`} aria-hidden="true">{person.initials}</span>
            <span className="nav-label"><strong>{person.name}</strong><span>{person.role}</span></span>
          </li>)}
        </ul>}
        <p className="sidebar-heading">About</p>
        {link("/brief", "Solution brief", <BriefIcon />, false)}
      </nav>

      <AccountMenu user={user} accounts={accounts} />
    </aside>
    <div className="app-main">{children}</div>
    {/* Always mounted, so the conversation survives collapsing the panel. */}
    <Assistant user={user} open={helperOpen} onToggle={toggleHelper} />
  </div>;
}
