"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { switchAccount } from "@/app/actions";
import type { Assessment, ProductRecord } from "@/lib/case";
import { evidence, records, supplierChange } from "@/lib/case";
import type { ReviewRole, User } from "@/lib/users";

type Review = { note: string; signedBy?: string; signedAt?: string; workflowRunId?: string };
type AssessmentResponse = { assessment: Assessment; runId: string; mode: "ai-gateway" | "validated-fixture" | "safe-fallback"; latencyMs: number; model: string };
type Status = ProductRecord["status"];
type CaseState = "unassessed" | "review" | "ready" | "routed" | "blocked";

const statusLabel: Record<Status, string> = { qualified: "Qualified", requalification_required: "Requalification required", unaffected: "Unaffected", uncertain: "Evidence missing" };
const modeLabel = { "ai-gateway": "AI Gateway", "validated-fixture": "Validated fixture", "safe-fallback": "Safe fallback" };
const stateLabel: Record<CaseState, string> = { unassessed: "Not assessed", review: "In review", ready: "Ready to route", routed: "Routed", blocked: "Blocked" };
const defaultNotes = (missingEu: boolean): Record<ReviewRole, string> => ({
  Quality: "Requalification required for AeroShield 420 before X-17R is used.",
  "Regulatory Affairs": missingEu ? "EU qualification record is missing. Recover or verify it before any EMEA decision." : "EMEA customer notification required under REG-EU-07.",
});
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
// Days left until the current material runs out: the deadline the whole case is working against.
const daysUntil = (date: string) => Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000));

export function CaseWorkspace({ user, directory }: { user: User; directory: User[] }) {
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const [missingEu, setMissingEu] = useState(false);
  const [assessment, setAssessment] = useState<AssessmentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reviews, setReviews] = useState<Record<ReviewRole, Review>>(() => {
    const notes = defaultNotes(false);
    return { Quality: { note: notes.Quality }, "Regulatory Affairs": { note: notes["Regulatory Affairs"] } };
  });
  const [routedAt, setRoutedAt] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);

  const currentRecords = useMemo(() => records(missingEu), [missingEu]);
  const person = (role: User["role"]) => directory.find(entry => entry.role === role)!;
  const lead = person("Product Change Lead");
  const regulatoryOwner = person("Regulatory Affairs");
  const quality = reviews.Quality, regulatory = reviews["Regulatory Affairs"];
  const reviewsDone = Boolean(quality.signedAt && regulatory.signedAt);

  // One derived state drives the badge, the decision panel and the hand-off line, so they can't disagree.
  const state: CaseState = missingEu ? "blocked" : !assessment ? "unassessed" : routedAt ? "routed" : reviewsDone ? "ready" : "review";
  const findings = new Map(assessment?.assessment.affected.map(item => [item.recordId, item]));

  const rawSteps: { label: string; detail: string; done: boolean; blocked?: boolean; person?: User }[] = [
    { label: "Notice received", detail: supplierChange.received, done: true },
    { label: "Assessment", detail: assessment ? modeLabel[assessment.mode] : lead.name, done: Boolean(assessment), person: lead },
    { label: "Quality", detail: person("Quality").name, done: Boolean(quality.signedAt), person: person("Quality") },
    { label: "Regulatory", detail: regulatoryOwner.name, done: Boolean(regulatory.signedAt), blocked: missingEu, person: regulatoryOwner },
    { label: "Plan routed", detail: lead.name, done: Boolean(routedAt), person: lead },
  ];
  const firstOpen = rawSteps.findIndex(step => !step.done);
  const steps = rawSteps.map((step, index) => ({ ...step, current: index === firstOpen }));

  function cite(id: string) {
    setHighlight(id);
    document.getElementById(`source-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function runAssessment() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/assessment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ missingEuQualification: missingEu }) });
      if (!response.ok) throw new Error("The evidence assessment could not complete. Check the upstream register and retry.");
      setAssessment(await response.json());
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The assessment didn't complete. Run it again."); }
    finally { setLoading(false); }
  }

  async function signOff(role: ReviewRole) {
    setError("");
    try {
      const response = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, decision: reviews[role].note }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The sign-off wasn't recorded. Try again.");
      setReviews(current => ({ ...current, [role]: { ...current[role], signedBy: result.reviewer, signedAt: result.recordedAt, workflowRunId: result.workflowRunId } }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The sign-off wasn't recorded. Try again."); }
  }

  function setScenario(next: boolean) {
    setMissingEu(next); setAssessment(null); setRoutedAt(null); setError(""); setHighlight(null);
    const notes = defaultNotes(next);
    setReviews({ Quality: { note: notes.Quality }, "Regulatory Affairs": { note: notes["Regulatory Affairs"] } });
  }

  const switchTo = (target: User) => startSwitch(async () => { await switchAccount(target.id); router.refresh(); });

  return <>
    <header className="topbar">
      <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/cases">Cases</Link><span aria-hidden="true">/</span><span aria-current="page">{supplierChange.id}</span></nav>
      <div className="topbar-tools">
        <label className="scenario">
          <span>Missing EU record</span>
          <button role="switch" aria-checked={missingEu} className="switch" onClick={() => setScenario(!missingEu)}><span className="visually-hidden">Simulate a missing EU qualification record</span></button>
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
          <span className={`badge badge-lg badge-${state}`}>{stateLabel[state]}</span>
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
          {/* Decision first: the answer the Product Change Lead needs sits at the top, and every other section is supporting evidence. */}
          <section className={`decision decision-${state}`} aria-labelledby="decision-h" aria-busy={loading}>
            <div className="decision-top">
              <p className="eyebrow">Decision</p>
              {assessment && <span className="decision-mode">{modeLabel[assessment.mode]} · {assessment.latencyMs} ms</span>}
            </div>

            {loading ? <div className="decision-loading" role="status">
              <h2 id="decision-h">Reading {evidence.length} Apex records…</h2>
              <span className="skeleton" /><span className="skeleton short" />
            </div> : !assessment ? <div className="decision-empty">
              <div>
                <h2 id="decision-h">{missingEu ? "An EU record is missing" : "No assessment yet"}</h2>
                <p>Check each product and region against the records on file. Every finding cites a source, and missing records are flagged rather than guessed.</p>
              </div>
              <button className="btn btn-primary" onClick={runAssessment}>Run assessment</button>
            </div> : <>
              <h2 id="decision-h">{missingEu ? "EMEA use can't be approved yet" : "X-17R needs requalification before use"}</h2>
              <p className="decision-summary">{assessment.assessment.summary}</p>

              {assessment.assessment.uncertainties.map(item => {
                // An open question closes when its owner signs off; a missing record never closes this way.
                const closedBy = !missingEu && item.owner === "Regulatory Affairs" ? regulatory : undefined;
                return closedBy?.signedAt
                  ? <div className="open-question is-resolved" key={item.recordId}><strong>Resolved · {closedBy.signedBy}, {time(closedBy.signedAt)}</strong><p>{closedBy.note}</p></div>
                  : <div className="open-question" key={item.recordId}><strong>Open question · {item.owner}</strong><p>{item.detail}</p></div>;
              })}

              <div className="next-action">
                <div>
                  <p className="eyebrow">Next action</p>
                  {state === "blocked" && <p><strong>{regulatoryOwner.name}</strong> recovers or verifies the EU qualification record. Nothing can be routed until then.</p>}
                  {state === "review" && <p>Quality and Regulatory Affairs sign off, then the plan goes to <strong>{lead.name}</strong>.</p>}
                  {state === "ready" && <p>Route the requalification and customer-notification plan for AeroShield 420 to <strong>{lead.name}</strong>.</p>}
                  {state === "routed" && routedAt && <p>Plan routed to <strong>{lead.name}</strong> at {time(routedAt)}. {user.id === lead.id ? "It's in your queue." : `${lead.name} owns the next step.`}</p>}
                </div>
                {state === "ready"
                  ? <button className="btn btn-primary" onClick={() => setRoutedAt(new Date().toISOString())}>Route plan to {lead.name}</button>
                  : <Owner user={state === "blocked" ? regulatoryOwner : lead} />}
              </div>

              <div className="decision-foot">
                <button className="btn btn-quiet" onClick={runAssessment}>Run again</button>
                <p>The assessment cites sources. It can't approve or route a change.</p>
              </div>
            </>}
          </section>

          <section className="block" aria-labelledby="impact-h">
            <div className="block-head"><h2 id="impact-h">Impact by product and region</h2><span className="block-meta">{currentRecords.length} records{assessment ? " · assessed" : ""}</span></div>
            <div className="table-wrap">
              <table className="impact-table">
                <thead><tr><th scope="col">Product and region</th><th scope="col">Status</th><th scope="col">{assessment ? "Assessment" : "Record on file"}</th><th scope="col">Sources</th></tr></thead>
                <tbody>
                  {currentRecords.map(record => {
                    // Once assessed, the row shows the model's cited rationale; before that, the record as stored.
                    const finding = findings.get(record.id);
                    const status = finding?.disposition ?? record.status;
                    return <tr key={record.id} className={status === "uncertain" ? "is-uncertain" : status === "unaffected" ? "is-quiet" : undefined}>
                      <td><strong>{record.product}</strong><span className="cell-sub">{record.region}<span className="record-id">{record.id}</span></span></td>
                      <td><StatusBadge status={status} /></td>
                      <td className="cell-text">{finding?.rationale ?? record.detail}</td>
                      <td><Cite ids={finding?.evidenceIds ?? record.evidenceIds} onCite={cite} /></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="block" aria-labelledby="review-h">
            <div className="block-head"><h2 id="review-h">Sign-offs</h2><span className="block-meta">Both required before routing</span></div>
            <div className="signoffs">
              {(["Quality", "Regulatory Affairs"] as const).map(role => <SignOff key={role}
                role={role}
                scope={role === "Quality" ? "Technical scope and requalification plan" : "Regional qualification and customer notification"}
                assignee={person(role)}
                user={user}
                review={reviews[role]}
                waitingOn={!assessment ? "Waiting for the evidence assessment." : role === "Regulatory Affairs" && missingEu ? "Blocked until the EU qualification record is recovered." : null}
                switching={switching}
                onNote={note => setReviews(current => ({ ...current, [role]: { ...current[role], note } }))}
                onSign={() => signOff(role)}
                onSwitch={() => switchTo(person(role))} />)}
            </div>
          </section>
        </div>

        <aside className="case-aside" aria-label="Sources and run record">
          <section className="aside-block">
            <div className="aside-head"><h2>Sources</h2><span>Apex records</span></div>
            <ol className="sources">
              {evidence.map(item => {
                const missing = missingEu && item.id === "QLF-EU-03";
                return <li key={item.id} id={`source-${item.id}`} className={highlight === item.id ? "is-highlighted" : missing ? "is-missing" : undefined}>
                  <span className="source-id">{item.id}</span>
                  <strong>{item.source.split(" | ")[0]}</strong>
                  <p>{missing ? "Not returned by the qualification system." : item.detail}</p>
                </li>;
              })}
            </ol>
          </section>

          <section className="aside-block">
            <div className="aside-head"><h2>Run record</h2>{assessment && <span className="live-dot">Recorded</span>}</div>
            {assessment ? <dl className="run">
              <div><dt>Evidence source</dt><dd>Apex register | verified snapshot</dd></div>
              <div><dt>Assessment run</dt><dd className="mono">{assessment.runId}</dd></div>
              <div><dt>Model</dt><dd>{assessment.model}</dd></div>
              <div><dt>Latency</dt><dd>{assessment.latencyMs} ms</dd></div>
              {quality.workflowRunId && <div><dt>Quality workflow</dt><dd className="mono">{quality.workflowRunId}</dd></div>}
              {regulatory.workflowRunId && <div><dt>Regulatory workflow</dt><dd className="mono">{regulatory.workflowRunId}</dd></div>}
            </dl> : <p className="aside-empty">Each assessment and sign-off is recorded here with its run ID, model and timing.</p>}
          </section>

          <section className="aside-note">
            <h2>System boundary</h2>
            <p>Reads copies of Apex product, qualification and regulatory records. It never writes to Apex systems, and only people can approve a change.</p>
          </section>
        </aside>
      </div>
    </main>
  </>;
}

function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge badge-${status}`}>{statusLabel[status]}</span>;
}

function Cite({ ids, onCite }: { ids: string[]; onCite: (id: string) => void }) {
  return <span className="cites">{ids.map(id => <button key={id} className="cite" onClick={() => onCite(id)} aria-label={`Show source ${id}`}>{id}</button>)}</span>;
}

function Owner({ user }: { user: User }) {
  return <p className="owner"><span className={`avatar small tone-${user.id}`} aria-hidden="true">{user.initials}</span><span><strong>{user.name}</strong><span>{user.title}</span></span></p>;
}

function SignOff({ role, scope, assignee, user, review, waitingOn, switching, onNote, onSign, onSwitch }: {
  role: ReviewRole; scope: string; assignee: User; user: User; review: Review; waitingOn: string | null; switching: boolean;
  onNote: (note: string) => void; onSign: () => void; onSwitch: () => void;
}) {
  const isAssignee = user.id === assignee.id;
  const signed = Boolean(review.signedAt);
  const blocked = Boolean(waitingOn) && !signed;
  const hardBlock = blocked && Boolean(waitingOn?.startsWith("Blocked"));
  return <article className={`signoff ${signed ? "is-signed" : ""} ${hardBlock ? "is-uncertain" : ""}`}>
    <header>
      <div><h3>{role}</h3><p>{scope}</p></div>
      <span className={`badge ${signed ? "badge-unaffected" : hardBlock ? "badge-uncertain" : "badge-neutral"}`}>{signed ? "Signed off" : hardBlock ? "Blocked" : "Pending"}</span>
    </header>
    <Owner user={assignee} />
    {signed ? <div className="signed">
      <p className="signed-note">{review.note}</p>
      <p className="signed-meta">Signed by {review.signedBy} at {time(review.signedAt!)}</p>
    </div> : blocked ? <p className="waiting">{waitingOn}</p> : isAssignee ? <div className="sign-form">
      <label htmlFor={`note-${role}`}>Decision note</label>
      <textarea id={`note-${role}`} value={review.note} onChange={event => onNote(event.target.value)} rows={3} />
      <button className="btn btn-primary" onClick={onSign} disabled={review.note.trim().length < 3}>Sign off as {role}</button>
    </div> : <div className="handoff">
      <p>You're signed in as {user.name}. Only {assignee.name} can sign off for {role}.</p>
      <button className="btn btn-secondary" onClick={onSwitch} disabled={switching}>{switching ? "Switching…" : `Switch to ${assignee.name}`}</button>
    </div>}
  </article>;
}
