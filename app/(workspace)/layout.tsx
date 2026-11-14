import { AppShell } from "@/app/ui/app-shell";
import { cases } from "@/lib/cases";
import { requireUser } from "@/lib/session";
import { users } from "@/lib/users";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const open = cases.filter(item => item.live);
  return <AppShell user={user} accounts={users} openCases={open.map(item => ({ id: item.id, title: item.material }))}>{children}</AppShell>;
}
