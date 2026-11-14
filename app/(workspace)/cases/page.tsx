import type { Metadata } from "next";
import { Board } from "@/app/ui/board";
import { boardCards } from "@/lib/board";
import { requireUser } from "@/lib/session";
import { users } from "@/lib/users";
import "./board.css";

export const metadata: Metadata = { title: "Board" };

// One page, two views of the same cases. The sidebar picks the view with ?view=calendar.
export default async function BoardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requireUser();
  const view = (await searchParams).view === "calendar" ? "calendar" : "board";
  const cards = await boardCards();
  return <>
    <header className="topbar"><nav className="breadcrumb" aria-label="Breadcrumb"><span aria-current="page">{view === "calendar" ? "Calendar" : "Board"}</span></nav></header>
    <main className="page board-page">
      <Board cards={cards} user={user} directory={users} view={view} />
    </main>
  </>;
}
