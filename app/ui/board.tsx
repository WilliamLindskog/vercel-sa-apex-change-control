"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarView } from "@/app/ui/calendar";
import type { BoardCard } from "@/lib/board";
import { stages, type Stage } from "@/lib/cases";
import type { User } from "@/lib/users";

const daysUntil = (date: string, now: number) => Math.ceil((new Date(date).getTime() - now) / 86_400_000);

// What each stage asks of the person whose turn it is.
const ask: Partial<Record<Stage, string>> = { new: "Run the impact check", review: "Assess and sign off", ready: "Send the plan" };

// Moves a drag may trigger on a case. Each one is a real case command, checked again by the workflow.
const allowedMoves: Partial<Record<`${Stage}>${Stage}`, { command: "assess" | "route"; label: string }>> = {
  "new>assessing": { command: "assess", label: "Running the impact check…" },
  "ready>done": { command: "route", label: "Sending the plan…" },
};
const whyNot = (from: Stage, to: Stage) =>
  to === "review" || to === "ready" ? "Sign-offs happen on the case page: Technical, then Quality, then Regulatory."
  : to === "done" ? "All three assessments must be signed off before the plan can be sent."
  : to === "assessing" && from !== "new" ? "This case has already been checked. Run it again from the case page."
  : "Cases only move forward.";

export function Board({ cards: allCards, user, directory, view, now }: { cards: BoardCard[]; user: User; directory: User[]; view: "board" | "calendar"; now: number }) {
  const router = useRouter();
  const userId = user.id;
  const [onlyMine, setOnlyMine] = useState(false);
  const mine = allCards.filter(c => c.waitingOn === userId);
  const cards = onlyMine ? mine : allCards;
  const nameOf = (id?: string) => directory.find(d => d.id === id)?.name.split(" ")[0];
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "info" | "warn" } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  async function move(card: BoardCard, to: Stage) {
    if (card.stage === to) return;
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
        if (i === 2) router.refresh(); // show it in the Checking impact column while it runs
      }
      setNotice(null);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "That move didn't go through.", tone: "warn" });
    } finally {
      setPending(null);
      router.refresh();
    }
  }

  // One drop zone per stage. "New" and "Done" are slim strips above and below the three working columns:
  // new cases only need a glance, and done cases are history, so they fold away.
  const drop = (stage: Stage) => ({
    onDragOver: (event: React.DragEvent) => { event.preventDefault(); setOver(stage); },
    onDragLeave: () => setOver(current => current === stage ? null : current),
    onDrop: (event: React.DragEvent) => { event.preventDefault(); setOver(null); const card = cards.find(c => c.id === dragging); setDragging(null); if (card) move(card, stage); },
  });
  const dragProps = (card: BoardCard) => ({
    onDragStart: () => { setDragging(card.id); setNotice(null); },
    onDragEnd: () => { setDragging(null); setOver(null); },
  });
  const column = (stage: (typeof stages)[number]) => {
    const list = cards.filter(c => c.stage === stage.id);
    return <section key={stage.id} className={`board-col is-${stage.id} ${over === stage.id ? "is-over" : ""}`} aria-label={stage.label} {...drop(stage.id)}>
      <header><span className={`board-dot is-${stage.id}`} aria-hidden="true" /><h2>{stage.label}</h2><span className="board-count">{list.length}</span></header>
      <div className="board-cards">
        {list.map(card => <CardView key={card.id} card={card} now={now} userId={userId} waitingName={nameOf(card.waitingOn)} pending={pending === card.id} {...dragProps(card)} />)}
        {list.length === 0 && <p className="board-empty">Nothing here</p>}
      </div>
    </section>;
  };
  const strip = (stage: (typeof stages)[number], foldable: boolean) => {
    const list = cards.filter(c => c.stage === stage.id);
    const open = !foldable || showDone;
    return <section key={stage.id} className={`board-strip is-${stage.id} ${over === stage.id ? "is-over" : ""}`} aria-label={stage.label} {...drop(stage.id)}>
      <header>
        <span className={`board-dot is-${stage.id}`} aria-hidden="true" /><h2>{stage.label}</h2><span className="board-count">{list.length}</span>
        {foldable && list.length > 0 && <button className="strip-toggle" onClick={() => setShowDone(!showDone)} aria-expanded={open}>{open ? "Hide" : "Show"}</button>}
      </header>
      {open && <div className="strip-chips">
        {list.map(card => <Chip key={card.id} card={card} now={now} mine={card.waitingOn === userId} pending={pending === card.id} {...dragProps(card)} />)}
        {list.length === 0 && <span className="strip-empty">Nothing here</span>}
      </div>}
    </section>;
  };
  const [first, ...middle] = stages;
  const last = middle.pop()!;

  return <>
    <div className="board-head">
      <h1>Supplier changes</h1>
      <Bell cards={mine} now={now} />
      <label className="board-filter"><input type="checkbox" checked={onlyMine} onChange={event => setOnlyMine(event.target.checked)} /> Only mine</label>
    </div>
    {notice && <p className={`board-notice is-${notice.tone}`} role="status">{notice.text}<button onClick={() => setNotice(null)} aria-label="Dismiss">×</button></p>}
    {view === "calendar" ? <CalendarView cards={cards} userId={userId} nameOf={nameOf} now={now} /> :
    <div className="board-flow">
      {strip(first, false)}
      <div className="board">{middle.map(column)}</div>
      {strip(last, true)}
    </div>}
  </>;
}

// The cases waiting on you, behind a bell, soonest deadline first. Each one opens its case.
function Bell({ cards, now }: { cards: BoardCard[]; now: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => { if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  const sorted = [...cards].sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
  return <div className="bell" ref={ref}>
    <button className="bell-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="true" aria-label={`${cards.length} ${cards.length === 1 ? "case needs" : "cases need"} you`}>
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8.5a5 5 0 0 1 10 0c0 4 1.5 5.5 1.5 5.5h-13S5 12.5 5 8.5Z" /><path d="M8.5 16.5a1.6 1.6 0 0 0 3 0" /></svg>
      {cards.length > 0 && <span className="bell-badge">{cards.length}</span>}
    </button>
    {open && <div className="bell-pop" role="menu">
      <p className="bell-title">Your turn</p>
      {sorted.length === 0 && <p className="bell-empty">Nothing needs you right now.</p>}
      {sorted.map(card => {
        const body = <><strong>{card.material}</strong><span>{ask[card.stage] ?? card.note}</span><em className={daysUntil(card.due, now) < 30 ? "is-soon" : undefined}>{daysUntil(card.due, now)}d</em></>;
        return <Link key={card.id} role="menuitem" href={`/cases/${card.id}`} className="bell-item" onClick={() => setOpen(false)}>{body}</Link>;
      })}
    </div>}
  </div>;
}

// One-line card for the New and Done strips.
function Chip({ card, now, mine, pending, onDragStart, onDragEnd }: { card: BoardCard; now: number; mine: boolean; pending: boolean; onDragStart: () => void; onDragEnd: () => void }) {
  const days = daysUntil(card.due, now);
  const body = <>
    <strong>{card.material}</strong>
    <span className="chip-meta">{card.stage === "done" ? card.note ?? "Closed" : `${days} days`}</span>
    {mine && <span className="bc-turn">Your turn</span>}
  </>;
  return <div data-case={card.id} className={`strip-chip ${mine ? "is-mine" : ""} ${pending ? "is-pending" : ""}`} draggable onDragStart={onDragStart} onDragEnd={onDragEnd} title={`${card.material} | ${card.supplier}`}>
    <Link href={`/cases/${card.id}`} draggable={false}>{body}</Link>
  </div>;
}

function CardView({ card, now, userId, waitingName, pending, onDragStart, onDragEnd }: { card: BoardCard; now: number; userId: string; waitingName?: string; pending: boolean; onDragStart: () => void; onDragEnd: () => void }) {
  const days = daysUntil(card.due, now);
  const mine = card.waitingOn === userId;
  const body = <>
    <div className="bc-top">
      <span className="bc-id" title={card.id}>#{card.id.split("-").pop()}</span>
      {card.blocked ? <span className="pill pill-blocked" title={card.note}>Blocked</span> : card.stage !== "done" && days >= 0 ? <span className={`bc-due ${days < 30 ? "is-soon" : ""}`}>{days} days</span> : null}
    </div>
    <h3>{card.material}</h3>
    <p className="bc-supplier" title={`Raw material from ${card.supplier}`}>Raw material: {card.does ?? card.supplier}</p>
    <div className="bc-progress" aria-label={`Step ${card.step} of 6`}>{[1, 2, 3, 4, 5, 6].map(n => <i key={n} className={n <= card.step ? "is-on" : undefined} />)}</div>
    {/* Whose turn it is: the one thing a person scanning the board needs from each card. */}
    <div className="bc-foot">
      {mine ? <span className="bc-turn">Your turn</span>
        : card.waitingOn ? <span className="bc-waiting"><span className={`avatar tiny tone-${card.waitingOn}`} aria-hidden="true" />Waiting for {waitingName}</span>
        : <span className="bc-waiting">{card.stage === "done" ? card.note ?? "Closed" : "Running…"}</span>}
    </div>
    {pending && <span className="bc-pending" aria-hidden="true" />}
  </>;
  // Every case opens, and every drag is a real command checked by that case's workflow.
  return <article data-case={card.id} className={`board-card ${mine ? "is-mine" : ""} ${pending ? "is-pending" : ""}`} draggable onDragStart={onDragStart} onDragEnd={onDragEnd} aria-busy={pending}>
    <Link href={`/cases/${card.id}`} className="bc-link" draggable={false}>{body}</Link>
  </article>;
}
