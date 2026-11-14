import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { latestState, openCase } from "./case-store";
import type { CaseState } from "./case";
import { cases, type CaseSummary, type Stage } from "./cases";

export type BoardCard = CaseSummary & { stage: Stage; blocked: boolean; step: number; version?: number; runId?: string };

// Where the live case sits follows its durable workflow, never a stored column.
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

// Progress out of 5, as for the live case: 1 new, 2 in review (no sign-off yet), 4 both signed, 5 sent.
const fixedStep: Record<Stage, number> = { new: 1, assessing: 1, review: 2, ready: 4, done: 5 };

// Reference cases: the same for everyone and they change rarely, so they are cached and tagged.
// In production these would come from Apex's case index; a change event from there calls
// revalidateTag("cases") (see app/api/revalidate) instead of waiting for the lifetime to run out.
async function referenceCards(): Promise<BoardCard[]> {
  "use cache";
  cacheTag("cases");
  cacheLife("hours");
  return cases.filter(c => !c.live).map(c => ({ ...c, stage: c.stage!, blocked: false, step: fixedStep[c.stage!] }));
}

// The live case is never cached. Its state lives in the workflow, changes on the workflow's own schedule
// (an assessment finishing, a sign-off), and a sign-off record must never be shown stale. It is read per request.
async function liveCard(): Promise<BoardCard> {
  await connection(); // request time, never prerendered
  const live = cases.find(c => c.live)!;
  const state = await latestState(await openCase(live.id));
  const at = stageOf(state);
  return { ...live, stage: at.stage, blocked: at.blocked, step: at.step, waitingOn: at.waitingOn, version: state?.version ?? 0, runId: state?.runId ?? "" };
}

// Every case as the board shows it. The board, analytics and Helper all read this, so they never disagree.
export async function boardCards(): Promise<BoardCard[]> {
  const [live, reference] = await Promise.all([liveCard(), referenceCards()]);
  return cases.map(c => c.live ? live : reference.find(r => r.id === c.id)!);
}
