import type { Metadata } from "next";
import { Board, type BoardCard } from "@/app/ui/board";
import { latestState, openCase } from "@/lib/case-store";
import type { CaseState } from "@/lib/case";
import { cases, type Stage } from "@/lib/cases";
import { requireUser } from "@/lib/session";
import "./board.css";

export const metadata: Metadata = { title: "Board" };

// Where the live case sits on the board follows its durable workflow, never a stored column.
function stageOf(state: CaseState | null): { stage: Stage; blocked: boolean; step: number } {
  if (!state) return { stage: "new", blocked: false, step: 1 };
  const run = state.assessment;
  const blocked = run?.assessment.findings.some(f => f.disposition === "uncertain") ?? false;
  const signed = Number(Boolean(state.signOffs.Quality)) + Number(Boolean(state.signOffs["Regulatory Affairs"]));
  if (state.routed) return { stage: "done", blocked: false, step: 5 };
  if (state.assessing) return { stage: "assessing", blocked: false, step: 1 };
  if (!run) return { stage: "new", blocked: false, step: 1 };
  if (signed === 2 && !blocked) return { stage: "ready", blocked: false, step: 4 };
  return { stage: "review", blocked, step: 2 + signed };
}

const fixedStep: Record<Stage, number> = { new: 1, assessing: 1, review: 3, ready: 4, done: 5 };

export default async function BoardPage() {
  const user = await requireUser();
  const live = cases.find(c => c.live)!;
  const liveState = await latestState(await openCase(live.id));
  const liveStage = stageOf(liveState);

  const cards: BoardCard[] = cases.map(c => c.live
    ? { ...c, stage: liveStage.stage, blocked: liveStage.blocked, step: liveStage.step, version: liveState?.version ?? 0, runId: liveState?.runId ?? "" }
    : { ...c, stage: c.stage!, blocked: false, step: fixedStep[c.stage!] });

  return <>
    <header className="topbar"><nav className="breadcrumb" aria-label="Breadcrumb"><span aria-current="page">Board</span></nav></header>
    <main className="page board-page">
      <div className="board-head">
        <h1>Supplier changes</h1>
        <p>{user.role === "Product Change Lead" ? "Drag a case to move it forward. The case rules decide what is allowed." : `Cases waiting on ${user.role} show your face.`}</p>
      </div>
      <Board cards={cards} userId={user.id} />
    </main>
  </>;
}
