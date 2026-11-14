"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Scenario, SourceRecord } from "@/lib/apex-systems";
import type { AssessmentRun, CaseState, Disposition, Finding } from "@/lib/case";
import { defaultNote, displayDate, getChange, type SupplierChange } from "@/lib/case";
import type { ReviewRole, User } from "@/lib/users";

// The case page reads top to bottom in three blocks: where the case is (process), what it touches
// (impact map), and what you should do now (next step). Evidence and run detail sit in tabs below.

type View = "unassessed" | "review" | "ready" | "routed" | "blocked";
type Tab = "evidence" | "activity";
type Command = { type: "assess" } | { type: "sign"; role: ReviewRole; note: string } | { type: "route" } | { type: "scenario"; scenario: Scenario };

const statusLabel: Record<Disposition, string> = { qualified: "Qualified", requalification_required: "Re-test", unaffected: "Not affected", uncertain: "Can't decide" };
const viewLabel: Record<View, string> = { unassessed: "Not assessed", review: "In review", ready: "Ready to send", routed: "Plan sent", blocked: "Blocked" };
const scenarioLabel: Record<Scenario, string> = { normal: "All systems normal", "missing-eu-qualification": "EU record missing", "qms-outage": "Quality system down" };
// Evidence grid columns: the three systems of record.
const evSystems = ["ERP", "QMS", "Regulatory"] as const;
const evLabel: Record<(typeof evSystems)[number], string> = { ERP: "SAP", QMS: "Quality", Regulatory: "Regulatory" };
const marketTag = (market: string) => (market === "EU" ? "EU" : "US");
const shortName = (product: string) => product.replace(/ \(eu\)$/i, "").replace(/ (Protective Coating|Plastic Additive)$/i, "");
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
// Today's events show the time; older ones the date.
const stamp = (iso: string) => new Date(iso).toDateString() === new Date().toDateString() ? time(iso) : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const changeLabel: Record<SupplierChange["changeType"], string> = { FORMULATION: "Formulation change", SITE: "Site change", PACKAGING: "Packaging change" };
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

  useEffect(() => { load().catch(reason => setError(reason.message)); }, [load]);

  const send = useCallback(async (command: Command) => {
    setBusy(true); setError("");
    const before = latest.current;
    try {
      const response = await fetch(`/api/cases/${caseId}/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command) });
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
  }, [caseId, load]);

  return { state, error, busy, send };
}

export function CaseWorkspace({ caseId, user, directory }: { caseId: string; user: User; directory: User[] }) {
  const change = getChange(caseId);
  const { state, error, busy, send } = useCase(change.id);
  const [tab, setTab] = useState<Tab | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  // Each case has its own lead and reviewers.
  const byId = (id: string) => directory.find(entry => entry.id === id)!;
  const person = (role: User["role"]) => byId(role === "Quality" ? change.team.quality : role === "Regulatory Affairs" ? change.team.regulatory : change.team.lead);
  const lead = person("Product Change Lead");
  const quality = state?.signOffs.Quality ?? null;
  const regulatory = state?.signOffs["Regulatory Affairs"] ?? null;
  const run = state?.assessment ?? null;
  const findings = run?.assessment.findings ?? [];
  const uncertain = findings.filter(f => f.disposition === "uncertain");
  const retest = findings.filter(f => f.disposition === "requalification_required");
  const assessing = Boolean(state?.assessing) || (busy && !run);
  const view: View = !run ? "unassessed" : uncertain.length ? "blocked" : state?.routed ? "routed" : quality && regulatory ? "ready" : "review";
  const questions = run?.assessment.openQuestions ?? [];
  const sources = run?.sources ?? change.documents;
  const sourceById = new Map(sources.map(s => [s.id, s]));
  const selected = findings.find(f => f.finishedGood === open) ?? null;

  // 1. Where the case is: five stages, each owned by a person.
  const stagesView = [
    { label: "Notice", sub: displayDate(change.received), done: true },
    { label: "Assessment", sub: run ? (run.mode === "ai-gateway" ? "AI, checked by policy" : "Policy rules") : assessing ? "Running…" : "Not run", done: Boolean(run), person: lead },
    { label: "Quality", sub: quality ? `Signed ${stamp(quality.at)}` : person("Quality").name, done: Boolean(quality), person: person("Quality") },
    { label: "Regulatory", sub: regulatory ? `Signed ${stamp(regulatory.at)}` : uncertain.length ? "Blocked" : person("Regulatory Affairs").name, done: Boolean(regulatory), blocked: uncertain.length > 0 && !regulatory, person: person("Regulatory Affairs") },
    { label: "Plan sent", sub: state?.routed ? stamp(state.routed.at) : "To Purchasing", done: Boolean(state?.routed), person: lead },
  ];
  const current = stagesView.findIndex(s => !s.done);

  return <>
    <header className="topbar">
      <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/cases">Board</Link><span aria-hidden="true">/</span><span aria-current="page">{change.id}</span></nav>
      <label className="scenario">
        <span>Demo scenario</span>
        <select value={state?.scenario ?? "normal"} disabled={busy || !state} onChange={event => send({ type: "scenario", scenario: event.target.value as Scenario })}>
          {(Object.keys(scenarioLabel) as Scenario[]).map(key => <option key={key} value={key}>{scenarioLabel[key]}</option>)}
        </select>
      </label>
    </header>

    <main className="page cw">
      <header className="cw-head">
        <div>
          <p className="cw-meta">{change.id} | {change.supplier} | {changeLabel[change.changeType]}</p>
          <h1>{change.materialName} <span className="cw-arrow" aria-label="becomes" /> {change.becomes}</h1>
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
        {/* 2. What the change touches */}
        <section className={`cw-map is-${view}`} aria-labelledby="map-h" aria-busy={assessing}>
          <header>
            <h2 id="map-h">Impact</h2>
            {run && !assessing && <span className="cw-map-summary">{retest.length > 0 && <span className="pill pill-requalification_required">{retest.length} re-test</span>}{uncertain.length > 0 && <span className="pill pill-uncertain">{uncertain.length} can't decide</span>}<span className="pill pill-unaffected">{findings.length - retest.length - uncertain.length} not affected</span></span>}
          </header>
          {assessing ? <ol className="cw-progress" aria-label="Lookups so far">
            <li className="is-head">Checking Apex's systems, one saved step at a time</li>
            {(state?.progress ?? []).map((item, i) => <li key={i} className={item.ok ? undefined : "is-bad"}>
              <span className="cw-progress-system">{item.system === "ERP" ? "SAP" : item.system === "QMS" ? "Quality" : item.system}</span>
              <span>{item.label}</span>
              {item.ms !== undefined && <em>{item.ms} ms</em>}
            </li>)}
          </ol> : <div className="cw-tree">
            <div className="cw-root"><span>Raw material</span><strong>{change.materialName}</strong><small>{change.material}</small></div>
            <ul className="cw-branches">
              {run ? findings.map(f => <li key={f.finishedGood}>
                <button className={`cw-node is-${f.disposition}`} onClick={() => setOpen(f.finishedGood)} aria-label={`${f.product}, ${statusLabel[f.disposition]}. Open details`}>
                  <span className="cw-node-name">{shortName(f.product)} <em>{marketTag(f.market)}</em></span>
                  <span className={`pill pill-${f.disposition}`}>{statusLabel[f.disposition]}</span>
                  <span className="cw-node-notice">{f.disposition === "unaffected" || f.noticeDays === 0 ? "No notice" : f.noticeDays ? `${f.noticeDays}-day notice` : "Notice unknown"}</span>
                </button>
              </li>) : change.candidates.map(id => <li key={id}><div className="cw-node is-pending"><span className="cw-node-name">{id}</span><span className="pill">Not checked</span><span className="cw-node-notice">Flagged by Purchasing</span></div></li>)}
            </ul>
          </div>}
          {run && !assessing && <p className="cw-map-foot">{run.mode === "ai-gateway" ? "AI, checked by policy" : "Policy rules"} | {(run.latencyMs / 1000).toFixed(1)} s{run.costUsd ? ` | $${run.costUsd.toFixed(4)}` : ""}{run.corrections.length ? ` | ${run.corrections.length} AI corrections` : ""}<button className="btn-text" onClick={() => send({ type: "assess" })} disabled={busy || Boolean(state?.routed)}>Run again</button></p>}
        </section>

        {/* 3. What to do now */}
        <NextStep change={change} view={view} state={state} user={user} lead={lead} person={person} questions={questions} busy={busy} assessing={assessing}
          onAssess={() => send({ type: "assess" })} onRoute={() => send({ type: "route" })} onSign={(role, note) => send({ type: "sign", role, note })} />
      </div>

      <nav className="cw-tabs" role="tablist" aria-label="More detail">
        {(["evidence", "activity"] as Tab[]).map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(tab === t ? null : t)}>
          {t === "evidence" ? "Evidence" : "Activity"}
        </button>)}
      </nav>

      {/* Evidence at a glance: one row per product, one column per Apex system, the records that back each answer. */}
      {tab === "evidence" && <div className="cw-evidence" role="tabpanel">
        {!run ? <p className="cw-empty">Apex records appear here once the assessment reads them.</p> : <>
          <div className="ev-grid" role="table" aria-label="Records behind each product">
            <div className="ev-row is-head" role="row"><span role="columnheader">Product</span>{evSystems.map(sys => <span key={sys} role="columnheader">{evLabel[sys]}</span>)}</div>
            {findings.map(f => <div key={f.finishedGood} className="ev-row" role="row">
              <button className="ev-product" role="rowheader" onClick={() => setOpen(f.finishedGood)} title="Open details">
                <strong>{shortName(f.product)}</strong><em>{marketTag(f.market)}</em><i className={`ev-dot is-${f.disposition}`} aria-label={statusLabel[f.disposition]} />
              </button>
              {evSystems.map(sys => {
                const ids = f.evidenceIds.filter(id => sourceById.get(id)?.system === sys);
                const missing = sys === "QMS" && f.disposition === "uncertain" && ids.length === 0;
                return <span key={sys} role="cell" className="ev-cell">
                  {ids.map(id => { const rec = sourceById.get(id)!; return <code key={id} className="ev-chip" title={`${rec.title.split(" | ")[1] ?? rec.title}: ${rec.detail}`}>{id}</code>; })}
                  {missing && <span className="ev-chip is-gap" title={f.rationale}>Missing</span>}
                  {ids.length === 0 && !missing && <span className="ev-none" aria-label="None">–</span>}
                </span>;
              })}
            </div>)}
          </div>
          <p className="ev-foot">Hover a record for what it says; click a product for the full reasoning.</p>
        </>}
      </div>}

      {/* Activity at a glance: the run in four numbers, each lookup on a timeline, and the case history. */}
      {tab === "activity" && state && <div className="cw-activity" role="tabpanel">
        {run ? <>
          <div className="act-stats">
            <div><span>Answered by</span><strong>{run.mode === "ai-gateway" ? run.model.split("/").pop() : "Policy rules"}</strong></div>
            <div><span>Time</span><strong>{(run.latencyMs / 1000).toFixed(1)} s</strong></div>
            <div><span>Cost</span><strong>{run.costUsd ? `$${run.costUsd.toFixed(4)}` : "–"}</strong></div>
            <div><span>Fixed by policy</span><strong>{run.mode === "ai-gateway" ? run.corrections.length : "–"}</strong></div>
          </div>
          <section className="cw-card act-calls">
            <h3 className="cw-label">Lookups in Apex's systems</h3>
            <CallTimeline calls={run.calls} />
          </section>
        </> : <p className="cw-empty">Not assessed yet.</p>}
        <section className="cw-card act-history">
          <h3 className="cw-label">History</h3>
          <ol>{state.log.slice(-6).reverse().map((entry, i) => <li key={i}><time>{stamp(entry.at)}</time><span>{entry.text}</span></li>)}</ol>
        </section>
        {run?.mode === "ai-gateway" && run.corrections.length > 0 && <details className="act-fixes">
          <summary>What the policy check corrected</summary>
          <ul>{run.corrections.map(c => <li key={c}>{c}</li>)}</ul>
        </details>}
        <p className="act-run">Workflow run <code>{state.runId}</code></p>
      </div>}
    </main>

    {selected && <ProductPanel finding={selected} sourceById={sourceById} onClose={() => setOpen(null)} />}
  </>;
}

// One card that tells the signed-in person exactly what to do, or who the case is waiting for.
function NextStep({ change, view, state, user, lead, person, questions, busy, assessing, onAssess, onRoute, onSign }: {
  change: SupplierChange; view: View; state: CaseState | null; user: User; lead: User; person: (role: User["role"]) => User;
  questions: { finishedGood: string; owner: string; detail: string }[]; busy: boolean; assessing: boolean;
  onAssess: () => void; onRoute: () => void; onSign: (role: ReviewRole, note: string) => void;
}) {
  const [note, setNote] = useState("");
  const quality = state?.signOffs.Quality ?? null;
  const regulatory = state?.signOffs["Regulatory Affairs"] ?? null;

  // Who the case is waiting for, and what they do.
  let owner: User = lead;
  let task = "";
  let action: React.ReactNode = null;
  let signRole: ReviewRole | null = null;

  if (!state) task = "Opening the case…";
  else if (assessing) { owner = lead; task = "The assessment is checking Apex's systems."; }
  else if (view === "unassessed") { owner = lead; task = "Run the assessment to see which products and markets the change affects."; action = <button className="btn btn-primary" onClick={onAssess} disabled={busy}>Run assessment</button>; }
  else if (view === "blocked") { owner = person(questions[0]?.owner === "Quality" ? "Quality" : "Regulatory Affairs"); task = questions[0]?.detail ?? "Resolve the missing record."; }
  else if (view === "review") { signRole = !quality ? "Quality" : !regulatory ? "Regulatory Affairs" : null; owner = signRole ? person(signRole) : lead; task = signRole === "Quality" ? "Confirm the technical scope: which products need re-testing." : "Confirm the customer notices for each market."; }
  else if (view === "ready") { owner = lead; task = "Both signed. Send the requalification and customer-notice plan to Purchasing and Customer Service."; action = <button className="btn btn-primary" onClick={onRoute} disabled={busy}>Send the plan</button>; }
  else { owner = lead; task = `Plan sent to Purchasing and Customer Service ${state.routed ? stamp(state.routed.at) : ""}. ${lead.name.split(" ")[0]} follows up on requalification and notices.`; }

  const isMe = owner.id === user.id;
  const suggested = signRole ? defaultNote(signRole, state?.assessment?.assessment.findings ?? [], change) : "";
  if (signRole && isMe) {
    action = <div className="cw-sign">
      <label htmlFor="sign-note" className="visually-hidden">Decision note</label>
      <textarea id="sign-note" rows={3} value={note || suggested} onChange={event => setNote(event.target.value)} />
      <button className="btn btn-primary" onClick={() => onSign(signRole!, note || suggested)} disabled={busy}>{busy ? "Recording…" : `Sign off as ${signRole}`}</button>
    </div>;
  } else if (!isMe) {
    // Not your turn: no action here (switch people from the account menu). Show what happened lately instead.
    action = null;
  }

  return <aside className={`cw-next is-${view}`} aria-labelledby="next-h">
    <h2 id="next-h">{isMe ? "Your next step" : `Waiting for ${owner.name.split(" ")[0]}`}</h2>
    <div className="cw-next-who">
      <span className={`avatar tone-${owner.id}`} aria-hidden="true">{owner.initials}</span>
      <span><strong>{owner.name}</strong><span>{owner.role}</span></span>
    </div>
    <p className="cw-next-task">{task}</p>
    {action}
    {questions.length > 1 && <ul className="cw-next-more">{questions.slice(1).map(q => <li key={`${q.finishedGood}-${q.owner}`}><strong>{q.owner}:</strong> {q.detail}</li>)}</ul>}
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
