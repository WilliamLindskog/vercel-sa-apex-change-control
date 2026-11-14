import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseWorkspace } from "@/app/ui/case-workspace";
import { SampleCase } from "@/app/ui/sample-case";
import { boardCards } from "@/lib/board";
import { openCaseId } from "@/lib/cases";
import { requireUser } from "@/lib/session";
import { users } from "@/lib/users";
import "./case.css";

export async function generateMetadata({ params }: { params: Promise<{ caseId: string }> }): Promise<Metadata> {
  return { title: (await params).caseId };
}

export default async function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const user = await requireUser();
  if (caseId === openCaseId) return <CaseWorkspace user={user} directory={users} />;
  // Sample cases fill the board; they open read-only.
  const card = (await boardCards()).find(c => c.id === caseId && !c.live);
  if (!card) notFound();
  return <SampleCase card={card} user={user} directory={users} />;
}
