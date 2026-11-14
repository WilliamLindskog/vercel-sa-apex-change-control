import Link from "next/link";
import type { BoardCard } from "@/lib/board";
import { stages } from "@/lib/cases";

const DAY = 86_400_000;
const parse = (date: string) => new Date(date).getTime();
const short = (time: number) => new Date(time).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// Long-range view of the same cases: each one is a bar from the day the notice arrived to the day supply ends.
// Same cards, same whose-turn rules and filter as the board; only the layout changes.
export function CalendarView({ cards, userId, nameOf, now }: { cards: BoardCard[]; userId: string; nameOf: (id?: string) => string | undefined; now: number }) {
  const today = now;
  const first = new Date(Math.min(today, ...cards.map(c => parse(c.opened))));
  const last = new Date(Math.max(today, ...cards.map(c => parse(c.due))));
  const start = new Date(first.getFullYear(), first.getMonth(), 1).getTime();
  const end = new Date(last.getFullYear(), last.getMonth() + 1, 1).getTime();
  const at = (time: number) => `${((time - start) / (end - start)) * 100}%`;

  const months: { label: string; from: number }[] = [];
  for (let d = new Date(start); d.getTime() < end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1))
    months.push({ label: d.toLocaleDateString("en-GB", { month: "short", year: d.getMonth() === 0 || months.length === 0 ? "numeric" : undefined }), from: d.getTime() });

  // Open cases by deadline, closed ones last.
  const rows = [...cards].sort((a, b) => Number(a.stage === "done") - Number(b.stage === "done") || parse(a.due) - parse(b.due));

  return <div className="cal" role="table" aria-label="Cases by date">
    <div className="cal-scroll">
      <div className="cal-head" role="row">
        <span className="cal-name" role="columnheader">Case</span>
        <div className="cal-track" role="columnheader">
          {months.map(m => <span key={m.from} className="cal-month" style={{ left: at(m.from) }}>{m.label}</span>)}
        </div>
      </div>

      <div className="cal-body">
        {/* Month lines and today's line sit behind every row. */}
        <div className="cal-grid" aria-hidden="true">
          {months.map(m => <i key={m.from} style={{ left: at(m.from) }} />)}
          <b className="cal-today" style={{ left: at(today) }}><span>Today</span></b>
        </div>

        {rows.length === 0 && <p className="board-empty">Nothing here</p>}
        {rows.map(card => {
          const mine = card.waitingOn === userId;
          const opened = parse(card.opened), due = parse(card.due);
          const daysLeft = Math.ceil((due - today) / DAY);
          const stage = stages.find(s => s.id === card.stage)!;
          const rowClass = `cal-row is-${card.stage} ${mine ? "is-mine" : ""}`;
          const cells = <>
            <span className="cal-name" role="cell">
              <strong>{card.material}</strong>
              <span>{mine ? <span className="bc-turn">Your turn</span>
                : card.waitingOn ? <><span className={`avatar tiny tone-${card.waitingOn}`} aria-hidden="true" />{nameOf(card.waitingOn)}</>
                : stage.label}</span>
            </span>
            <span className="cal-track" role="cell">
              <span className="cal-bar" style={{ left: at(opened), width: `calc(${at(due)} - ${at(opened)})` }} title={`${short(opened)} → ${short(due)} | ${stage.label}`}>
                <span className="cal-fill" style={{ width: `${(card.step / 5) * 100}%` }} />
              </span>
              <span className={`cal-due ${card.stage !== "done" && daysLeft < 30 ? "is-soon" : ""}`} style={{ left: at(due) }}>
                {card.stage === "done" ? short(due) : `${short(due)} | ${daysLeft}d`}
              </span>
            </span>
          </>;
          return <Link key={card.id} href={`/cases/${card.id}`} role="row" data-case={card.id} className={rowClass}>{cells}</Link>;
        })}
      </div>
    </div>

    <div className="cal-legend" aria-hidden="true">
      {stages.map(s => <span key={s.id}><i className={`board-dot is-${s.id}`} />{s.label}</span>)}
      <span><i className="cal-legend-today" />Today</span>
    </div>
  </div>;
}
