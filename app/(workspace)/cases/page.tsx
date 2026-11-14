import type { Metadata } from "next";
import { Board } from "@/app/ui/board";
import { boardCards } from "@/lib/board";
import { requireUser } from "@/lib/session";
import { users } from "@/lib/users";
import "./board.css";

export const metadata: Metadata = { title: "Board" };

export default async function BoardPage() {
  const user = await requireUser();
  const cards = await boardCards();
  return <>
    <header className="topbar"><nav className="breadcrumb" aria-label="Breadcrumb"><span aria-current="page">Board</span></nav></header>
    <main className="page board-page">
      <Board cards={cards} user={user} directory={users} />
    </main>
  </>;
}
