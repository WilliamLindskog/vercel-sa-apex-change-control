import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CaseWorkspace } from "@/app/ui/case-workspace";
import { cases, isCase } from "@/lib/cases";
import { requireUser } from "@/lib/session";
import { users } from "@/lib/users";
import "./case.css";

// Every case has a page backed by its own durable workflow. The IDs are known at build time,
// so each page gets a prerendered frame.
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
  if (!isCase(caseId)) notFound();
  return <CaseWorkspace caseId={caseId} user={user} directory={users} />;
}

function CaseSkeleton() {
  return <>
    <header className="topbar" />
    <main className="page" aria-busy="true"><div className="sk-block" style={{ height: 70 }} /><div className="sk-block" style={{ height: 90, marginTop: 16 }} /><div className="sk-block" style={{ height: 320, marginTop: 16 }} /></main>
  </>;
}
