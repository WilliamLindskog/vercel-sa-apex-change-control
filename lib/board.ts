import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { latestState, openCase } from "./case-store";
import { getChange, type CaseState } from "./case";
import { cases, type CaseSummary, type Stage } from "./cases";
import { reviewOrder, type ReviewRole } from "./users";

// noticeBy: the last day to send customer notices (change date minus the longest notice period that applies).
export type BoardCard = CaseSummary & { stage: Stage; blocked: boolean; step: number; version?: number; runId?: string; noticeBy?: string; noticeDays?: number };

// Where a case sits follows its durable workflow, never a stored column. It also says who the case is
// waiting for, using the case's own team and the same rules as the case page's next-step card.
function stageOf(caseId: string, state: CaseState | null): { stage: Stage; blocked: boolean; step: number; waitingOn?: string; note?: string } {
  const { team } = getChange(caseId);
  if (!state) return { stage: "new", blocked: false, step: 1, waitingOn: team.lead };
  const run = state.assessment;
  const blocked = run?.assessment.findings.some(f => f.disposition === "uncertain") ?? false;
  const signed = reviewOrder.filter(review => state.signOffs[review]).length;
  const reviewer: Record<ReviewRole, string> = { Technical: team.lab, Quality: team.quality, Regulatory: team.regulatory };
  if (state.routed) return { stage: "done", blocked: false, step: 6, note: `Plan sent ${new Date(state.routed.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` };
  if (state.assessing) return { stage: "assessing", blocked: false, step: 1 };
  if (!run) return { stage: "new", blocked: false, step: 1, waitingOn: team.lead };
  if (signed === reviewOrder.length && !blocked) return { stage: "ready", blocked: false, step: 5, waitingOn: team.lead };
  const asked = run.assessment.openQuestions[0]?.owner;
  const owner = blocked ? (asked && asked !== "Product Manager" ? reviewer[asked] : team.lead) : reviewer[reviewOrder[signed]];
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
  const days = Math.max(0, ...(state?.assessment?.assessment.findings ?? []).filter(f => f.disposition !== "unaffected").map(f => f.noticeDays ?? 0));
  const noticeBy = days ? new Date(Date.parse(`${summary.deadline}T12:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10) : undefined;
  return { ...summary, ...at, noticeBy, noticeDays: days || undefined, version: state?.version ?? 0, runId: state?.runId ?? "" };
}

// Every case as the board shows it. The board, analytics and Helper all read this, so they never disagree.
export async function boardCards(): Promise<BoardCard[]> {
  const index = await caseIndex();
  await connection(); // the rest is request time, never prerendered
  return Promise.all(index.map(liveCard));
}

// What each of Apex's systems has answered lately, from the lookups the case assessments actually made.
// Read live from the case workflows, like the board: this is evidence of the connection, not a status flag.
export async function systemsActivity() {
  const index = await caseIndex();
  await connection();
  const states = await Promise.all(index.map(async c => latestState(await openCase(c.id))));
  const runs = states.flatMap(s => (s?.assessment ? [s.assessment] : []));
  return (["ERP", "QMS", "Regulatory"] as const).map(system => {
    const calls = runs.flatMap(r => r.calls.filter(c => c.system === system).map(c => ({ ...c, at: r.completedAt })));
    const ok = calls.filter(c => c.status < 400);
    const last = calls.map(c => c.at).sort().at(-1) ?? null;
    return {
      system,
      lookups: calls.length,
      failures: calls.length - ok.length,
      avgMs: ok.length ? Math.round(ok.reduce((n, c) => n + c.ms, 0) / ok.length) : null,
      lastAt: last,
      cases: runs.filter(r => r.calls.some(c => c.system === system)).length,
    };
  });
}
