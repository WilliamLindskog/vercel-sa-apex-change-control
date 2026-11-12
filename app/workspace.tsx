"use client";

import { useEffect, useMemo, useState } from "react";
import type { Assessment } from "@/lib/case";
import { evidence, records, supplierChange } from "@/lib/case";

type Review = { complete: boolean; note: string; workflowRunId?: string };
type AssessmentResponse = { assessment: Assessment; runId: string; mode: "ai-gateway" | "validated-fixture" | "safe-fallback"; latencyMs: number; model: string };
const labels = { qualified: "Qualified", requalification_required: "Requalification required", unaffected: "Unaffected", uncertain: "Evidence missing" };

export function CaseWorkspace() {
  const [curveball, setCurveball] = useState(false);
  const [assessment, setAssessment] = useState<AssessmentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quality, setQuality] = useState<Review>({ complete: false, note: "Confirm technical requalification scope." });
  const [regulatory, setRegulatory] = useState<Review>({ complete: false, note: "Confirm regional notification requirements." });
  const [activeEvidence, setActiveEvidence] = useState<string | null>(null);
  const currentRecords = useMemo(() => records(curveball), [curveball]);
  const canRoute = Boolean(assessment) && quality.complete && regulatory.complete && !curveball;
  const needsFollowUp = curveball || assessment?.assessment.decision === "follow_up_required";

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const span = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        document.documentElement.style.setProperty("--page-progress", String(window.scrollY / span));
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);

  async function runAssessment() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/assessment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ missingEuQualification: curveball }) });
      if (!response.ok) throw new Error("Assessment could not be completed. Try again.");
      setAssessment(await response.json());
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Assessment could not be completed."); }
    finally { setLoading(false); }
  }

  async function completeReview(role: "Quality" | "Regulatory Affairs") {
    const review = role === "Quality" ? quality : regulatory;
    try {
      const response = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, decision: review.note }) });
      if (!response.ok) throw new Error("Review could not be recorded. Try again.");
      const result = await response.json();
      const next = { ...review, complete: true, workflowRunId: result.workflowRunId };
      role === "Quality" ? setQuality(next) : setRegulatory(next);
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Review could not be recorded."); }
  }

  function toggleCurveball() {
    const next = !curveball; setCurveball(next); setAssessment(null); setError("");
    setQuality({ complete: false, note: "Confirm technical requalification scope." });
    setRegulatory({ complete: false, note: next ? "Recover the EU qualification record and confirm notification requirements." : "Confirm regional notification requirements." });
  }

  const steps = ["Supplier update", "Assessment", "Quality", "Regulatory", "Decision"];
  const done = [true, Boolean(assessment), quality.complete, regulatory.complete, canRoute];

  return <main className="experience">
    <div className="reading-progress" aria-hidden="true" />
    <header className="masthead"><a href="#top" className="wordmark"><span className="wordmark-symbol">A</span><span>APEX <i>PRODUCT CHANGE CONTROL</i></span></a><a className="case-link" href="#case">CASE SCC-2026-041 <span>↗</span></a><button className={`curveball ${curveball ? "active" : ""}`} onClick={toggleCurveball}>{curveball ? "Restore EU record" : "Test missing-data path"}</button></header>

    <section className="opening" id="top">
      <div className="opening-copy"><p className="kicker"><span className="live-dot"/> SUPPLIER CHANGE NOTICE <span className="kicker-line"/> RECEIVED {supplierChange.received.toUpperCase()}</p><h1>{supplierChange.title}</h1><p className="opening-lede">A supplier is replacing a critical binder. Before the current material runs out, Apex needs to know where it matters, what is still unknown, and who must decide.</p><a className="text-link" href="#case">Examine the case <span>↓</span></a></div>
      <div className="opening-visual" aria-label="Illustration of a raw material specification changing"><div className="visual-caption">MATERIAL TRANSITION <span>X-17 → X-17R</span></div><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="sample sample-old"><span>01</span><b>X-17</b><small>LEGACY BINDER</small></div><div className="sample sample-new"><span>02</span><b>X-17R</b><small>REVISED STABILIZER</small></div><div className="transition-mark">→</div><div className="visual-foot"><span>MERIDIAN SPECIALTY MATERIALS</span><span>SUPPLY ENDS 28 FEB 2027</span></div></div>
      <div className="opening-aside"><span>THE DECISION</span><p>Can X-17R be used across affected products and regions?</p><span>THE RULE</span><p>Evidence first. Human review before any route is final.</p></div>
    </section>

    <section className="case-frame" id="case">
      <aside className="case-rail"><span className="rail-label">CASE FILE</span><strong>SCC<br/>041</strong><span className="rail-rule"/><span className="rail-status"><i/> IN REVIEW</span></aside>
      <div className="case-content">
        <div className="case-topline"><span>PRODUCT CHANGE CONTROL</span><span>01 / OPEN CASE</span></div>
        <div className="case-title"><div><p className="kicker">MERIDIAN SPECIALTY MATERIALS</p><h2>One change.<br/><em>Three records to resolve.</em></h2></div><div className="deadline"><span>LAST ORDER DATE</span><strong>28 <small>FEB</small> 2027</strong></div></div>
        <div className="change-statement"><span className="statement-mark">↳</span><p>{supplierChange.change} <strong>{supplierChange.materialImpact}</strong></p></div>
        <div className="record-heading"><div><span>IMPACT REVIEW</span><h3>Where does the change land?</h3></div><span className="record-count">03 RECORDS</span></div>
        <div className="record-table"><div className="table-head"><span>PRODUCT / REGION</span><span>EXISTING STATE</span><span>REQUIRED ACTION</span><span>SOURCE</span></div>
          {currentRecords.map(record => <article className={`record-row ${record.status === "uncertain" ? "is-uncertain" : ""}`} key={record.id}><div className="record-identity"><strong>{record.product}</strong><span>{record.region} <i>·</i> {record.id}</span></div><div><span className={`status-dot ${record.status}`}/><span className={`tag ${record.status}`}>{labels[record.status]}</span></div><p>{record.detail}</p><div className="evidence-links">{record.evidenceIds.slice(0, 2).map(id => <button key={id} onClick={() => setActiveEvidence(id)}>{id}</button>)}</div></article>)}
        </div>
        {curveball && <div className="curveball-note"><strong>Evidence gap introduced.</strong> The EU qualification record is unavailable. The EMEA status is uncertain and approval remains blocked until Regulatory recovers or verifies the source.</div>}
      </div>
    </section>

    <section className="decision-work" id="decision">
      <div className="section-heading"><div><span>THE REVIEW</span><h2>Evidence can guide.<br/><em>People make the call.</em></h2></div><p>The assessment organizes the fixture evidence. Quality and Regulatory Affairs record the required reviews before the Product Change Lead receives a next action.</p></div>
      <div className="timeline"><div className="timeline-track"><span style={{ width: `${done.filter(Boolean).length / done.length * 100}%` }}/></div><div className="timeline-steps">{steps.map((step, i) => <div className={done[i] ? "complete" : ""} key={step}><span>{done[i] ? "✓" : `0${i + 1}`}</span>{step}</div>)}</div></div>
      <div className="workspace-grid">
        <section className="work-panel assessment-panel"><div className="panel-label"><span>01 / EVIDENCE ASSESSMENT</span><span className={`tag ${assessment?.mode === "ai-gateway" ? "qualified" : "amber"}`}>{assessment ? assessment.mode === "ai-gateway" ? "AI GATEWAY" : assessment.mode === "safe-fallback" ? "SAFE FALLBACK" : "VALIDATED FIXTURE" : "NOT RUN"}</span></div><h3>What does the record support?</h3><p className="panel-intro">Every conclusion must point to evidence. Missing data stays visible as uncertainty.</p>
          {assessment ? <><p className="assessment-summary">{assessment.assessment.summary}</p><div className="assessment-list">{assessment.assessment.affected.map(item => <article key={item.recordId}><div><span className={`mini-status ${item.disposition}`}/><strong>{item.product} <i>·</i> {item.region}</strong></div><p>{item.rationale}</p><div className="evidence-links">{item.evidenceIds.map(id => <button key={id} onClick={() => setActiveEvidence(id)}>{id}</button>)}</div></article>)}</div>{assessment.assessment.uncertainties.map(item => <div className="uncertainty" key={item.recordId}><span>OPEN QUESTION / OWNER: {item.owner.toUpperCase()}</span><p>{item.detail}</p></div>)}</> : <div className="assessment-empty"><span>—</span><p>No assessment recorded yet.</p><small>Start with the available supplier, product, qualification, and regional records.</small></div>}
          {error && <p className="error-message" role="alert">{error}</p>}<button className="action-button" onClick={runAssessment} disabled={loading}>{loading ? "Reading case evidence…" : assessment ? "Re-run assessment" : "Run evidence assessment"}<span>↗</span></button><p className="action-footnote">AI organizes evidence. It cannot approve or route this change.</p>
        </section>
        <section className="work-panel review-panel"><div className="panel-label"><span>02 / REQUIRED REVIEWS</span><span>2 SIGN-OFFS</span></div><h3>Who needs to weigh in?</h3><p className="panel-intro">Both records are required before the route can be prepared.</p>
          <ReviewCard role="Quality" index="A" description="Confirm technical scope and requalification plan." review={quality} setNote={note => setQuality({ ...quality, note })} onComplete={() => completeReview("Quality")} disabled={!assessment || quality.complete}/>
          <ReviewCard role="Regulatory Affairs" index="B" description="Confirm regional qualification and notification obligations." review={regulatory} setNote={note => setRegulatory({ ...regulatory, note })} onComplete={() => completeReview("Regulatory Affairs")} disabled={!assessment || regulatory.complete || curveball}/>
          {curveball && <p className="review-block">Paused until the EU qualification evidence is recovered.</p>}
        </section>
        <section className={`outcome-panel ${canRoute ? "ready" : ""}`}><div><div className="panel-label"><span>03 / NEXT ACTION</span><span className="tag">{canRoute ? "READY TO ROUTE" : "PENDING"}</span></div><h3>{needsFollowUp ? "Recover the missing record." : canRoute ? "Prepare the requalification plan." : "The case is not ready to route."}</h3><p>{needsFollowUp ? "Regulatory Affairs owns restoring or verifying the EU qualification source. No EMEA approval can be made." : canRoute ? "Send a requalification and customer-notification plan for AeroShield 420 in the United States and EMEA." : "Complete the evidence assessment and both required reviews. The Product Change Lead owns the next step."}</p><div className="owner-line"><span>CASE OWNER</span><strong>{needsFollowUp ? "Regulatory Affairs" : "Product Change Lead"}</strong></div>{canRoute && <button className="action-button" onClick={() => setError("Route prepared for the Product Change Lead. No external system is connected in this demo.")}>Prepare route brief <span>↗</span></button>}</div><div className="outcome-seal"><span>{canRoute ? "READY" : needsFollowUp ? "HOLD" : "REVIEW"}</span><b>{canRoute ? "✓" : needsFollowUp ? "!" : "···"}</b></div></section>
      </div>
    </section>

    <section className="evidence-section" id="sources"><div className="evidence-heading"><div><span>THE RECORD</span><h2>Decisions, tied to sources.</h2></div><p>Representative server-side fixtures only. The workspace augments Apex systems and does not replace them.</p></div><div className="source-ledger">{evidence.map((item, i) => <button className={activeEvidence === item.id ? "selected" : ""} key={item.id} onClick={() => setActiveEvidence(activeEvidence === item.id ? null : item.id)}><span className="source-index">0{i + 1}</span><strong>{item.id}</strong><span>{item.source}</span><p>{item.detail}</p><i>{activeEvidence === item.id ? "−" : "+"}</i></button>)}</div></section>

    <section className="run-record"><div><span>RUN HISTORY</span><h2>Inspectable by design.</h2><p>The app shows what ran, which mode responded, and the durable review identifiers.</p></div><div className="run-data"><div><span>ASSESSMENT RUN</span><strong>{assessment?.runId ?? "Not started"}</strong></div><div><span>MODE / MODEL</span><strong>{assessment ? `${assessment.mode} · ${assessment.model}` : "Awaiting assessment"}</strong></div><div><span>LATENCY</span><strong>{assessment ? `${assessment.latencyMs} ms` : "—"}</strong></div><div><span>WORKFLOW RUN</span><strong>{regulatory.workflowRunId ?? quality.workflowRunId ?? "Not started"}</strong></div></div></section>
    <footer className="closing"><p>One cited assessment. Two recorded reviews. A clear next owner.</p><div><span>APEX ADDITIVES / CHANGE CONTROL</span><span>DEMO FIXTURES ONLY · 2026</span></div></footer>
  </main>;
}

function ReviewCard({ role, index, description, review, setNote, onComplete, disabled }: { role: "Quality" | "Regulatory Affairs"; index: string; description: string; review: Review; setNote: (note: string) => void; onComplete: () => void; disabled: boolean }) {
  return <article className={`review ${review.complete ? "reviewed" : ""}`}><div className="review-heading"><span>{index}</span><div><h4>{role}</h4><p>{description}</p></div>{review.complete && <span className="tag qualified">RECORDED</span>}</div><label>Decision note<textarea value={review.note} onChange={event => setNote(event.target.value)} disabled={review.complete}/></label><button className="review-button" onClick={onComplete} disabled={disabled}>{review.complete ? "Review recorded" : `Record ${role} review`}</button>{review.workflowRunId && <p className="workflow-id">Durable workflow · {review.workflowRunId}</p>}</article>;
}
