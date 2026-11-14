import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CaseWorkspace } from "@/app/ui/case-workspace";
import { SampleCase } from "@/app/ui/sample-case";
import { boardCards } from "@/lib/board";
import { cases, openCaseId } from "@/lib/cases";
import { requireUser } from "@/lib/session";
import { users } from "@/lib/users";
import "./case.css";

// The case IDs are known at build time, so each case page gets its own prerendered frame.
export function generateStaticParams() {
  return cases.map(c => ({ caseId: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ caseId: string }> }): Promise<Metadata> {
  return { title: (await params).caseId };
}

export default function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  return <Suspense fallback={<CaseSkeleton />}><Case params={params} /></Suspense>;
}

async function Case({ params }: { params: Promise<{ caseId: string }> }) {
  const [{ caseId }, user] = await Promise.all([params, requireUser()]);
  if (caseId === openCaseId) return <CaseWorkspace user={user} directory={users} />;
  // Sample cases fill the board; they open read-only.
  const card = (await boardCards()).find(c => c.id === caseId && !c.live);
  if (!card) notFound();
  return <SampleCase card={card} user={user} directory={users} />;
}

function CaseSkeleton() {
  return <>
    <header className="topbar" />
    <main className="page" aria-busy="true"><div className="sk-block" style={{ height: 70 }} /><div className="sk-block" style={{ height: 90, marginTop: 16 }} /><div className="sk-block" style={{ height: 320, marginTop: 16 }} /></main>
  </>;
}
