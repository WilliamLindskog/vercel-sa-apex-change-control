import { AppShell } from "@/app/ui/app-shell";
import { requireUser } from "@/lib/session";
import { users } from "@/lib/users";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell user={user} accounts={users}>{children}</AppShell>;
}
