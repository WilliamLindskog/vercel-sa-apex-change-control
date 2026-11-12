"use client";

import { useMemo, useState } from "react";
import type { Assessment } from "@/lib/case";
import { evidence, records, supplierChange } from "@/lib/case";

type Review = { complete: boolean; note: string; workflowRunId?: string };
type AssessmentResponse = { assessment: Assessment; runId: string; mode: "ai-gateway" | "validated-fixture" | "safe-fallback"; latencyMs: number; model: string };

const labels = {
  qualified: "Qualified", requalification_required: "Requalification required", unaffected: "Unaffected", uncertain: "Evidence missing",
};

export function CaseWorkspace() {
  const [curveball, setCurveball] = useState(false);
  const [assessment, setAssessment] = useState<AssessmentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [quality, setQuality] = useState<Review>({ complete: false, note: "Confirm technical requalification scope." });
  const [regulatory, setRegulatory] = useState<Review>({ complete: false, note: "Confirm regional notification requirements." });
  const [activeEvidence, setActiveEvidence] = useState<string | null>(null);

  const currentRecords = useMemo(() => records(curveball), [curveball]);
  const canRoute = Boolean(assessment) && quality.complete && regulatory.complete && !curveball;
  const needsFollowUp = curveball || assessment?.assessment.decision === "follow_up_required";

  async function runAssessment() {
    setLoading(true);
    try {
      const response = await fetch("/api/assessment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ missingEuQualification: curveball }) });
      if (!response.ok) throw new Error("Assessment failed");
      setAssessment(await response.json());
    } finally { setLoading(false); }
  }

  async function completeReview(role: "Quality" | "Regulatory Affairs") {
    const review = role === "Quality" ? quality : regulatory;
    try {
      const response = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, decision: review.note }) });
      const result = response.ok ? await response.json() : { workflowRunId: "local-review" };
      const next = { ...review, complete: true, workflowRunId: result.workflowRunId };
      role === "Quality" ? setQuality(next) : setRegulatory(next);
    } catch {
      const next = { ...review, complete: true, workflowRunId: "local-review" };
      role === "Quality" ? setQuality(next) : setRegulatory(next);
    }
  }

  function toggleCurveball() {
    const next = !curveball;
    setCurveball(next);
    setAssessment(null);
    setQuality({ complete: false, note: "Confirm technical requalification scope." });
    setRegulatory({ complete: false, note: next ? "Recover the EU qualification record and confirm notification requirements." : "Confirm regional notification requirements." });
  }

  return <main>
    <header className="topbar">
      <div className="brand"><span className="brand-mark">A</span><span>Apex <b>Change Control</b></span></div>
      <div className="case-meta"><span className="case-dot" /> Live decision workspace <span className="muted">|</span> Case {supplierChange.id}</div>
      <button className={`curveball ${curveball ? "active" : ""}`} onClick={toggleCurveball}>{curveball ? "Restore EU qualification" : "Simulate missing EU record"}</button>
    </header>

    <section className="hero">
      <div><p className="eyebrow">SUPPLIER CHANGE CONTROL</p><h1>{supplierChange.title}</h1><p className="lede">Decide if X-17R can be used, with evidence and human review before any route is final.</p></div>
      <div className="hero-facts"><div><span>Supplier</span><strong>{supplierChange.supplier}</strong></div><div><span>Supply ends</span><strong>{supplierChange.deadline}</strong></div></div>
    </section>

    <section className="decision-strip">
      <div className="decision-icon">{needsFollowUp ? "!" : canRoute ? "✓" : "→"}</div>
      <div><p className="eyebrow">CURRENT DECISION</p><h2>{needsFollowUp ? "Approval blocked: evidence recovery required" : canRoute ? "Route requalification and notification plan" : assessment ? "Human reviews required before routing" : "Run an evidence-bound assessment"}</h2><p>{needsFollowUp ? "Regulatory Affairs owns restoration or verification of the missing EU qualification record. No EMEA approval can be made." : canRoute ? "Product Change Lead owns the routed requalification and customer-notification plan." : "The model can organize the evidence, but it cannot approve this change."}</p></div>
      <button className="primary" onClick={runAssessment} disabled={loading}>{loading ? "Assessing evidence…" : assessment ? "Re-run assessment" : "Run assessment"}</button>
    </section>

    <section className="progress" aria-label="Case progress">
      {["Supplier update", "Evidence assessment", "Quality review", "Regulatory review", "Routed outcome"].map((step, index) => {
        const done = index === 0 || (index === 1 && assessment) || (index === 2 && quality.complete) || (index === 3 && regulatory.complete) || (index === 4 && canRoute);
        const blocked = index === 4 && curveball;
        return <div key={step} className={`progress-step ${done ? "done" : ""} ${blocked ? "blocked" : ""}`}><span>{done ? "✓" : index + 1}</span>{step}</div>;
      })}
    </section>

    {curveball && <section className="alert"><strong>Curveball active.</strong> The EU qualification record is intentionally absent from the mocked system of record. The workspace hides no uncertainty and blocks the route until Regulatory resolves it.</section>}

    <div className="grid">
      <section className="panel change-card"><div className="panel-heading"><div><p className="eyebrow">01 | WHAT CHANGED</p><h2>Supplier update</h2></div><span className="tag amber">Action required</span></div><p>{supplierChange.change}</p><div className="impact-callout"><span>Material implication</span>{supplierChange.materialImpact}</div><p className="source">Source: SUP-01, SUP-02 | Received {supplierChange.received}</p></section>

      <section className="panel records-card"><div className="panel-heading"><div><p className="eyebrow">02 | WHAT IS AFFECTED</p><h2>Product and regional impact</h2></div><span className="count">3 records</span></div><div className="records">{currentRecords.map(record => <article key={record.id} className="record"><div><h3>{record.product}</h3><p>{record.region} <span className="dot-separator">•</span> {record.id}</p></div><span className={`tag ${record.status}`}>{labels[record.status]}</span><p className="record-detail">{record.detail}</p><div className="evidence-links">{record.evidenceIds.map(id => <button key={id} onClick={() => setActiveEvidence(id)}>{id}</button>)}</div></article>)}</div></section>

      <section className="panel assessment-card"><div className="panel-heading"><div><p className="eyebrow">03 | WHAT THE EVIDENCE SAYS</p><h2>Assessment</h2></div>{assessment && <span className={`tag ${assessment.mode === "ai-gateway" ? "qualified" : "amber"}`}>{assessment.mode === "ai-gateway" ? "AI Gateway" : "Validated fixture"}</span>}</div>{assessment ? <><p className="assessment-summary">{assessment.assessment.summary}</p><div className="assessment-list">{assessment.assessment.affected.map(item => <div key={item.recordId}><span className={`mini-status ${item.disposition}`} /> <strong>{item.product} · {item.region}</strong><p>{item.rationale}</p><div className="evidence-links">{item.evidenceIds.map(id => <button key={id} onClick={() => setActiveEvidence(id)}>{id}</button>)}</div></div>)}</div>{assessment.assessment.uncertainties.map(item => <div className="uncertainty" key={item.recordId}><strong>Uncertainty: {item.owner}</strong><p>{item.detail}</p></div>)}</> : <div className="empty"><span>◎</span><p>Run the assessment to create a schema-validated, source-linked decision aid.</p></div>}</section>

      <section className="panel evidence-card"><div className="panel-heading"><div><p className="eyebrow">EVIDENCE LEDGER</p><h2>Source coverage</h2></div><span className="tag qualified">100% cited</span></div><p className="small-copy">Every material conclusion links to a fixture record. The browser never receives a supplier-system credential.</p><div className="evidence-list">{evidence.map(item => <button onClick={() => setActiveEvidence(item.id)} className={activeEvidence === item.id ? "selected" : ""} key={item.id}><span>{item.id}</span><div><strong>{item.source}</strong><p>{item.detail}</p></div></button>)}</div>{activeEvidence && <div className="evidence-focus"><span>Selected evidence</span><strong>{activeEvidence}</strong><button onClick={() => setActiveEvidence(null)}>Clear</button></div>}</section>

      <section className="panel reviews-card"><div className="panel-heading"><div><p className="eyebrow">04 | WHO ACTS NEXT</p><h2>Required human reviews</h2></div><span className="tag amber">2 required</span></div><ReviewCard role="Quality" description="Confirm technical scope, test plan, and that no equivalency claim is assumed." review={quality} setNote={note => setQuality({ ...quality, note })} onComplete={() => completeReview("Quality")} disabled={!assessment || quality.complete} />
        <ReviewCard role="Regulatory Affairs" description="Confirm regional qualification and customer-notification obligations." review={regulatory} setNote={note => setRegulatory({ ...regulatory, note })} onComplete={() => completeReview("Regulatory Affairs")} disabled={!assessment || regulatory.complete || curveball} />
        {curveball && <p className="review-block">Regulatory review is paused until the missing qualification evidence is recovered.</p>}</section>

      <section className={`panel route-card ${canRoute ? "ready" : ""}`}><div className="panel-heading"><div><p className="eyebrow">05 | ROUTED OUTCOME</p><h2>{canRoute ? "Ready for Product Change Lead" : "Awaiting release conditions"}</h2></div><span className={`tag ${canRoute ? "qualified" : "muted-tag"}`}>{canRoute ? "Route ready" : "Not final"}</span></div>{canRoute ? <><p>Send a requalification plan for AeroShield 420 in the United States and EMEA, with the regional customer-notification plan attached.</p><div className="owner"><span>Owner</span><strong>Product Change Lead</strong></div><button className="primary route-button">Route plan to Product Change Lead</button></> : <><p>{curveball ? "Evidence recovery must happen before this case may be routed." : "Run the assessment, then collect both recorded reviews. The application will not route automatically."}</p><ul><li className={assessment ? "complete" : ""}>Evidence assessment</li><li className={quality.complete ? "complete" : ""}>Quality review</li><li className={regulatory.complete ? "complete" : ""}>Regulatory review</li></ul></>}</section>
    </div>

    <section className="observability"><div><p className="eyebrow">OBSERVABILITY</p><h2>Inspectable run boundary</h2><p>Assessment calls, mock-system latency, failure state, and review workflow IDs are visible by design.</p></div><div className="trace-grid"><div><span>Assessment run</span><strong>{assessment?.runId ?? "Not started"}</strong></div><div><span>Assessment mode</span><strong>{assessment?.mode ?? "Awaiting run"}</strong></div><div><span>Latency</span><strong>{assessment ? `${assessment.latencyMs} ms` : "—"}</strong></div><div><span>Review workflow</span><strong>{regulatory.workflowRunId ?? quality.workflowRunId ?? "Not started"}</strong></div></div></section>

    <footer><span>POC system boundary: fixed, representative Apex fixtures only.</span><span>Production discussion: Secure Compute or Connect for private APIs; Rolling Releases for canary and rollback.</span></footer>
  </main>;
}

function ReviewCard({ role, description, review, setNote, onComplete, disabled }: { role: "Quality" | "Regulatory Affairs"; description: string; review: Review; setNote: (note: string) => void; onComplete: () => void; disabled: boolean }) {
  return <article className={`review ${review.complete ? "reviewed" : ""}`}><div className="review-title"><span className="review-icon">{review.complete ? "✓" : role === "Quality" ? "Q" : "R"}</span><div><h3>{role}</h3><p>{description}</p></div>{review.complete && <span className="tag qualified">Recorded</span>}</div><label>Decision record<textarea value={review.note} onChange={event => setNote(event.target.value)} disabled={review.complete} /></label><button className="secondary" onClick={onComplete} disabled={disabled}>{review.complete ? "Review recorded" : `Record ${role} review`}</button>{review.workflowRunId && <p className="workflow-id">Workflow run: {review.workflowRunId}</p>}</article>;
}
