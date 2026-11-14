import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseWorkspace } from "@/app/ui/case-workspace";
import { openCaseId } from "@/lib/cases";
import { requireUser } from "@/lib/session";
import { users } from "@/lib/users";
import "./case.css";

export const metadata: Metadata = { title: openCaseId };

export default async function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  if (caseId !== openCaseId) notFound();
  const user = await requireUser();
  return <CaseWorkspace user={user} directory={users} />;
}
