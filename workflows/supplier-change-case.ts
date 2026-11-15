import { createHook, getWorkflowMetadata, getWritable } from "workflow";
import type { Scenario } from "@/lib/apex-systems";
import { scenarioLabel } from "@/lib/demo-scenario";
import { defaultNote, getChange, type CaseState, type SignOff, type SupplierChange } from "@/lib/case";
import { findUser, reviewOrder, type ReviewRole } from "@/lib/users";
import { rejectionFor } from "@/lib/case-rules";
import { durableAssessment } from "./assessment";

// One durable workflow run is one supplier-change case. It holds the case until people act on it:
// the impact check, then three assessments signed off in order (Technical by the Lab Manager, Quality by
// Production & QC, Regulatory by the Regulatory Expert), then the Product Manager sends the plan. It can wait days between steps, and
// survives crashes and deploys, because its state is the event history Workflows records, not server memory.
//
// Commands arrive through a single hook with a token derived from the case ID, so any server instance
// can find the case without storing a run ID anywhere.

export type CaseCommand =
  | { type: "assess"; by: string; at: string; rulesOnly?: boolean; scenario?: Scenario }
  | { type: "sign"; role: SignOff["role"]; reviewer: string; note: string; at: string }
  | { type: "route"; by: string; to: string; at: string }
  | { type: "close"; by: string; at: string };

export const caseToken = (caseId: string) => `apex-case:${caseId}`;

// Who acts on a signed plan: Purchasing orders requalification lots, Customer Service sends the notices.
export const PLAN_RECIPIENTS = "Purchasing and Customer Service";

export async function supplierChangeCase(input: { caseId: string; scenario: Scenario }) {
  "use workflow";

  const commands = createHook<CaseCommand>({ token: caseToken(input.caseId) });
  // A second start for the same case would race the first. The token is the lock.
  const conflict = await commands.getConflict();
  if (conflict) return { dedupedTo: conflict.runId };

  const change = getChange(input.caseId);
  // A case loaded part-way through starts from the day its notice arrived, so its history reads in order.
  const opened = change.start.stage === "new" ? new Date().toISOString() : at(change.received, 0, 9);
  let state: CaseState = {
    caseId: input.caseId,
    runId: getWorkflowMetadata().workflowRunId,
    scenario: input.scenario,
    version: 1,
    assessing: false,
    assessment: null,
    signOffs: noSignOffs(),
    routed: null,
    aiRuns: { day: new Date().toISOString().slice(0, 10), count: 0 },
    progress: [],
    log: [{ at: opened, text: `Case opened${input.scenario === "normal" ? "" : ` (scenario: ${input.scenario})`}` }],
  };
  await publish(state);

  // Replay the steps this case had already taken, through exactly the same rules as live commands.
  for (const command of history(change)) {
    const note = command.type === "sign" && state.assessment ? defaultNote(command.role, state.assessment.assessment.findings, change) : "";
    state = await apply(state, command.type === "sign" ? { ...command, note } : command);
  }

  for await (const command of commands) {
    if (command.type === "close") break;
    state = await apply(state, command);
  }

  return state;
}

// One command applied to the case: checked against the rules, then recorded. Live commands and replayed
// history both come through here, so a case that starts part-way can never be in a state the rules forbid.
async function apply(state: CaseState, command: Exclude<CaseCommand, { type: "close" }>): Promise<CaseState> {
  const rejection = rejectionFor(state, command);
  if (rejection) {
    state = { ...state, version: state.version + 1, log: [...state.log, { at: command.at, text: `Rejected: ${rejection}` }] };
    await publish(state);
    return state;
  }

  if (command.type === "assess") {
    // The demo scenario is chosen when the assessment is run (the state of Apex's systems right now).
    const scenario = command.scenario ?? state.scenario;
    const switched = scenario !== state.scenario;
    state = { ...state, scenario, version: state.version + 1, assessing: true, progress: [], log: switched ? [...state.log, { at: command.at, text: `Demo scenario: ${scenarioLabel[scenario]}` }] : state.log };
    await publish(state);
    try {
      // AI runs are counted per case per day in the durable state, so the limit holds across servers and restarts.
      const today = command.at.slice(0, 10);
      const runsToday = state.aiRuns.day === today ? state.aiRuns.count : 0;
      // Each lookup is its own durable step; after each one the page gets a new snapshot with the progress so far.
      const assessment = await durableAssessment({ caseId: state.caseId, scenario: state.scenario, requestedBy: command.by, aiRunsToday: runsToday, rulesOnly: command.rulesOnly }, async item => {
        state = { ...state, version: state.version + 1, progress: [...state.progress, item] };
        await publish(state);
      });
      // A new assessment replaces the evidence the sign-offs were based on, so earlier sign-offs no longer count.
      const hadSignOffs = reviewOrder.some(review => state.signOffs[review]);
      const completedAt = command.rulesOnly ? command.at : assessment.completedAt;
      state = {
        ...state, assessing: false, assessment: { ...assessment, completedAt }, signOffs: noSignOffs(),
        aiRuns: command.rulesOnly ? state.aiRuns : { day: today, count: runsToday + (assessment.mode === "ai-gateway" ? 1 : 0) },
        log: [...state.log, { at: completedAt, text: `Impact check completed by ${assessment.mode === "ai-gateway" ? assessment.model : "policy rules"} for ${command.by}${hadSignOffs ? ". Earlier sign-offs cleared" : ""}` }],
      };
    } catch {
      state = { ...state, assessing: false, log: [...state.log, { at: command.at, text: "Impact check failed after retries: Apex systems unreachable. Try again later." }] };
    }
  }

  if (command.type === "sign") {
    const signOff: SignOff = { role: command.role, reviewer: command.reviewer, note: command.note, at: command.at };
    await recordAudit(state.caseId, { event: "sign_off", ...signOff });
    state = { ...state, signOffs: { ...state.signOffs, [command.role]: signOff }, log: [...state.log, { at: command.at, text: `${command.role} assessment signed off: ${command.reviewer}` }] };
  }

  if (command.type === "route") {
    await recordAudit(state.caseId, { event: "routed", by: command.by, to: command.to, at: command.at });
    state = { ...state, routed: { by: command.by, to: command.to, at: command.at }, log: [...state.log, { at: command.at, text: `Plan routed to ${command.to} by ${command.by}` }] };
  }

  state = { ...state, version: state.version + 1 };
  await publish(state);
  return state;
}

// ISO time a number of days after a date, at a given hour (UTC). Deterministic, so replays match.
function at(isoDate: string, days: number, hour: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

// The commands a case had already been through, for a case that starts part-way. The impact check is replayed
// with the policy rules (no model, no spend); sign-off notes are drafted from its findings.
function* history(change: SupplierChange): Generator<Exclude<CaseCommand, { type: "close" }>> {
  const { stage } = change.start;
  if (stage === "new") return;
  const name = (id: string) => findUser(id)?.name ?? id;
  const reviewer: Record<ReviewRole, string> = { Technical: change.team.lab, Quality: change.team.quality, Regulatory: change.team.regulatory };
  yield { type: "assess", by: name(change.team.lead), at: at(change.received, 1, 10), rulesOnly: true };
  // The notes need the findings, which only exist once the impact check has run; they are filled in on replay.
  const signed = stage === "review" ? (change.start.signed ?? 0) : reviewOrder.length;
  for (const [i, review] of reviewOrder.slice(0, signed).entries()) {
    yield { type: "sign", role: review, reviewer: name(reviewer[review]), note: "", at: at(change.received, 2 + i, 11 + i) };
  }
  if (stage !== "done") return;
  yield { type: "route", by: name(change.team.lead), to: PLAN_RECIPIENTS, at: at(change.received, 5, 9) };
}

const noSignOffs = (): CaseState["signOffs"] => ({ Technical: null, Quality: null, Regulatory: null });

async function publish(state: CaseState) {
  "use step";
  // Each snapshot goes to the run's durable stream. The UI reads the latest one.
  const writer = getWritable<CaseState>().getWriter();
  await writer.write(state);
  writer.releaseLock();
}

async function recordAudit(caseId: string, entry: Record<string, unknown>) {
  "use step";
  // Stand-in for Apex's audit store. In production this posts to the QMS change record over Secure Compute;
  // the step's retries make that write at-least-once, so the receiver should de-duplicate on caseId + event + at.
  console.info("apex_case_audit", JSON.stringify({ caseId, ...entry }));
}
