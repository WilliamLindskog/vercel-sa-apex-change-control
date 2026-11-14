import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CaseWorkspace } from "@/app/ui/case-workspace";
import { openCaseId } from "@/lib/cases";
import { requireUser } from "@/lib/session";
import { users } from "@/lib/users";
import "./case.css";

// Only the live case has a page: it runs on the durable workflow. Example cases stay on the board.
export function generateStaticParams() {
  return [{ caseId: openCaseId }];
}

export async function generateMetadata({ params }: { params: Promise<{ caseId: string }> }): Promise<Metadata> {
  return { title: (await params).caseId };
}

export default function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  return <Suspense fallback={<CaseSkeleton />}><Case params={params} /></Suspense>;
}

async function Case({ params }: { params: Promise<{ caseId: string }> }) {
  const [{ caseId }, user] = await Promise.all([params, requireUser()]);
  if (caseId !== openCaseId) notFound();
  return <CaseWorkspace user={user} directory={users} />;
}

function CaseSkeleton() {
  return <>
    <header className="topbar" />
    <main className="page" aria-busy="true"><div className="sk-block" style={{ height: 70 }} /><div className="sk-block" style={{ height: 90, marginTop: 16 }} /><div className="sk-block" style={{ height: 320, marginTop: 16 }} /></main>
  </>;
}
