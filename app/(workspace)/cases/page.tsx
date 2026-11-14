import type { Metadata } from "next";
import { Board, type BoardCard } from "@/app/ui/board";
import { latestState, openCase } from "@/lib/case-store";
import type { CaseState } from "@/lib/case";
import { cases, type Stage } from "@/lib/cases";
import { requireUser } from "@/lib/session";
import { users } from "@/lib/users";
import "./board.css";

export const metadata: Metadata = { title: "Board" };

// Where the live case sits on the board follows its durable workflow, never a stored column.
// It also says who the case is waiting for, using the same rules as the case page's next-step card.
function stageOf(state: CaseState | null): { stage: Stage; blocked: boolean; step: number; waitingOn?: string } {
  if (!state) return { stage: "new", blocked: false, step: 1, waitingOn: "dana" };
  const run = state.assessment;
  const blocked = run?.assessment.findings.some(f => f.disposition === "uncertain") ?? false;
  const signed = Number(Boolean(state.signOffs.Quality)) + Number(Boolean(state.signOffs["Regulatory Affairs"]));
  if (state.routed) return { stage: "done", blocked: false, step: 5 };
  if (state.assessing) return { stage: "assessing", blocked: false, step: 1 };
  if (!run) return { stage: "new", blocked: false, step: 1, waitingOn: "dana" };
  if (signed === 2 && !blocked) return { stage: "ready", blocked: false, step: 4, waitingOn: "dana" };
  const owner = blocked ? (run.assessment.openQuestions[0]?.owner === "Quality" ? "priya" : "marcus") : !state.signOffs.Quality ? "priya" : "marcus";
  return { stage: "review", blocked, step: 2 + signed, waitingOn: owner };
}

const fixedStep: Record<Stage, number> = { new: 1, assessing: 1, review: 3, ready: 4, done: 5 };

export default async function BoardPage() {
  const user = await requireUser();
  const live = cases.find(c => c.live)!;
  const liveState = await latestState(await openCase(live.id));
  const liveStage = stageOf(liveState);

  const cards: BoardCard[] = cases.map(c => c.live
    ? { ...c, stage: liveStage.stage, blocked: liveStage.blocked, step: liveStage.step, waitingOn: liveStage.waitingOn, version: liveState?.version ?? 0, runId: liveState?.runId ?? "" }
    : { ...c, stage: c.stage!, blocked: false, step: fixedStep[c.stage!] });

  return <>
    <header className="topbar"><nav className="breadcrumb" aria-label="Breadcrumb"><span aria-current="page">Board</span></nav></header>
    <main className="page board-page">
      <Board cards={cards} user={user} directory={users} />
    </main>
  </>;
}
