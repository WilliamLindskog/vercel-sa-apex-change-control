"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { switchAccount } from "@/app/actions";
import type { Scenario } from "@/lib/apex-systems";
import type { CaseState, Disposition, Finding } from "@/lib/case";
import { marketLabel, supplierChange, supplierDocuments } from "@/lib/case";
import type { ReviewRole, User } from "@/lib/users";

type View = "unassessed" | "review" | "ready" | "routed" | "blocked";
type Command = { type: "assess" } | { type: "sign"; role: ReviewRole; note: string } | { type: "route" } | { type: "scenario"; scenario: Scenario };

const statusLabel: Record<Disposition, string> = { qualified: "Qualified", requalification_required: "Requalification required", unaffected: "Unaffected", uncertain: "Evidence missing" };
const viewLabel: Record<View, string> = { unassessed: "Not assessed", review: "In review", ready: "Ready to route", routed: "Routed", blocked: "Blocked" };
const scenarioLabel: Record<Scenario, string> = { normal: "All systems normal", "missing-eu-qualification": "EU record missing", "qms-outage": "Quality system down" };
const defaultNotes: Record<ReviewRole, string> = {
  Quality: "Requalification required for AeroShield 420 before X-17R is used.",
  "Regulatory Affairs": "Customer notices required: 90 days for EMEA (REG-EU-07), 60 days for the US (REG-US-02).",
};
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
// Days left until the current material runs out: the deadline the whole case is working against.
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
      // Wait for the workflow to apply it: a newer version, or a new run after a scenario change.
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
  const [notes, setNotes] = useState(defaultNotes);
  const [highlight, setHighlight] = useState<string | null>(null);

  const person = (role: User["role"]) => directory.find(entry => entry.role === role)!;
  const lead = person("Product Change Lead");
  const run = state?.assessment ?? null;
  const findings = run?.assessment.findings ?? [];
  const uncertain = findings.filter(f => f.disposition === "uncertain");
  const quality = state?.signOffs.Quality ?? null;
  const regulatory = state?.signOffs["Regulatory Affairs"] ?? null;
  const assessing = Boolean(state?.assessing) || (busy && !run);

  // One derived view drives the badge, the decision panel and the hand-off line, so they can't disagree.
  const view: View = !run ? "unassessed" : uncertain.length ? "blocked" : state?.routed ? "routed" : quality && regulatory ? "ready" : "review";
  const blocker = run?.assessment.openQuestions[0];
  const blockerOwner = blocker ? person(blocker.owner) : lead;

  const rawSteps: { label: string; detail: string; done: boolean; blocked?: boolean; person?: User }[] = [
    { label: "Notice received", detail: supplierChange.received, done: true },
    { label: "Assessment", detail: run ? (run.mode === "ai-gateway" ? "AI, checked by policy" : "Policy rules") : lead.name, done: Boolean(run), person: lead },
    { label: "Quality", detail: person("Quality").name, done: Boolean(quality), person: person("Quality") },
    { label: "Regulatory", detail: person("Regulatory Affairs").name, done: Boolean(regulatory), blocked: uncertain.length > 0, person: person("Regulatory Affairs") },
    { label: "Plan routed", detail: lead.name, done: Boolean(state?.routed), person: lead },
  ];
  const firstOpen = rawSteps.findIndex(step => !step.done);
  const steps = rawSteps.map((step, index) => ({ ...step, current: index === firstOpen }));

  const sources = run?.sources ?? supplierDocuments;
  function cite(id: string) {
    setHighlight(id);
    document.getElementById(`source-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  const switchTo = (target: User) => startSwitch(async () => { await switchAccount(target.id); router.refresh(); });

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

    <main className="page case-page">
      <div className="case-head">
        <div className="case-title-row">
          <div>
            <p className="eyebrow">{supplierChange.id} · {supplierChange.supplier}</p>
            <h1>{supplierChange.title}</h1>
          </div>
          <span className={`badge badge-lg badge-${view}`}>{viewLabel[view]}</span>
        </div>

        {/* The change itself, compressed to one line: what is going away, what replaces it, and the proof. */}
        <div className="change-strip">
          <span className="material"><span className="material-role">Current</span><strong>Binder X-17</strong></span>
          <span className="material-arrow" aria-label="replaced by" />
          <span className="material is-proposed"><span className="material-role">Proposed</span><strong>Binder X-17R</strong></span>
          <p>{supplierChange.materialImpact} <Cite ids={["SUP-01", "SUP-02"]} onCite={cite} /></p>
          <div className="countdown"><strong>{daysUntil(supplierChange.deadline)}</strong><span>days until X-17 supply ends<br />{supplierChange.deadline}</span></div>
        </div>

        <ol className="handoff-line" aria-label="Who the case moves between">
          {steps.map(step => <li key={step.label} className={step.done ? "is-done" : step.blocked ? "is-blocked" : step.current ? "is-current" : undefined}>
            {step.person
              ? <span className={`avatar tone-${step.person.id}`} aria-hidden="true">{step.person.initials}</span>
              : <span className="avatar tone-supplier" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M3.5 2.5h6l3 3v8h-9z M9.5 2.5v3h3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg></span>}
            <span className="handoff-text"><strong>{step.label}</strong><span>{step.blocked && !step.done ? "Blocked" : step.detail}</span></span>
            {step.done && <span className="handoff-check" aria-label="Done"><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="m2 5.2 2 2L8 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>}
          </li>)}
        </ol>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="case-layout">
        <div className="case-main">
          {/* Decision first: the answer the Product Change Lead needs sits at the top; everything else is supporting evidence. */}
          <section className={`decision decision-${view}`} aria-labelledby="decision-h" aria-busy={assessing}>
            <div className="decision-top">
              <p className="eyebrow">Decision</p>
              {run && <span className="decision-mode">{run.mode === "ai-gateway" ? "AI Gateway" : "Policy rules"} · {run.latencyMs} ms</span>}
            </div>

            {!state ? <div className="decision-loading" role="status"><h2 id="decision-h">Opening the case…</h2><span className="skeleton" /><span className="skeleton short" /></div>
            : assessing ? <div className="decision-loading" role="status">
              <h2 id="decision-h">Checking SAP, the quality system and regulatory rules…</h2>
              <span className="skeleton" /><span className="skeleton short" />
            </div> : !run ? <div className="decision-empty">
              <div>
                <h2 id="decision-h">No assessment yet</h2>
                <p>Purchasing flagged {supplierChange.candidates.length} products. The assessment checks each one against SAP, the quality system and regional notice rules, and cites every record it uses.</p>
              </div>
              <button className="btn btn-primary" onClick={() => send({ type: "assess" })} disabled={busy}>Run assessment</button>
            </div> : <>
              <h2 id="decision-h">{uncertain.length ? `${uncertain.map(f => `${f.product} (${marketLabel(f.market)})`).join(", ")} can't be decided yet` : "X-17R needs requalification before use"}</h2>
              <p className="decision-summary">{run.assessment.summary}</p>

              {run.assessment.openQuestions.map(item => <div className="open-question" key={`${item.finishedGood}-${item.owner}`}><strong>Open question · {item.owner}</strong><p>{item.detail}</p></div>)}

              <div className="next-action">
                <div>
                  <p className="eyebrow">Next action</p>
                  {view === "blocked" && <p><strong>{blockerOwner.name}</strong> resolves the open question. Nothing can be routed until then.</p>}
                  {view === "review" && <p>Quality and Regulatory Affairs sign off, then the plan goes to <strong>{lead.name}</strong>.</p>}
                  {view === "ready" && <p>Route the requalification and customer-notice plan to <strong>{lead.name}</strong>.</p>}
                  {view === "routed" && state.routed && <p>Plan routed to <strong>{state.routed.to}</strong> at {time(state.routed.at)}. {user.id === lead.id ? "It's in your queue." : `${lead.name} owns the next step.`}</p>}
                </div>
                {view === "ready"
                  ? <button className="btn btn-primary" onClick={() => send({ type: "route" })} disabled={busy}>Route plan to {lead.name}</button>
                  : <Owner user={view === "blocked" ? blockerOwner : lead} />}
              </div>

              <div className="decision-foot">
                <button className="btn btn-quiet" onClick={() => send({ type: "assess" })} disabled={busy || Boolean(state.routed)}>Run again</button>
                <p>The assessment cites Apex records. It can't approve or route a change.</p>
              </div>
            </>}
          </section>

          <section className="block" aria-labelledby="impact-h">
            <div className="block-head"><h2 id="impact-h">Impact by product and market</h2><span className="block-meta">{run ? `${findings.length} products checked` : `${supplierChange.candidates.length} flagged by Purchasing`}</span></div>
            <div className="table-wrap">
              <table className="impact-table">
                <thead><tr><th scope="col">Product and market</th><th scope="col">Status</th><th scope="col">Finding</th><th scope="col">Sources</th></tr></thead>
                <tbody>
                  {run ? findings.map(f => <FindingRow key={f.finishedGood} finding={f} onCite={cite} />)
                    : supplierChange.candidates.map(id => <tr key={id} className="is-quiet">
                      <td><strong>{id}</strong><span className="cell-sub">Flagged by Purchasing</span></td>
                      <td><span className="badge badge-neutral">Not checked</span></td>
                      <td className="cell-text">Not yet checked against SAP and the quality system.</td>
                      <td />
                    </tr>)}
                </tbody>
              </table>
            </div>
          </section>

          <section className="block" aria-labelledby="review-h">
            <div className="block-head"><h2 id="review-h">Sign-offs</h2><span className="block-meta">Both required before routing</span></div>
            <div className="signoffs">
              {(["Quality", "Regulatory Affairs"] as const).map(role => <SignOffCard key={role}
                role={role}
                scope={role === "Quality" ? "Technical scope and requalification plan" : "Regional qualification and customer notices"}
                assignee={person(role)}
                user={user}
                signed={state?.signOffs[role] ?? null}
                note={notes[role]}
                waitingOn={!run ? "Waiting for the assessment." : role === "Regulatory Affairs" && uncertain.length ? "Blocked until the missing record is resolved." : null}
                busy={busy}
                switching={switching}
                onNote={note => setNotes(current => ({ ...current, [role]: note }))}
                onSign={() => send({ type: "sign", role, note: notes[role] })}
                onSwitch={() => switchTo(person(role))} />)}
            </div>
          </section>
        </div>

        <aside className="case-aside" aria-label="Sources and run record">
          <section className="aside-block">
            <div className="aside-head"><h2>Sources</h2><span>{run ? `${sources.length} records` : "Supplier documents"}</span></div>
            <ol className="sources">
              {sources.map(item => <li key={item.id} id={`source-${item.id}`} className={highlight === item.id ? "is-highlighted" : undefined}>
                <span className="source-id">{item.id}<em>{item.system}</em></span>
                <strong>{item.title.split(" | ")[1] ?? item.title}</strong>
                <p>{item.detail}</p>
              </li>)}
              {uncertain.map(f => <li key={`gap-${f.finishedGood}`} className="is-missing">
                <span className="source-id">{f.finishedGood}<em>QMS</em></span>
                <strong>No qualification record</strong>
                <p>{f.rationale}</p>
              </li>)}
            </ol>
            {!run && <p className="aside-empty">Apex records appear here once the assessment reads them.</p>}
          </section>

          <section className="aside-block">
            <div className="aside-head"><h2>Run record</h2>{state && <span className="live-dot">Durable</span>}</div>
            {state ? <dl className="run">
              <div><dt>Case workflow</dt><dd className="mono">{state.runId}</dd></div>
              {run && <>
                <div><dt>Assessed by</dt><dd>{run.model}</dd></div>
                {run.fallbackReason && <div><dt>Why no model</dt><dd>{run.fallbackReason}</dd></div>}
                <div><dt>Time</dt><dd>{run.latencyMs} ms{run.usage?.inputTokens ? ` · ${run.usage.inputTokens + (run.usage.outputTokens ?? 0)} tokens` : ""}{run.modelCalls ? ` · ${run.modelCalls} model calls` : ""}</dd></div>
                {run.mode === "ai-gateway" && <div><dt>Cost</dt><dd>{run.costUsd !== undefined ? `About $${run.costUsd.toFixed(4)}` : "Not available"} · AI runs today {state.aiRuns?.count ?? 0}{run.requestedModel && !run.model.startsWith(run.requestedModel) ? ` · fell back from ${run.requestedModel}` : ""}</dd></div>}
                <div><dt>Apex system calls</dt><dd>
                  <ul className="calls">{run.calls.map((call, i) => <li key={i}><span>{call.system}</span><code>{call.endpoint.split("?")[0].replace(/^\/\w+\/v\d/, "")}</code><em className={call.status >= 400 ? "is-error" : undefined}>{call.status} · {call.ms} ms</em></li>)}</ul>
                </dd></div>
                {run.mode === "ai-gateway" && <div><dt>Policy corrections</dt><dd>{run.corrections.length ? <ul className="corrections">{run.corrections.map(c => <li key={c}>{c}</li>)}</ul> : "None. The model matched the records."}</dd></div>}
              </>}
              <div><dt>History</dt><dd><ol className="history">{state.log.slice(-6).map((entry, i) => <li key={i}><time>{time(entry.at)}</time>{entry.text}</li>)}</ol></dd></div>
            </dl> : <p className="aside-empty">Opening the case workflow…</p>}
          </section>

          <section className="aside-note">
            <h2>System boundary</h2>
            <p>Reads SAP, the quality system and regulatory rules through Apex's service API. It never writes to them, and only people can approve a change.</p>
          </section>
        </aside>
      </div>
    </main>
  </>;
}

function FindingRow({ finding: f, onCite }: { finding: Finding; onCite: (id: string) => void }) {
  return <tr className={f.disposition === "uncertain" ? "is-uncertain" : f.disposition === "unaffected" ? "is-quiet" : undefined}>
    <td><strong>{f.product}</strong><span className="cell-sub">{marketLabel(f.market)}<span className="record-id">{f.finishedGood}</span></span></td>
    <td><span className={`badge badge-${f.disposition}`}>{statusLabel[f.disposition]}</span>{f.noticeDays && f.disposition !== "unaffected" ? <span className="cell-note">{f.noticeDays}-day customer notice</span> : null}</td>
    <td className="cell-text">{f.rationale}</td>
    <td><Cite ids={f.evidenceIds} onCite={onCite} /></td>
  </tr>;
}

function Cite({ ids, onCite }: { ids: string[]; onCite: (id: string) => void }) {
  return <span className="cites">{ids.map(id => <button key={id} className="cite" onClick={() => onCite(id)} aria-label={`Show source ${id}`}>{id}</button>)}</span>;
}

function Owner({ user }: { user: User }) {
  return <p className="owner"><span className={`avatar small tone-${user.id}`} aria-hidden="true">{user.initials}</span><span><strong>{user.name}</strong><span>{user.title}</span></span></p>;
}

function SignOffCard({ role, scope, assignee, user, signed, note, waitingOn, busy, switching, onNote, onSign, onSwitch }: {
  role: ReviewRole; scope: string; assignee: User; user: User; signed: CaseState["signOffs"][ReviewRole]; note: string; waitingOn: string | null;
  busy: boolean; switching: boolean; onNote: (note: string) => void; onSign: () => void; onSwitch: () => void;
}) {
  const isAssignee = user.id === assignee.id;
  const blocked = Boolean(waitingOn) && !signed;
  const hardBlock = blocked && Boolean(waitingOn?.startsWith("Blocked"));
  return <article className={`signoff ${signed ? "is-signed" : ""} ${hardBlock ? "is-uncertain" : ""}`}>
    <header>
      <div><h3>{role}</h3><p>{scope}</p></div>
      <span className={`badge ${signed ? "badge-unaffected" : hardBlock ? "badge-uncertain" : "badge-neutral"}`}>{signed ? "Signed off" : hardBlock ? "Blocked" : "Pending"}</span>
    </header>
    <Owner user={assignee} />
    {signed ? <div className="signed">
      <p className="signed-note">{signed.note}</p>
      <p className="signed-meta">Signed by {signed.reviewer} at {time(signed.at)}</p>
    </div> : blocked ? <p className="waiting">{waitingOn}</p> : isAssignee ? <div className="sign-form">
      <label htmlFor={`note-${role}`}>Decision note</label>
      <textarea id={`note-${role}`} value={note} onChange={event => onNote(event.target.value)} rows={3} />
      <button className="btn btn-primary" onClick={onSign} disabled={busy || note.trim().length < 3}>{busy ? "Recording…" : `Sign off as ${role}`}</button>
    </div> : <div className="handoff">
      <p>You're signed in as {user.name}. Only {assignee.name} can sign off for {role}.</p>
      <button className="btn btn-secondary" onClick={onSwitch} disabled={switching}>{switching ? "Switching…" : `Switch to ${assignee.name}`}</button>
    </div>}
  </article>;
}
