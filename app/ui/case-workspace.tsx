"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SourceRecord } from "@/lib/apex-systems";
import type { AssessmentRun, CaseState, Disposition, Finding } from "@/lib/case";
import { defaultNote, displayDate, getChange, type SupplierChange } from "@/lib/case";
import { reviewOrder, type ReviewRole, type User } from "@/lib/users";
import { askMango, HelperAvatar } from "@/app/ui/assistant";
import { whatMaterialDoes, whatProductIs } from "@/lib/catalogue";
import { DemoScenario, useDemoScenario } from "@/app/ui/demo-scenario";
import { scenarioLabel } from "@/lib/demo-scenario";

// The case page reads top to bottom in three blocks: where the case is (process), which final products the
// raw-material change touches (impact check), and what you should do now (next step).

type View = "unassessed" | "review" | "ready" | "routed" | "blocked";
type Command = { type: "assess" } | { type: "sign"; role: ReviewRole; note: string } | { type: "route" };

const statusLabel: Record<Disposition, string> = { qualified: "Qualified", requalification_required: "Re-test", unaffected: "Not affected", uncertain: "Can't decide" };
const viewLabel: Record<View, string> = { unassessed: "Not assessed", review: "In review", ready: "Ready to send", routed: "Plan sent", blocked: "Blocked" };
// Evidence grid columns: the three systems of record.
const evSystems = ["ERP", "QMS", "Regulatory"] as const;
const evLabel: Record<(typeof evSystems)[number], string> = { ERP: "SAP", QMS: "Veeva", Regulatory: "Regulatory" };
const marketTag = (market: string) => (market === "EU" ? "EU" : "US");
const shortName = (product: string) => product.replace(/ \(eu\)$/i, "").replace(/ (Protective Coating|Plastic Additive)$/i, "");
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
// Today's events show the time; older ones the date.
const stamp = (iso: string) => new Date(iso).toDateString() === new Date().toDateString() ? time(iso) : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const changeLabel: Record<SupplierChange["changeType"], string> = { FORMULATION: "Formulation change", SITE: "Site change", PACKAGING: "Packaging change" };
// What each expert approves. Approving means agreeing the plan (which tests, which trial, which notices),
// not finishing the work: the lab tests and production trial still take as long as they take.
const approveLabel: Record<ReviewRole, string> = { Technical: "Approve the test plan", Quality: "Approve the trial plan", Regulatory: "Approve the notice plan" };
// What each expert does in their assessment, in plain words.
const reviewTask: Record<ReviewRole, string> = {
  Technical: "Technical assessment: plan the lab-scale performance tests for the final products marked Re-test.",
  Quality: "Quality assessment: plan the production trial and the QC tests that check its outcome.",
  Regulatory: "Regulatory assessment: confirm compliance and the customer notices for each market.",
};
const daysUntil = (date: string) => Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000));

// The case lives in a durable workflow on the server. This hook reads its latest snapshot and, after each
// action, polls until the workflow has published a newer version.
function useCase(caseId: string) {
  const [state, setState] = useState<CaseState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const latest = useRef<CaseState | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/cases/${caseId}`, { cache: "no-store" });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "The case could not be loaded.");
    const next: CaseState = await response.json();
    latest.current = next;
    setState(next);
    return next;
  }, [caseId]);

  // Keep the page current. Until the first snapshot arrives (a case may still be starting), retry quietly
  // every 2 s; after that, refresh every 15 s so a sign-off by someone else appears without a reload.
  useEffect(() => {
    let failures = 0;
    const tick = () => load().then(() => { failures = 0; setError(""); }).catch(reason => { if (++failures >= 8) setError(reason.message); });
    tick();
    const retry = setInterval(() => { if (!latest.current) tick(); }, 2000);
    const refresh = setInterval(() => { if (latest.current && !document.hidden) tick(); }, 15000);
    return () => { clearInterval(retry); clearInterval(refresh); };
  }, [load]);

  const send = useCallback(async (command: Command) => {
    setBusy(true); setError("");
    const before = state;
    try {
      const response = await fetch(`/api/cases/${caseId}/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...command, runId: before?.runId, version: before?.version }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "That action didn't go through. Try again.");
      for (let i = 0; i < 180; i++) {
        await new Promise(resolve => setTimeout(resolve, i < 10 ? 300 : 700));
        const next = await load();
        const moved = !before || next.runId !== before.runId || next.version > before.version;
        if (moved && !next.assessing) {
          const last = next.log.at(-1)?.text ?? "";
          if (last.startsWith("Rejected: ")) setError(`Not accepted: ${last.slice(10)}.`);
          break;
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That action didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  }, [caseId, load, state]);

  return { state, error, busy, send };
}

export function CaseWorkspace({ caseId, user, directory }: { caseId: string; user: User; directory: User[] }) {
  const change = getChange(caseId);
  const { state, error, busy, send } = useCase(change.id);
  const [open, setOpen] = useState<string | null>(null);
  const [demoScenario] = useDemoScenario();

  // Each case has its own Product Manager and reviewers.
  const byId = (id: string) => directory.find(entry => entry.id === id)!;
  const person = (who: ReviewRole | "Product Manager") => byId(who === "Technical" ? change.team.lab : who === "Quality" ? change.team.quality : who === "Regulatory" ? change.team.regulatory : change.team.lead);
  const lead = person("Product Manager");
  const signOffs = state?.signOffs;
  const allSigned = reviewOrder.every(review => signOffs?.[review]);
  const run = state?.assessment ?? null;
  const findings = run?.assessment.findings ?? [];
  const uncertain = findings.filter(f => f.disposition === "uncertain");
  const retest = findings.filter(f => f.disposition === "requalification_required");
  const qualified = findings.filter(f => f.disposition === "qualified");
  const unaffected = findings.filter(f => f.disposition === "unaffected");
  const assessing = Boolean(state?.assessing) || (busy && !run);
  const view: View = !run ? "unassessed" : uncertain.length ? "blocked" : state?.routed ? "routed" : allSigned ? "ready" : "review";
  const questions = run?.assessment.openQuestions ?? [];
  const sources = run?.sources ?? change.documents;
  const sourceById = new Map(sources.map(s => [s.id, s]));
  const selected = findings.find(f => f.finishedGood === open) ?? null;

  // 1. Where the case is: six stages, each owned by a person. The three assessments are signed in order.
  const stagesView: { label: string; sub: string; done: boolean; blocked?: boolean; person?: User }[] = [
    { label: "Notice", sub: displayDate(change.received), done: true },
    { label: "Impact check", sub: run ? (run.mode === "ai-gateway" ? "AI, checked by policy" : "Policy rules") : assessing ? "Running…" : "Not run", done: Boolean(run), person: lead },
    ...reviewOrder.map(review => {
      const signed = signOffs?.[review];
      const blocked = review === "Regulatory" && uncertain.length > 0 && !signed;
      return { label: review, sub: signed ? `Signed ${stamp(signed.at)}` : blocked ? "Blocked" : person(review).name, done: Boolean(signed), blocked, person: person(review) };
    }),
    { label: "Plan sent", sub: state?.routed ? stamp(state.routed.at) : "To Purchasing", done: Boolean(state?.routed), person: lead },
  ];
  const current = stagesView.findIndex(s => !s.done);

  return <>
    <header className="topbar">
      <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/cases">Board</Link><span aria-hidden="true">/</span><span aria-current="page">{change.id}</span></nav>
      <DemoScenario />
    </header>

    <main className="page cw">
      <header className="cw-head">
        <div>
          <p className="cw-meta">{change.id} | Raw material from {change.supplier} | {changeLabel[change.changeType]}</p>
          <h1>{change.materialName} <span className="cw-arrow" aria-label="becomes" /> {change.becomes}</h1>
          {whatMaterialDoes(change.material) && <p className="cw-plain"><strong>Raw material:</strong> {whatMaterialDoes(change.material)}. {change.change}</p>}
        </div>
        <div className="cw-head-side">
          {!state?.routed && <span className="cw-days"><strong>{daysUntil(change.deadline)}</strong> days until the change</span>}
          <span className={`pill pill-${view}`}>{viewLabel[view]}</span>
        </div>
      </header>

      <ol className="cw-process" aria-label="Case progress">
        {stagesView.map((stage, i) => <li key={stage.label} className={stage.done ? "is-done" : stage.blocked ? "is-blocked" : i === current ? "is-current" : undefined}>
          {stage.person
            ? <span className={`avatar small tone-${stage.person.id}`} aria-hidden="true">{stage.person.initials}</span>
            : <span className="avatar small tone-supplier" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 16 16"><path d="M3.5 2.5h6l3 3v8h-9z M9.5 2.5v3h3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg></span>}
          <span className="cw-process-text"><strong>{stage.label}</strong><span>{stage.sub}</span></span>
          {stage.done && <span className="cw-process-check" aria-label="Done"><svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="m2 5.2 2 2L8 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>}
        </li>)}
      </ol>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="cw-grid">
        {/* 2. The impact check: every final product the raw-material change could touch, its status, notice and records. */}
        <section className={`cw-assess is-${view}`} aria-labelledby="assess-h" aria-busy={assessing}>
          <header>
            <h2 id="assess-h">Impact check</h2>
            {run && !assessing && <span className="cw-map-summary">
              {retest.length > 0 && <span className="pill pill-requalification_required">{retest.length} re-test</span>}
              {qualified.length > 0 && <span className="pill pill-qualified">{qualified.length} still qualified</span>}
              {uncertain.length > 0 && <span className="pill pill-uncertain">{uncertain.length} can't decide</span>}
              {unaffected.length > 0 && <span className="pill pill-unaffected">{unaffected.length} not affected</span>}
            </span>}
          </header>

          {assessing ? <ol className="cw-progress" aria-label="Lookups so far">
            <li className="is-head">Checking Apex's systems, one saved step at a time</li>
            {(state?.progress ?? []).map((item, i) => <li key={i} className={item.ok ? undefined : "is-bad"}>
              <span className="cw-progress-system">{item.system === "ERP" ? "SAP" : item.system === "QMS" ? "Veeva" : item.system}</span>
              <span>{item.label}</span>
              {item.ms !== undefined && <em>{item.ms} ms</em>}
            </li>)}
          </ol> : <div className="as-table" role="table" aria-label="Final products the change could touch">
            <div className="as-row is-head" role="row"><span role="columnheader">Final product</span><span role="columnheader">Status</span><span role="columnheader">Notice</span><span role="columnheader">Records</span></div>
            {run ? findings.map(f => <button key={f.finishedGood} className={`as-row is-${f.disposition}`} role="row" onClick={() => setOpen(f.finishedGood)} title="Open the reasoning">
              <span role="cell" className="as-product"><span className="as-name"><span><strong>{shortName(f.product)}</strong><em>{marketTag(f.market)}</em></span>{whatProductIs(f.finishedGood) && <small>{whatProductIs(f.finishedGood)}</small>}</span></span>
              <span role="cell"><span className={`pill pill-${f.disposition}`}>{statusLabel[f.disposition]}</span></span>
              <span role="cell" className="as-notice">{f.disposition === "unaffected" || f.noticeDays === 0 ? "None" : f.noticeDays ? `${f.noticeDays} days` : "Unknown"}</span>
              <span role="cell" className="as-records">
                {f.evidenceIds.map(id => { const rec = sourceById.get(id); return <code key={id} className={`ev-chip is-${rec?.system === "Supplier notice" ? "SUP" : rec?.system ?? "SUP"}`} title={rec ? `${rec.title.split(" | ")[1] ?? rec.title}: ${rec.detail}` : id}>{id}</code>; })}
                {f.disposition === "uncertain" && <span className="ev-chip is-gap">Missing</span>}
              </span>
            </button>) : change.candidates.map(id => <div key={id} className="as-row is-pending" role="row">
              <span role="cell" className="as-product"><span className="as-name"><span><strong>{id}</strong></span>{whatProductIs(id) && <small>{whatProductIs(id)}</small>}</span></span>
              <span role="cell"><span className="pill">Not checked</span></span>
              <span role="cell" className="as-notice">–</span>
              <span role="cell" className="as-records"><span className="ev-none">Flagged by Purchasing</span></span>
            </div>)}
          </div>}

          {/* The demo scenario changed since this result: say so, and that running again uses it. */}
          {run && !assessing && state && state.scenario !== demoScenario && <p className="as-stale">
            This result is from <strong>{scenarioLabel[state.scenario]}</strong>. Run again to use <strong>{scenarioLabel[demoScenario]}</strong>.
          </p>}

          {/* How it was checked: one line, details on demand. */}
          {run && !assessing && <details className="as-how">
            <summary>
              <span>{run.mode === "ai-gateway" ? "AI, checked by policy" : "Policy rules"}</span>
              <span>{(run.latencyMs / 1000).toFixed(1)} s</span>
              {run.costUsd ? <span>${run.costUsd.toFixed(4)}</span> : null}
              {run.mode === "ai-gateway" && <span>{run.corrections.length} fixed by policy</span>}
              {user.id === lead.id && <button className="btn-text" onClick={event => { event.preventDefault(); send({ type: "assess" }); }} disabled={busy} title={state?.routed ? "Reopens the case: the sent plan is withdrawn and everyone signs again" : undefined}>{state?.routed ? "Reopen and check again" : "Run again"}</button>}
            </summary>
            <div className="as-how-body">
              <div><h3 className="cw-label">Lookups in Apex's systems</h3><CallTimeline calls={run.calls} /></div>
              {run.mode === "ai-gateway" && run.corrections.length > 0 && <div><h3 className="cw-label">What the policy check corrected</h3><ul className="as-fixes">{run.corrections.map(c => <li key={c}>{c}</li>)}</ul></div>}
              {state && <div><h3 className="cw-label">History</h3><ol className="as-history">{state.log.slice(-6).reverse().map((entry, i) => <li key={i}><time>{stamp(entry.at)}</time><span>{entry.text}</span></li>)}</ol></div>}
              <p className="act-run">Model {run.model} | Workflow run <code>{state?.runId}</code></p>
            </div>
          </details>}
        </section>

        {/* 3. What to do now */}
        <NextStep key={`${user.id}:${run?.completedAt ?? "pending"}`} change={change} view={view} state={state} user={user} lead={lead} person={person} questions={questions} busy={busy} assessing={assessing}
          onAssess={() => send({ type: "assess" })} onRoute={() => send({ type: "route" })} onSign={(role, note) => send({ type: "sign", role, note })} />
      </div>
    </main>

    {selected && <ProductPanel finding={selected} sourceById={sourceById} onClose={() => setOpen(null)} />}
  </>;
}

// One card that tells the signed-in person exactly what to do, or who the case is waiting for.
function NextStep({ change, view, state, user, lead, person, questions, busy, assessing, onAssess, onRoute, onSign }: {
  change: SupplierChange; view: View; state: CaseState | null; user: User; lead: User; person: (who: ReviewRole | "Product Manager") => User;
  questions: { finishedGood: string; owner: ReviewRole | "Product Manager"; detail: string }[]; busy: boolean; assessing: boolean;
  onAssess: () => void; onRoute: () => void; onSign: (role: ReviewRole, note: string) => void;
}) {
  const [note, setNote] = useState("");

  // Who the case is waiting for, and what they do.
  let owner: User = lead;
  let task = "";
  let action: React.ReactNode = null;
  let signRole: ReviewRole | null = null;

  if (!state) task = "Opening the case…";
  else if (assessing) { owner = lead; task = "The impact check is reading Apex's systems."; }
  else if (view === "unassessed") { owner = lead; task = "Run the impact check to see which final products and markets use this raw material."; action = <button className="btn btn-primary" onClick={onAssess} disabled={busy}>Run impact check</button>; }
  else if (view === "blocked") { owner = person(questions[0]?.owner ?? "Regulatory"); task = questions[0]?.detail ?? "Resolve the missing record."; }
  else if (view === "review") { signRole = reviewOrder.find(review => !state.signOffs[review]) ?? null; owner = signRole ? person(signRole) : lead; task = signRole ? reviewTask[signRole] : ""; }
  else if (view === "ready") { owner = lead; task = "All three plans are approved. Send the testing and customer-notice plan to Purchasing and Customer Service."; action = <button className="btn btn-primary" onClick={onRoute} disabled={busy}>Send the plan</button>; }
  else { owner = lead; task = `Plan sent to Purchasing and Customer Service ${state.routed ? stamp(state.routed.at) : ""}. ${lead.name.split(" ")[0]} follows up on testing and notices.`; }

  const isMe = owner.id === user.id;
  const suggested = signRole ? defaultNote(signRole, state?.assessment?.assessment.findings ?? [], change) : "";
  if (signRole && isMe) {
    action = <div className="cw-sign">
      <label htmlFor="sign-note" className="visually-hidden">Plan note</label>
      <textarea id="sign-note" rows={3} value={note || suggested} onChange={event => setNote(event.target.value)} />
      <button className="btn btn-primary" onClick={() => onSign(signRole!, note || suggested)} disabled={busy}>{busy ? "Recording…" : approveLabel[signRole]}</button>
    </div>;
  } else if (!isMe) {
    // Not your turn: no action here (switch people from the account menu). Show what happened lately instead.
    action = null;
  }

  return <aside className={`cw-next is-${view}`} aria-labelledby="next-h">
    <h2 id="next-h">{isMe ? "Your next step" : `Waiting for ${owner.name.split(" ")[0]}`}</h2>
    <div className="cw-next-who">
      <span className={`avatar tone-${owner.id}`} aria-hidden="true">{owner.initials}</span>
      <span><strong>{owner.name}</strong><span>{owner.title}</span></span>
    </div>
    <p className="cw-next-task">{task}</p>
    {action}
    {questions.length > 1 && <ul className="cw-next-more">{questions.slice(1).map(q => <li key={`${q.finishedGood}-${q.owner}`}><strong>{person(q.owner).name.split(" ")[0]}:</strong> {q.detail}</li>)}</ul>}
    {/* Not your turn: Mango can nudge the person, or explain the hold-up, in one click. */}
    {!isMe && state && !state.routed && <div className="cw-mango">
      <span className="cw-mango-label"><HelperAvatar size={24} />Ask Mango</span>
      <div className="cw-mango-actions">
        <button onClick={() => askMango(`Draft a friendly check-in to ${owner.name} about ${change.materialName} (${change.id}). What they need to do: ${task}`)}>Nudge {owner.name.split(" ")[0]}</button>
        <button onClick={() => askMango(`What is holding up ${change.materialName} (${change.id}), and what would move it forward?`)}>What's the hold-up?</button>
        {view === "blocked" && <button onClick={() => askMango(`On ${change.materialName} (${change.id}) a record is missing. Who should recover it? Draft a short message to them.`)}>Chase the missing record</button>}
      </div>
    </div>}
    {!isMe && state && <div className="cw-latest">
      <h3 className="cw-label">Latest</h3>
      <ol>{state.log.slice(-3).reverse().map((entry, i) => <li key={i}><time>{stamp(entry.at)}</time><span>{entry.text}</span></li>)}</ol>
    </div>}
  </aside>;
}

function ProductPanel({ finding: f, sourceById, onClose }: { finding: Finding; sourceById: Map<string, SourceRecord>; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <div className="cw-panel-backdrop" onClick={onClose}>
    <aside className="cw-panel" role="dialog" aria-modal="true" aria-labelledby="panel-h" onClick={event => event.stopPropagation()}>
      <header>
        <div><p className="cw-meta">{f.finishedGood} | {marketTag(f.market)}</p><h2 id="panel-h">{shortName(f.product)}</h2></div>
        <button className="cw-close" onClick={onClose} aria-label="Close">×</button>
      </header>
      {whatProductIs(f.finishedGood) && <p className="cw-plain">Final product: {whatProductIs(f.finishedGood)}.</p>}
      <span className={`pill pill-${f.disposition}`}>{statusLabel[f.disposition]}</span>
      <p className="cw-panel-why">{f.rationale}</p>
      {f.noticeDays && f.disposition !== "unaffected" ? <p className="cw-panel-notice"><strong>{f.noticeDays} days</strong> customer notice before the change</p> : null}
      <h3 className="cw-label">Sources</h3>
      <ul className="cw-panel-sources">
        {f.evidenceIds.map(id => { const s = sourceById.get(id); return <li key={id}><code>{id}</code><div><strong>{s ? s.title.split(" | ")[1] ?? s.title : "Record"}</strong>{s && <p>{s.system === "Supplier notice" ? "Supplier document" : s.system} | {s.detail}</p>}</div></li>; })}
      </ul>
    </aside>
  </div>;
}

// Each lookup as a block on one timeline, in the order the workflow made them, one lane per system.
// Width is how long the call took. A failed call is red. Hover for the endpoint and status.
function CallTimeline({ calls }: { calls: AssessmentRun["calls"] }) {
  const total = Math.max(1, calls.reduce((n, c) => n + c.ms, 0));
  let offset = 0;
  const placed = calls.map(call => { const at = offset; offset += call.ms; return { ...call, at }; });
  return <div className="act-lanes">
    {evSystems.map(sys => <div key={sys} className="act-lane">
      <span className="act-lane-name">{evLabel[sys]}</span>
      <div className="act-track">
        {placed.filter(c => c.system === sys).map((c, i) => <i key={i} className={`act-call is-${sys} ${c.status >= 400 ? "is-error" : ""}`}
          style={{ left: `${(c.at / total) * 100}%`, width: `max(4px, ${(c.ms / total) * 100}%)` }}
          title={`${c.endpoint.split("?")[0]} | ${c.status} | ${c.ms} ms`} />)}
      </div>
    </div>)}
    <div className="act-axis"><span>0</span><span>{total} ms of lookups</span></div>
  </div>;
}
