"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { switchAccount } from "@/app/actions";
import type { Scenario, SourceRecord } from "@/lib/apex-systems";
import type { CaseState, Disposition, Finding } from "@/lib/case";
import { supplierChange, supplierDocuments } from "@/lib/case";
import type { ReviewRole, User } from "@/lib/users";

// The case page reads top to bottom in three blocks: where the case is (process), what it touches
// (impact map), and what you should do now (next step). Evidence and run detail sit in tabs below.

type View = "unassessed" | "review" | "ready" | "routed" | "blocked";
type Tab = "evidence" | "activity";
type Command = { type: "assess" } | { type: "sign"; role: ReviewRole; note: string } | { type: "route" } | { type: "scenario"; scenario: Scenario };

const statusLabel: Record<Disposition, string> = { qualified: "Qualified", requalification_required: "Re-test", unaffected: "Not affected", uncertain: "Can't decide" };
const viewLabel: Record<View, string> = { unassessed: "Not assessed", review: "In review", ready: "Ready to send", routed: "Plan sent", blocked: "Blocked" };
const scenarioLabel: Record<Scenario, string> = { normal: "All systems normal", "missing-eu-qualification": "EU record missing", "qms-outage": "Quality system down" };
const defaultNotes: Record<ReviewRole, string> = {
  Quality: "Requalification required for AeroShield 420 before X-17R is used.",
  "Regulatory Affairs": "Customer notices: 90 days EMEA (REG-EU-07), 60 days US (REG-US-02).",
};
const systemOrder: SourceRecord["system"][] = ["ERP", "QMS", "Regulatory", "Supplier notice"];
const systemLabel: Record<SourceRecord["system"], string> = { ERP: "SAP (ERP)", QMS: "Quality system", Regulatory: "Regulatory rules", "Supplier notice": "Supplier documents" };
const marketTag = (market: string) => (market === "EU" ? "EU" : "US");
const shortName = (product: string) => product.replace(/ \(eu\)$/i, "").replace(/ (Protective Coating|Plastic Additive)$/i, "");
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
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

export function CaseWorkspace({ user, directory }: { user: User; directory: User[] }) {
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const { state, error, busy, send } = useCase(supplierChange.id);
  const [tab, setTab] = useState<Tab | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const person = (role: User["role"]) => directory.find(entry => entry.role === role)!;
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
  const sources = run?.sources ?? supplierDocuments;
  const sourceById = new Map(sources.map(s => [s.id, s]));
  const selected = findings.find(f => f.finishedGood === open) ?? null;
  const switchTo = (target: User) => startSwitch(async () => { await switchAccount(target.id); router.refresh(); });

  // 1. Where the case is: five stages, each owned by a person.
  const stagesView = [
    { label: "Notice", sub: supplierChange.received, done: true },
    { label: "Assessment", sub: run ? (run.mode === "ai-gateway" ? "AI, checked by policy" : "Policy rules") : assessing ? "Running…" : "Not run", done: Boolean(run), person: lead },
    { label: "Quality", sub: quality ? `Signed ${time(quality.at)}` : person("Quality").name, done: Boolean(quality), person: person("Quality") },
    { label: "Regulatory", sub: regulatory ? `Signed ${time(regulatory.at)}` : uncertain.length ? "Blocked" : person("Regulatory Affairs").name, done: Boolean(regulatory), blocked: uncertain.length > 0 && !regulatory, person: person("Regulatory Affairs") },
    { label: "Plan sent", sub: state?.routed ? time(state.routed.at) : `To ${lead.name.split(" ")[0]}`, done: Boolean(state?.routed), person: lead },
  ];
  const current = stagesView.findIndex(s => !s.done);

  return <>
    <header className="topbar">
      <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/cases">Board</Link><span aria-hidden="true">/</span><span aria-current="page">{supplierChange.id}</span></nav>
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
          <p className="cw-meta">{supplierChange.id} · {supplierChange.supplier}</p>
          <h1>Binder X-17 <span className="cw-arrow" aria-label="replaced by" /> X-17R</h1>
        </div>
        <div className="cw-head-side">
          <span className="cw-days"><strong>{daysUntil(supplierChange.deadline)}</strong> days until supply ends</span>
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
            <div className="cw-root"><span>Raw material</span><strong>Binder X-17</strong><small>{supplierChange.material}</small></div>
            <ul className="cw-branches">
              {run ? findings.map(f => <li key={f.finishedGood}>
                <button className={`cw-node is-${f.disposition}`} onClick={() => setOpen(f.finishedGood)} aria-label={`${f.product}, ${statusLabel[f.disposition]}. Open details`}>
                  <span className="cw-node-name">{shortName(f.product)} <em>{marketTag(f.market)}</em></span>
                  <span className={`pill pill-${f.disposition}`}>{statusLabel[f.disposition]}</span>
                  <span className="cw-node-notice">{f.disposition === "unaffected" ? "No notice" : f.noticeDays ? `${f.noticeDays}-day notice` : "Notice unknown"}</span>
                </button>
              </li>) : supplierChange.candidates.map(id => <li key={id}><div className="cw-node is-pending"><span className="cw-node-name">{id}</span><span className="pill">Not checked</span><span className="cw-node-notice">Flagged by Purchasing</span></div></li>)}
            </ul>
          </div>}
          {run && !assessing && <p className="cw-map-foot">{run.mode === "ai-gateway" ? "AI, checked by policy" : "Policy rules"} · {(run.latencyMs / 1000).toFixed(1)} s{run.costUsd ? ` · $${run.costUsd.toFixed(4)}` : ""}{run.corrections.length ? ` · ${run.corrections.length} AI corrections` : ""}<button className="btn-text" onClick={() => send({ type: "assess" })} disabled={busy || Boolean(state?.routed)}>Run again</button></p>}
        </section>

        {/* 3. What to do now */}
        <NextStep view={view} state={state} user={user} lead={lead} person={person} questions={questions} busy={busy} switching={switching} assessing={assessing}
          onAssess={() => send({ type: "assess" })} onRoute={() => send({ type: "route" })} onSign={(role, note) => send({ type: "sign", role, note })} onSwitch={switchTo} />
      </div>

      <nav className="cw-tabs" role="tablist" aria-label="More detail">
        {(["evidence", "activity"] as Tab[]).map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(tab === t ? null : t)}>
          {t === "evidence" ? `Evidence${run ? ` · ${sources.length}` : ""}` : `Activity${run ? ` · ${run.calls.length} lookups` : ""}`}
        </button>)}
      </nav>

      {tab === "evidence" && <div className="cw-evidence" role="tabpanel">
        {!run && <p className="cw-empty">Apex records appear here once the assessment reads them.</p>}
        {systemOrder.map(system => {
          const items = sources.filter(s => s.system === system);
          const gaps = system === "QMS" ? uncertain : [];
          if (!items.length && !gaps.length) return null;
          return <section key={system} className="cw-system">
            <h3 className="cw-label">{systemLabel[system]}</h3>
            <ul>
              {items.map(s => <li key={s.id}><code>{s.id}</code><div><strong>{s.title.split(" | ")[1] ?? s.title}</strong><p>{s.detail}</p></div></li>)}
              {gaps.map(f => <li key={`gap-${f.finishedGood}`} className="is-gap"><code>{f.finishedGood}</code><div><strong>No qualification record returned</strong><p>{f.rationale}</p></div></li>)}
            </ul>
          </section>;
        })}
      </div>}

      {tab === "activity" && state && <div className="cw-activity" role="tabpanel">
        <section className="cw-card">
          <h3 className="cw-label">This assessment</h3>
          {run ? <dl className="cw-facts">
            <div><dt>Answered by</dt><dd>{run.model}</dd></div>
            <div><dt>Time</dt><dd>{(run.latencyMs / 1000).toFixed(1)} s{run.modelCalls ? ` · ${run.modelCalls} model calls` : ""}</dd></div>
            {run.mode === "ai-gateway" && <div><dt>Cost</dt><dd>About ${run.costUsd?.toFixed(4) ?? "n/a"} · {state.aiRuns?.count ?? 0} AI runs today</dd></div>}
            {run.fallbackReason && <div><dt>Why no AI</dt><dd>{run.fallbackReason}</dd></div>}
            <div><dt>Case workflow</dt><dd className="mono">{state.runId}</dd></div>
          </dl> : <p className="cw-empty">Not assessed yet.</p>}
        </section>
        {run?.mode === "ai-gateway" && <section className="cw-card">
          <h3 className="cw-label">Corrected by policy <span className="cw-count">{run.corrections.length}</span></h3>
          {run.corrections.length ? <ul className="corrections">{run.corrections.map(c => <li key={c}>{c}</li>)}</ul> : <p className="cw-empty">None. The AI matched the records.</p>}
        </section>}
        {run && <section className="cw-card">
          <h3 className="cw-label">Calls to Apex's systems <span className="cw-count">{run.calls.length}</span></h3>
          <ul className="calls">{run.calls.map((call, i) => <li key={i}><span>{call.system}</span><code>{call.endpoint.split("?")[0].replace(/^\/\w+\/v\d/, "")}</code><em className={call.status >= 400 ? "is-error" : undefined}>{call.status} · {call.ms} ms</em></li>)}</ul>
        </section>}
        <section className="cw-card">
          <h3 className="cw-label">History</h3>
          <ol className="history">{state.log.slice(-8).map((entry, i) => <li key={i}><time>{time(entry.at)}</time>{entry.text}</li>)}</ol>
        </section>
        <p className="cw-boundary">Reads SAP, the quality system and regulatory rules through Apex's service API. Never writes to them. Only people approve a change.</p>
      </div>}
    </main>

    {selected && <ProductPanel finding={selected} sourceById={sourceById} onClose={() => setOpen(null)} />}
  </>;
}

// One card that tells the signed-in person exactly what to do, or who the case is waiting for.
function NextStep({ view, state, user, lead, person, questions, busy, switching, assessing, onAssess, onRoute, onSign, onSwitch }: {
  view: View; state: CaseState | null; user: User; lead: User; person: (role: User["role"]) => User;
  questions: { finishedGood: string; owner: string; detail: string }[]; busy: boolean; switching: boolean; assessing: boolean;
  onAssess: () => void; onRoute: () => void; onSign: (role: ReviewRole, note: string) => void; onSwitch: (target: User) => void;
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
  else if (view === "ready") { owner = lead; task = "Both signed. Send the re-testing and customer-notice plan."; action = <button className="btn btn-primary" onClick={onRoute} disabled={busy}>Send plan to {lead.name.split(" ")[0]}</button>; }
  else { owner = lead; task = `Plan sent at ${state.routed ? time(state.routed.at) : ""}. ${lead.name} owns the next step.`; }

  const isMe = owner.id === user.id;
  if (signRole && isMe) {
    action = <div className="cw-sign">
      <label htmlFor="sign-note" className="visually-hidden">Decision note</label>
      <textarea id="sign-note" rows={3} value={note || defaultNotes[signRole]} onChange={event => setNote(event.target.value)} />
      <button className="btn btn-primary" onClick={() => onSign(signRole!, note || defaultNotes[signRole!])} disabled={busy}>{busy ? "Recording…" : `Sign off as ${signRole}`}</button>
    </div>;
  } else if (!isMe && (signRole || view === "unassessed" || view === "ready")) {
    action = <button className="btn btn-secondary" onClick={() => onSwitch(owner)} disabled={switching}>{switching ? "Switching…" : `Sign in as ${owner.name.split(" ")[0]}`}</button>;
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
        <div><p className="cw-meta">{f.finishedGood} · {marketTag(f.market)}</p><h2 id="panel-h">{shortName(f.product)}</h2></div>
        <button className="cw-close" onClick={onClose} aria-label="Close">×</button>
      </header>
      <span className={`pill pill-${f.disposition}`}>{statusLabel[f.disposition]}</span>
      <p className="cw-panel-why">{f.rationale}</p>
      {f.noticeDays && f.disposition !== "unaffected" ? <p className="cw-panel-notice"><strong>{f.noticeDays} days</strong> customer notice before X-17R ships</p> : null}
      <h3 className="cw-label">Sources</h3>
      <ul className="cw-panel-sources">
        {f.evidenceIds.map(id => { const s = sourceById.get(id); return <li key={id}><code>{id}</code><div><strong>{s ? s.title.split(" | ")[1] ?? s.title : "Record"}</strong>{s && <p>{s.system === "Supplier notice" ? "Supplier document" : s.system} · {s.detail}</p>}</div></li>; })}
      </ul>
    </aside>
  </div>;
}
