import Link from "next/link";
import { ApexLogo } from "@/app/ui/apex-mark";
import { AccountMenu } from "@/app/ui/account-menu";
import { SidebarNav } from "@/app/ui/sidebar-nav";
import { cases } from "@/lib/cases";
import { requireUser } from "@/lib/session";
import { users } from "@/lib/users";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const open = cases.filter(item => item.state === "open");

  return <div className="app">
    <aside className="sidebar">
      <Link href="/cases" className="sidebar-brand" aria-label="Apex Change Control, all cases"><ApexLogo size={26} label="Change Control" /></Link>
      <SidebarNav openCases={open.map(item => ({ id: item.id, title: item.material }))} />
      <AccountMenu user={user} accounts={users} />
    </aside>
    <div className="app-main">{children}</div>
  </div>;
}
