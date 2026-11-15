import type { Metadata } from "next";
import { DemoScenario } from "@/app/ui/demo-scenario";
import { Suspense } from "react";
import { Board } from "@/app/ui/board";
import { boardCards } from "@/lib/board";
import { requireUser } from "@/lib/session";
import { users } from "@/lib/users";
import "./board.css";

export const metadata: Metadata = { title: "Board" };

// One page, two views of the same cases (?view=calendar). The frame prerenders; the cases stream in,
// because they depend on who you are (whose turn) and on the live workflow.
export default function BoardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  return <>
    <header className="topbar"><nav className="breadcrumb" aria-label="Breadcrumb"><span aria-current="page">Cases</span></nav><DemoScenario /></header>
    <main className="page board-page">
      <Suspense fallback={<BoardSkeleton />}><Cases searchParams={searchParams} /></Suspense>
    </main>
  </>;
}

async function Cases({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const [user, cards, { view }] = await Promise.all([requireUser(), boardCards(), searchParams]);
  // "Now" is taken once on the server and passed down, so server and browser render the same days left.
  return <Board cards={cards} user={user} directory={users} view={view === "calendar" ? "calendar" : "board"} now={Date.now()} />;
}

function BoardSkeleton() {
  return <div className="skeleton" aria-busy="true" aria-label="Loading cases">
    <div className="board-head"><h1>Supplier changes</h1></div>
    <div className="sk-block" style={{ height: 120 }} />
    <div className="board">{[0, 1, 2].map(i => <div key={i} className="sk-block" style={{ height: 300 }} />)}</div>
  </div>;
}
