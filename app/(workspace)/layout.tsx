import { Suspense } from "react";
import { AccountMenu } from "@/app/ui/account-menu";
import { AppShell } from "@/app/ui/app-shell";
import { Assistant } from "@/app/ui/assistant";
import { requireUser } from "@/lib/session";
import { users } from "@/lib/users";

// Static shell: the sidebar prerenders at build. Who you are comes from the session cookie at request time,
// so the account menu and Helper stream in behind their own boundaries without holding up the page.
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AppShell
    accounts={users}
    account={<Suspense fallback={<div className="account-menu account-skeleton" aria-hidden="true" />}><Account /></Suspense>}
    helper={<Suspense fallback={null}><Helper /></Suspense>}>
    {children}
  </AppShell>;
}

async function Account() {
  return <AccountMenu user={await requireUser()} accounts={users} />;
}

async function Helper() {
  return <Assistant user={await requireUser()} />;
}
