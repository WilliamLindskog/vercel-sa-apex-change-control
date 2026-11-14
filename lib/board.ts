import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { latestState, openCase } from "./case-store";
import { getChange, type CaseState } from "./case";
import { cases, type CaseSummary, type Stage } from "./cases";

export type BoardCard = CaseSummary & { stage: Stage; blocked: boolean; step: number; version?: number; runId?: string };

// Where a case sits follows its durable workflow, never a stored column. It also says who the case is
// waiting for, using the case's own team and the same rules as the case page's next-step card.
function stageOf(caseId: string, state: CaseState | null): { stage: Stage; blocked: boolean; step: number; waitingOn?: string; note?: string } {
  const { team } = getChange(caseId);
  if (!state) return { stage: "new", blocked: false, step: 1, waitingOn: team.lead };
  const run = state.assessment;
  const blocked = run?.assessment.findings.some(f => f.disposition === "uncertain") ?? false;
  const signed = Number(Boolean(state.signOffs.Quality)) + Number(Boolean(state.signOffs["Regulatory Affairs"]));
  if (state.routed) return { stage: "done", blocked: false, step: 5, note: `Plan sent ${new Date(state.routed.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` };
  if (state.assessing) return { stage: "assessing", blocked: false, step: 1 };
  if (!run) return { stage: "new", blocked: false, step: 1, waitingOn: team.lead };
  if (signed === 2 && !blocked) return { stage: "ready", blocked: false, step: 4, waitingOn: team.lead };
  const owner = blocked ? (run.assessment.openQuestions[0]?.owner === "Quality" ? team.quality : team.regulatory) : !state.signOffs.Quality ? team.quality : team.regulatory;
  return { stage: "review", blocked, step: 2 + signed, waitingOn: owner, note: blocked ? "Record missing" : undefined };
}

// The case index: which cases exist, their supplier and dates. Shared by everyone and changes rarely,
// so it is cached and tagged; Apex's case index would call revalidateTag("cases") (see app/api/revalidate).
async function caseIndex(): Promise<CaseSummary[]> {
  "use cache";
  cacheTag("cases");
  cacheLife("hours");
  return cases;
}

// Each case's live state is never cached. It lives in its workflow, changes on the workflow's own schedule
// (an assessment finishing, a sign-off), and a sign-off record must never be shown stale.
async function liveCard(summary: CaseSummary): Promise<BoardCard> {
  const state = await latestState(await openCase(summary.id));
  const at = stageOf(summary.id, state);
  return { ...summary, ...at, version: state?.version ?? 0, runId: state?.runId ?? "" };
}

// Every case as the board shows it. The board, analytics and Helper all read this, so they never disagree.
export async function boardCards(): Promise<BoardCard[]> {
  const index = await caseIndex();
  await connection(); // the rest is request time, never prerendered
  return Promise.all(index.map(liveCard));
}
