"use client";

import Link from "next/link";
import { useState } from "react";
import type { BoardCard } from "@/lib/board";
import { stages } from "@/lib/cases";

const DAY = 86_400_000;
const parse = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
const short = (time: number) => new Date(time).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// Planning view of the same cases. Each row answers two questions: how long until the change takes effect,
// and when must customer notices go out. Bars run from today to the change date, coloured by how soon it is;
// the flag marks the last day to send notices. Same cases, same whose-turn rules and filter as the board.
export function CalendarView({ cards, userId, nameOf, now }: { cards: BoardCard[]; userId: string; nameOf: (id?: string) => string | undefined; now: number }) {
  const [showDone, setShowDone] = useState(false);
  const open = cards.filter(c => c.stage !== "done").sort((a, b) => parse(a.deadline) - parse(b.deadline));
  const done = cards.filter(c => c.stage === "done");

  const today = new Date(now);
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1);
  const lastDeadline = Math.max(now, ...open.map(c => parse(c.deadline)));
  const last = new Date(lastDeadline);
  const end = Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 1);
  const at = (time: number) => `${Math.min(100, Math.max(0, ((time - start) / (end - start)) * 100))}%`;

  const months: { label: string; from: number }[] = [];
  for (let d = new Date(start); d.getTime() < end; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)))
    months.push({ label: d.toLocaleDateString("en-GB", { month: "short", year: d.getUTCMonth() === 0 || months.length === 0 ? "numeric" : undefined, timeZone: "UTC" }), from: d.getTime() });

  return <div className="cal" role="table" aria-label="Open cases by date">
    <div className="cal-scroll">
      <div className="cal-head" role="row">
        <span className="cal-name" role="columnheader">Case</span>
        <div className="cal-track" role="columnheader">
          {months.map(m => <span key={m.from} className="cal-month" style={{ left: at(m.from) }}>{m.label}</span>)}
        </div>
      </div>

      <div className="cal-body">
        <div className="cal-grid" aria-hidden="true">
          {months.map(m => <i key={m.from} style={{ left: at(m.from) }} />)}
          <b className="cal-today" style={{ left: at(now) }}><span>Today</span></b>
        </div>

        {open.length === 0 && <p className="board-empty">No open cases</p>}
        {open.map(card => {
          const mine = card.waitingOn === userId;
          const due = parse(card.deadline);
          const daysLeft = Math.ceil((due - now) / DAY);
          const urgency = daysLeft < 30 ? "is-soon" : daysLeft < 60 ? "is-near" : "is-later";
          const notice = card.noticeBy ? parse(card.noticeBy) : null;
          const noticeLate = notice !== null && notice < now;
          return <Link key={card.id} href={`/cases/${card.id}`} role="row" data-case={card.id} className={`cal-row ${mine ? "is-mine" : ""}`}>
            <span className="cal-name" role="cell">
              <strong>{card.material}</strong>
              <span>
                <i className={`board-dot is-${card.stage}`} aria-hidden="true" />{stages.find(s => s.id === card.stage)?.label}
                {mine ? <span className="bc-turn">Your turn</span> : card.waitingOn ? <><span className={`avatar tiny tone-${card.waitingOn}`} aria-hidden="true" />{nameOf(card.waitingOn)}</> : null}
              </span>
            </span>
            <span className="cal-track" role="cell">
              <span className={`cal-bar ${urgency}`} style={{ left: at(now), width: `calc(${at(due)} - ${at(now)})` }} title={`${daysLeft} days until the change on ${short(due)}`} />
              {notice !== null && <span className={`cal-notice ${noticeLate ? "is-late" : ""}`} style={{ left: at(Math.max(notice, start)) }} title={`${noticeLate ? "Customer notices were due" : "Send customer notices by"} ${short(notice)} (${card.noticeDays}-day notice)`} />}
              <span className={`cal-due ${daysLeft < 30 ? "is-soon" : ""}`} style={{ left: at(due) }}>{short(due)} | {daysLeft} d</span>
            </span>
          </Link>;
        })}

        {showDone && done.map(card => <Link key={card.id} href={`/cases/${card.id}`} role="row" className="cal-row is-done">
          <span className="cal-name" role="cell"><strong>{card.material}</strong><span><i className="board-dot is-done" aria-hidden="true" />{card.note ?? "Done"}</span></span>
          <span className="cal-track" role="cell" />
        </Link>)}
      </div>
    </div>

    <div className="cal-foot">
      <div className="cal-legend" aria-hidden="true">
        <span><i className="cal-key is-soon" />Under 30 days</span>
        <span><i className="cal-key is-near" />Under 60 days</span>
        <span><i className="cal-key is-later" />Later</span>
        <span><i className="cal-key-notice" />Send notices by</span>
        <span><i className="cal-legend-today" />Today</span>
      </div>
      {done.length > 0 && <button className="strip-toggle" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>{showDone ? "Hide" : "Show"} {done.length} done</button>}
    </div>
  </div>;
}
