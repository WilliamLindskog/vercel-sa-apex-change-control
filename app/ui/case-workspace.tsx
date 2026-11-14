"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { switchAccount } from "@/app/actions";
import type { Scenario, SourceRecord } from "@/lib/apex-systems";
import type { CaseState, Disposition, Finding } from "@/lib/case";
import { supplierChange, supplierDocuments } from "@/lib/case";
import type { ReviewRole, User } from "@/lib/users";

// The case page answers five questions, in this order, with as few words as possible:
// what changed, what is affected, what is the evidence, what is uncertain, and what happens next (and who owns it).
// Detail lives one click away: product cards open a panel, records and run data sit in their own tabs.

type View = "unassessed" | "review" | "ready" | "routed" | "blocked";
type Tab = "overview" | "evidence" | "activity";
type Command = { type: "assess" } | { type: "sign"; role: ReviewRole; note: string } | { type: "route" } | { type: "scenario"; scenario: Scenario };

const statusLabel: Record<Disposition, string> = { qualified: "Qualified", requalification_required: "Re-test needed", unaffected: "Not affected", uncertain: "Can't decide" };
const viewLabel: Record<View, string> = { unassessed: "Not assessed", review: "In review", ready: "Ready to send", routed: "Plan sent", blocked: "Blocked" };
const scenarioLabel: Record<Scenario, string> = { normal: "All systems normal", "missing-eu-qualification": "EU record missing", "qms-outage": "Quality system down" };
const defaultNotes: Record<ReviewRole, string> = {
  Quality: "Requalification required for AeroShield 420 before X-17R is used.",
  "Regulatory Affairs": "Customer notices: 90 days EMEA (REG-EU-07), 60 days US (REG-US-02).",
};
const systemOrder: SourceRecord["system"][] = ["ERP", "QMS", "Regulatory", "Supplier notice"];
const systemLabel: Record<SourceRecord["system"], string> = { ERP: "SAP (ERP)", QMS: "Quality system", Regulatory: "Regulatory rules", "Supplier notice": "Supplier documents" };
const marketTag = (market: string) => (market === "EU" ? "EU" : "US");
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
  const [tab, setTab] = useState<Tab>("overview");
  const [open, setOpen] = useState<string | null>(null);

  const person = (role: User["role"]) => directory.find(entry => entry.role === role)!;
  const lead = person("Product Change Lead");
  const run = state?.assessment ?? null;
  const findings = run?.assessment.findings ?? [];
  const uncertain = findings.filter(f => f.disposition === "uncertain");
  const retest = findings.filter(f => f.disposition === "requalification_required");
  const quality = state?.signOffs.Quality ?? null;
  const regulatory = state?.signOffs["Regulatory Affairs"] ?? null;
  const assessing = Boolean(state?.assessing) || (busy && !run);
  const view: View = !run ? "unassessed" : uncertain.length ? "blocked" : state?.routed ? "routed" : quality && regulatory ? "ready" : "review";
  const questions = run?.assessment.openQuestions ?? [];
  const blockerOwner = questions[0] ? person(questions[0].owner) : lead;
  const sources = run?.sources ?? supplierDocuments;
  const sourceById = new Map(sources.map(s => [s.id, s]));
  const selected = findings.find(f => f.finishedGood === open) ?? null;
  const switchTo = (target: User) => startSwitch(async () => { await switchAccount(target.id); router.refresh(); });

  const steps: { label: string; done: boolean; blocked?: boolean; person?: User }[] = [
    { label: "Notice", done: true },
    { label: "Assessment", done: Boolean(run), person: lead },
    { label: "Quality", done: Boolean(quality), person: person("Quality") },
    { label: "Regulatory", done: Boolean(regulatory), blocked: uncertain.length > 0, person: person("Regulatory Affairs") },
    { label: "Plan sent", done: Boolean(state?.routed), person: lead },
  ];
  const current = steps.findIndex(step => !step.done);

  const headline = !run ? "Not assessed yet"
    : view === "blocked" ? `${uncertain.map(f => `${f.product.replace(/ \(eu\)$/i, "")} ${marketTag(f.market)}`).join(", ")} can't be decided`
    : view === "routed" ? `Plan sent to ${state!.routed!.to}`
    : `${retest.length} need re-testing · ${findings.length - retest.length - uncertain.length} not affected`;
  const nextLine = !run ? `Checks ${supplierChange.candidates.length} flagged products against SAP, the quality system and notice rules.`
    : view === "blocked" ? `${blockerOwner.name} resolves the open question first.`
    : view === "review" ? "Next: Quality and Regulatory sign off."
    : view === "ready" ? `Both signed. Send the plan to ${lead.name}.`
    : `Sent at ${time(state!.routed!.at)}. ${lead.name} owns the next step.`;

  return <>
    <header className="topbar">
      <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/cases">Cases</Link><span aria-hidden="true">/</span><span aria-current="page">{supplierChange.id}</span></nav>
      <div className="topbar-tools">
        <label className="scenario">
          <span>Demo scenario</span>
          <select value={state?.scenario ?? "normal"} disabled={busy || !state} onChange={event => send({ type: "scenario", scenario: event.target.value as Scenario })}>
            {(Object.keys(scenarioLabel) as Scenario[]).map(key => <option key={key} value={key}>{scenarioLabel[key]}</option>)}
          </select>
        </label>
        <span className="env-badge">Demo data</span>
      </div>
    </header>

    <main className="page cw">
      {/* 1. What changed */}
      <header className="cw-head">
        <div>
          <p className="cw-meta">{supplierChange.id} · {supplierChange.supplier}</p>
          <h1>{supplierChange.title}</h1>
        </div>
        <span className={`pill pill-${view}`}>{viewLabel[view]}</span>
      </header>
      <div className="cw-change">
        <span className="cw-material">Binder X-17</span>
        <span className="cw-arrow" aria-label="replaced by" />
        <span className="cw-material is-new">Binder X-17R</span>
        <span className="cw-change-note">Revised stabilizer, not certified equivalent</span>
        <span className="cw-days"><strong>{daysUntil(supplierChange.deadline)}</strong> days until supply ends</span>
      </div>

      <ol className="cw-steps" aria-label="Case progress">
        {steps.map((step, i) => <li key={step.label} className={step.done ? "is-done" : step.blocked ? "is-blocked" : i === current ? "is-current" : undefined}>
          {step.person ? <span className={`avatar small tone-${step.person.id}`} aria-hidden="true">{step.person.initials}</span> : <span className="avatar small tone-supplier" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 16 16"><path d="M3.5 2.5h6l3 3v8h-9z M9.5 2.5v3h3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg></span>}
          <span>{step.label}</span>
        </li>)}
      </ol>

      {error && <p className="form-error" role="alert">{error}</p>}

      {/* 4 + 5. The answer, what is uncertain, and what happens next */}
      <section className={`cw-verdict is-${view}`} aria-live="polite" aria-busy={assessing}>
        <div className="cw-verdict-main">
          <h2>{assessing ? "Checking Apex's systems…" : headline}</h2>
          <p>{assessing ? "SAP, the quality system and regulatory rules, one record at a time." : nextLine}</p>
          {questions.length > 0 && !assessing && <ul className="cw-questions">{questions.map(q => <li key={`${q.finishedGood}-${q.owner}`}><strong>{q.owner}</strong>{q.detail}</li>)}</ul>}
        </div>
        <div className="cw-verdict-side">
          {!state ? null
            : !run ? <button className="btn btn-primary" onClick={() => send({ type: "assess" })} disabled={busy}>{assessing ? "Running…" : "Run assessment"}</button>
            : view === "ready" ? <button className="btn btn-primary" onClick={() => send({ type: "route" })} disabled={busy}>Send plan to {lead.name.split(" ")[0]}</button>
            : <Owner user={view === "blocked" ? blockerOwner : view === "routed" ? lead : lead} compact />}
          {run && <span className="cw-run-meta">{run.mode === "ai-gateway" ? "AI, checked by policy" : "Policy rules"} · {(run.latencyMs / 1000).toFixed(1)} s{run.costUsd ? ` · $${run.costUsd.toFixed(4)}` : ""}</span>}
          {run && !state?.routed && <button className="btn-text" onClick={() => send({ type: "assess" })} disabled={busy}>Run again</button>}
        </div>
      </section>

      <nav className="cw-tabs" role="tablist" aria-label="Case views">
        {(["overview", "evidence", "activity"] as Tab[]).map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
          {t === "overview" ? "Overview" : t === "evidence" ? `Evidence${run ? ` ${sources.length}` : ""}` : "Activity"}
        </button>)}
      </nav>

      {tab === "overview" && <div className="cw-overview" role="tabpanel">
        {/* 2. What is affected */}
        <section aria-labelledby="products-h">
          <h3 id="products-h" className="cw-label">Products</h3>
          <div className="cw-products">
            {run ? findings.map(f => <ProductCard key={f.finishedGood} finding={f} onOpen={() => setOpen(f.finishedGood)} />)
              : supplierChange.candidates.map(id => <div key={id} className={`cw-product is-pending ${assessing ? "is-loading" : ""}`}>
                <div className="cw-product-top"><strong>{id}</strong><span className="pill pill-unassessed">Not checked</span></div>
                <p className="cw-product-sub">Flagged by Purchasing</p>
              </div>)}
          </div>
        </section>

        <section aria-labelledby="signoffs-h">
          <h3 id="signoffs-h" className="cw-label">Sign-offs</h3>
          <div className="cw-signoffs">
            {(["Quality", "Regulatory Affairs"] as const).map(role => <SignOffCard key={role}
              role={role} assignee={person(role)} user={user} signed={state?.signOffs[role] ?? null}
              waitingOn={!run ? "After assessment" : role === "Regulatory Affairs" && uncertain.length ? "Blocked by missing record" : null}
              busy={busy} switching={switching}
              onSign={note => send({ type: "sign", role, note })}
              onSwitch={() => switchTo(person(role))} />)}
          </div>
        </section>
      </div>}

      {/* 3. The evidence */}
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

      {tab === "activity" && <div className="cw-activity" role="tabpanel">
        {state ? <>
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
        </> : <p className="cw-empty">Opening the case…</p>}
      </div>}
    </main>

    {selected && <ProductPanel finding={selected} sourceById={sourceById} onClose={() => setOpen(null)} />}
  </>;
}

// A product at a glance: status and three facts. The reasoning is one click away.
function ProductCard({ finding: f, onOpen }: { finding: Finding; onOpen: () => void }) {
  const record = f.evidenceIds.find(id => id.startsWith("QLF"));
  const approval = f.disposition === "unaffected" ? "Not needed" : record ?? (f.rationale.includes("unavailable") ? "System down" : "Missing");
  return <button className={`cw-product is-${f.disposition}`} onClick={onOpen} aria-label={`${f.product}, ${statusLabel[f.disposition]}. Open details`}>
    <div className="cw-product-top">
      <strong>{f.product.replace(/ \(eu\)$/i, "")}</strong>
      <span className="cw-market">{marketTag(f.market)}</span>
    </div>
    <span className={`pill pill-${f.disposition}`}>{statusLabel[f.disposition]}</span>
    <dl className="cw-mini">
      <div><dt>Approval</dt><dd className={approval === "Missing" || approval === "System down" ? "is-bad" : undefined}>{approval}</dd></div>
      <div><dt>Customer notice</dt><dd>{f.disposition === "unaffected" ? "None" : f.noticeDays ? `${f.noticeDays} days` : "Unknown"}</dd></div>
      <div><dt>Sources</dt><dd>{f.evidenceIds.length}</dd></div>
    </dl>
  </button>;
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
        <div><p className="cw-meta">{f.finishedGood} · {marketTag(f.market)}</p><h2 id="panel-h">{f.product.replace(/ \(eu\)$/i, "")}</h2></div>
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

function Owner({ user, compact = false }: { user: User; compact?: boolean }) {
  return <p className={`owner ${compact ? "is-compact" : ""}`}><span className={`avatar small tone-${user.id}`} aria-hidden="true">{user.initials}</span><span><strong>{user.name}</strong><span>{user.role}</span></span></p>;
}

function SignOffCard({ role, assignee, user, signed, waitingOn, busy, switching, onSign, onSwitch }: {
  role: ReviewRole; assignee: User; user: User; signed: CaseState["signOffs"][ReviewRole]; waitingOn: string | null;
  busy: boolean; switching: boolean; onSign: (note: string) => void; onSwitch: () => void;
}) {
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState(defaultNotes[role]);
  const isAssignee = user.id === assignee.id;
  const blocked = Boolean(waitingOn) && !signed;
  const hard = blocked && waitingOn!.startsWith("Blocked");
  return <article className={`cw-signoff ${signed ? "is-signed" : hard ? "is-blocked" : ""}`}>
    <div className="cw-signoff-top">
      <span className={`avatar small tone-${assignee.id}`} aria-hidden="true">{assignee.initials}</span>
      <div><strong>{role}</strong><span>{assignee.name}</span></div>
      <span className={`pill ${signed ? "pill-unaffected" : hard ? "pill-uncertain" : "pill-unassessed"}`}>{signed ? `Signed ${time(signed.at)}` : hard ? "Blocked" : "Pending"}</span>
    </div>
    {signed ? <p className="cw-signoff-note">{signed.note}</p>
      : blocked ? <p className="cw-signoff-wait">{waitingOn}</p>
      : !isAssignee ? <button className="btn btn-secondary" onClick={onSwitch} disabled={switching}>{switching ? "Switching…" : `Sign in as ${assignee.name.split(" ")[0]}`}</button>
      : writing ? <div className="cw-sign-form">
          <label htmlFor={`note-${role}`} className="visually-hidden">Decision note</label>
          <textarea id={`note-${role}`} value={note} onChange={event => setNote(event.target.value)} rows={2} autoFocus />
          <div><button className="btn btn-primary" onClick={() => onSign(note)} disabled={busy || note.trim().length < 3}>{busy ? "Recording…" : "Confirm sign-off"}</button><button className="btn-text" onClick={() => setWriting(false)}>Cancel</button></div>
        </div>
      : <button className="btn btn-primary" onClick={() => setWriting(true)}>Sign off</button>}
  </article>;
}
