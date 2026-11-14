"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { stages, type CaseSummary, type Stage } from "@/lib/cases";

export type BoardCard = CaseSummary & { stage: Stage; blocked: boolean; step: number; version?: number; runId?: string };

const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);

// Moves a drag may trigger on the live case. Each one is a real case command, checked again by the workflow.
const allowedMoves: Partial<Record<`${Stage}>${Stage}`, { command: "assess" | "route"; label: string }>> = {
  "new>assessing": { command: "assess", label: "Running the assessment…" },
  "ready>done": { command: "route", label: "Sending the plan…" },
};
const whyNot = (from: Stage, to: Stage) =>
  to === "review" || to === "ready" ? "Sign-offs happen on the case page, by Quality and Regulatory."
  : to === "done" ? "Both sign-offs are needed before the plan can be sent."
  : to === "assessing" && from !== "new" ? "This case has already been assessed. Run it again from the case page."
  : "Cases only move forward.";

export function Board({ cards, userId }: { cards: BoardCard[]; userId: string }) {
  const router = useRouter();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "info" | "warn" } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function move(card: BoardCard, to: Stage) {
    if (card.stage === to) return;
    if (!card.live) { setNotice({ text: `${card.material} is a sample case and can't be moved.`, tone: "warn" }); return; }
    const move = allowedMoves[`${card.stage}>${to}`];
    if (!move) { setNotice({ text: whyNot(card.stage, to), tone: "warn" }); return; }
    setPending(card.id); setNotice({ text: move.label, tone: "info" });
    try {
      const response = await fetch(`/api/cases/${card.id}/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: move.command }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "That move didn't go through.");
      // Wait for the workflow to apply it, then re-read the board from the server.
      for (let i = 0; i < 120; i++) {
        await new Promise(resolve => setTimeout(resolve, 800));
        const state = await fetch(`/api/cases/${card.id}`, { cache: "no-store" }).then(r => r.json());
        if (state.version > (card.version ?? 0) && !state.assessing) break;
        if (i === 2) router.refresh(); // show it in the Assessing column while it runs
      }
      setNotice(null);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "That move didn't go through.", tone: "warn" });
    } finally {
      setPending(null);
      router.refresh();
    }
  }

  return <>
    {notice && <p className={`board-notice is-${notice.tone}`} role="status">{notice.text}<button onClick={() => setNotice(null)} aria-label="Dismiss">×</button></p>}
    <div className="board">
      {stages.map(stage => {
        const column = cards.filter(c => c.stage === stage.id);
        return <section key={stage.id} className={`board-col ${over === stage.id ? "is-over" : ""}`} aria-label={stage.label}
          onDragOver={event => { event.preventDefault(); setOver(stage.id); }}
          onDragLeave={() => setOver(current => current === stage.id ? null : current)}
          onDrop={event => { event.preventDefault(); setOver(null); const card = cards.find(c => c.id === dragging); setDragging(null); if (card) move(card, stage.id); }}>
          <header><span className={`board-dot is-${stage.id}`} aria-hidden="true" /><h2>{stage.label}</h2><span className="board-count">{column.length}</span></header>
          <div className="board-cards">
            {column.map(card => <CardView key={card.id} card={card} userId={userId} pending={pending === card.id}
              onDragStart={() => { setDragging(card.id); setNotice(null); }} onDragEnd={() => { setDragging(null); setOver(null); }} />)}
            {column.length === 0 && <p className="board-empty">Nothing here</p>}
          </div>
        </section>;
      })}
    </div>
  </>;
}

function CardView({ card, userId, pending, onDragStart, onDragEnd }: { card: BoardCard; userId: string; pending: boolean; onDragStart: () => void; onDragEnd: () => void }) {
  const days = daysUntil(card.due);
  const body = <>
    <div className="bc-top">
      <span className="bc-id">{card.id}</span>
      {card.blocked ? <span className="pill pill-blocked">Blocked</span> : card.stage !== "done" && days >= 0 ? <span className={`bc-due ${days < 30 ? "is-soon" : ""}`}>{days} days</span> : null}
    </div>
    <h3>{card.material}</h3>
    <p className="bc-supplier">{card.supplier}</p>
    <div className="bc-progress" aria-label={`Step ${card.step} of 5`}>{[1, 2, 3, 4, 5].map(n => <i key={n} className={n <= card.step ? "is-on" : undefined} />)}</div>
    <div className="bc-foot">
      <span className="bc-people">{card.people.map(id => <span key={id} className={`avatar tiny tone-${id} ${id === userId ? "is-me" : ""}`} aria-hidden="true">{id.slice(0, 2).toUpperCase()}</span>)}</span>
      <span className="bc-meta">{card.products} products{card.note ? ` · ${card.note}` : ""}</span>
    </div>
    {pending && <span className="bc-pending" aria-hidden="true" />}
  </>;
  return <article className={`board-card ${card.live ? "is-live" : "is-sample"} ${pending ? "is-pending" : ""}`} draggable onDragStart={onDragStart} onDragEnd={onDragEnd} aria-busy={pending}>
    {card.live ? <Link href={`/cases/${card.id}`} className="bc-link" draggable={false}>{body}</Link> : <div className="bc-link">{body}</div>}
  </article>;
}
