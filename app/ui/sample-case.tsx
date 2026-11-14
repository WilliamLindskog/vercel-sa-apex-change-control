import Link from "next/link";
import type { BoardCard } from "@/lib/board";
import { stages } from "@/lib/cases";
import type { User } from "@/lib/users";

const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);

// What each stage asks of its owner, in a few words.
const ask: Record<string, string> = {
  new: "Start the assessment",
  review: "Review and sign off",
  ready: "Send the change plan",
};

// A read-only view of a sample case. Only the Binder X-17 case runs on the live workflow.
export function SampleCase({ card, user, directory }: { card: BoardCard; user: User; directory: User[] }) {
  const owner = directory.find(d => d.id === card.waitingOn);
  const mine = card.waitingOn === user.id;
  const current = stages.findIndex(s => s.id === card.stage);
  const days = daysUntil(card.due);

  return <>
    <header className="topbar">
      <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/cases">Board</Link><span aria-hidden="true">/</span><span aria-current="page">{card.id}</span></nav>
    </header>

    <main className="page cw">
      <header className="cw-head">
        <div>
          <p className="cw-meta">{card.id} · {card.supplier}</p>
          <h1>{card.material}</h1>
        </div>
        <div className="cw-head-side">
          {card.stage !== "done" && days >= 0 && <span className="cw-days"><strong>{days}</strong> days left</span>}
          <span className={`pill ${card.stage === "done" ? "pill-routed" : "pill-review"}`}>{stages[current].label}</span>
        </div>
      </header>

      <ol className="cw-process" aria-label="Case progress">
        {stages.map((stage, i) => <li key={stage.id} className={i < current || card.stage === "done" ? "is-done" : i === current ? "is-current" : undefined}>
          <span className="cw-process-text"><strong>{stage.label}</strong><span>{i === current && owner ? owner.name : i < current || card.stage === "done" ? "Done" : "—"}</span></span>
        </li>)}
      </ol>

      <section className={`cw-next ${card.stage === "done" ? "is-routed" : ""}`} aria-label="Next step">
        {owner
          ? <div className="cw-next-who">
              <span className={`avatar tone-${owner.id}`} aria-hidden="true">{owner.initials}</span>
              <span><strong>{mine ? "Your turn" : `Waiting for ${owner.name.split(" ")[0]}`}</strong><span>{owner.title}</span></span>
            </div>
          : <strong>Closed</strong>}
        <p className="cw-next-task">{owner ? ask[card.stage] ?? card.note : card.note}{owner && card.note ? ` · ${card.note}` : ""}</p>
        <Link className="btn btn-secondary" href="/cases/SCC-2026-041">Open the live case</Link>
      </section>
    </main>
  </>;
}
