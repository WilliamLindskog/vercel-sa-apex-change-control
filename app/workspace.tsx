"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Assessment, Evidence, ProductRecord } from "@/lib/case";
import type { User, ReviewRole } from "@/lib/users";

type Run = { assessment: Assessment; runId: string; latencyMs: number; mode: string };
type Receipt = { reviewer: string; workflowRunId: string; decision: string };
type CaseState = { missing: boolean; run?: Run; receipts: Partial<Record<ReviewRole, Receipt>>; routed?: boolean };
const initial: CaseState = { missing: false, receipts: {} };
const roles: ReviewRole[] = ["Quality", "Regulatory Affairs"];
const sections = ["Impact", "Reviews", "Sources", "Activity"] as const;

export function CaseWorkspace({ user, baseline, exception, sources }: {
  user: User; baseline: ProductRecord[]; exception: ProductRecord[]; sources: Evidence[];
}) {
  const [state, setState] = useState<CaseState>(initial);
  const [ready, setReady] = useState(false);
  const [tab, select] = useState<typeof sections[number]>("Impact");
  const [citation, cite] = useState("");
  const [note, write] = useState("");
  const [busy, pending] = useState(false);
  const [error, fail] = useState("");
  useEffect(() => {
    try { const saved = sessionStorage.getItem("apex-case-v2"); if (saved) setState(JSON.parse(saved)); } catch {}
    setReady(true);
  }, []);
  useEffect(() => { if (ready) sessionStorage.setItem("apex-case-v2", JSON.stringify(state)); }, [ready, state]);
  const blocked = state.missing || state.run?.assessment.decision === "follow_up_required";
  const outstanding = roles.filter(role => !state.receipts[role]);
  const owner = blocked ? "Regulatory Affairs" : state.run && outstanding.length ? outstanding.join(" and ") : "Product Change Lead";
  const status = blocked ? "Evidence missing" : state.routed ? "Plan routed" : !state.run ? "Awaiting assessment" : outstanding.length ? "In review" : "Ready to route";
  const available = sources.filter(s => !state.missing || s.id !== "QLF-EU-09");
  async function submit(kind: "assessment" | "reviews") {
    pending(true); fail("");
    try {
      const response = await fetch("/api/" + kind, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(kind === "assessment" ? {missingEuQualification: state.missing} : {role:user.role, decision:note.trim()}) });
      if (!response.ok) throw new Error("Could not save this action. Please retry.");
      const result = await response.json();
      if (kind === "assessment") setState({...initial, missing:state.missing, run:result});
      else { setState({...state, receipts:{...state.receipts,[user.role]:{...result,decision:note.trim()}}}); write(""); }
    } catch (e) { fail(e instanceof Error ? e.message : "Request failed."); }
    finally { pending(false); }
  }
  function source(id: string) { cite(id); select("Sources"); }
  return <>
    <header className="topbar"><Link href="/cases">Cases</Link><span>/</span>SCC-2026-041 <small>Demo workspace</small></header>
    <main className="page">
      <p className="overline">Supplier change notice</p><h1>Binder X-17 replacement</h1>
      <p className="intro">Meridian proposes X-17R with a revised stabilizer package. Apex has yet to establish performance equivalency.</p>
      <div className="facts"><div>Supplier<strong>Meridian Specialty Materials</strong></div><div>Current supply ends<strong>28 February 2027</strong></div><div>Case owner<strong>Dana Okafor</strong></div></div>
      <section className="decision"><div><span className="signal">{status}</span><h2>{blocked ? "Recover the EU qualification record" : state.routed ? "Requalification plan assigned to Dana Okafor" : !state.run ? "Assess the replacement across three records" : outstanding.length ? "Collect technical and regional reviews" : "Route the plan to the Product Change Lead"}</h2><p>Next owner: {owner}</p></div>
      {!state.run ? <button disabled={busy || !ready} onClick={()=>submit("assessment")}>{busy ? "Assessing…" : "Run assessment"}</button> : !blocked && !outstanding.length && !state.routed && user.role === "Product Change Lead" ? <button onClick={()=>setState({...state,routed:true})}>Route plan</button> : <button onClick={()=>select(blocked?"Sources":"Reviews")}>{blocked?"Inspect sources":"View reviews"}</button>}</section>
      {error && <p role="alert">{error}</p>}
      <nav className="sections" aria-label="Case views">{sections.map(s=><button aria-pressed={s===tab} key={s} onClick={()=>select(s)}>{s}</button>)}</nav>
      {tab==="Impact" && <section><h2>Product and regional impact</h2>{state.run && <p>{state.run.assessment.summary} <small>{state.run.mode}</small></p>}
        {(state.missing?exception:baseline).map(r=><article className="impact" key={r.id}><div><strong>{r.product}</strong><span>{r.region}</span></div><div><b>{r.status==="uncertain"?"Evidence missing":r.status==="unaffected"?"Unaffected":"Requalification required"}</b><p>{state.run?.assessment.affected.find(a=>a.recordId===r.id)?.rationale ?? r.detail}</p><div className="refs">{r.evidenceIds.map(id=><button key={id} onClick={()=>source(id)}>{id}</button>)}</div></div></article>)}
        {state.run?.assessment.uncertainties.map(u=><p key={u.recordId}><b>{u.owner}</b> | {u.detail}</p>)}</section>}
      {tab==="Reviews" && <section><h2>Required reviews</h2>{roles.map(role=><article className="review" key={role}><h3>{role}</h3>{state.receipts[role] ? <p>{state.receipts[role]?.decision}<br/><small>Recorded by {state.receipts[role]?.reviewer}</small></p> : !state.run ? <p>Run the assessment to open this review.</p> : blocked && role==="Regulatory Affairs" ? <p>Recover the EU qualification record before signing off.</p> : user.role===role ? <form onSubmit={e=>{e.preventDefault();submit("reviews")}}><label>Decision note<textarea required minLength={3} value={note} onChange={e=>write(e.target.value)}/></label><button disabled={busy || note.trim().length<3}>Record review</button></form> : <p>Awaiting {role} sign-off. Switch to this reviewer using the account menu.</p>}</article>)}</section>}
      {tab==="Sources" && <section><h2>Evidence register</h2>{available.map(s=><article key={s.id} className={"source "+(s.id===citation?"selected":"")}><code>{s.id}</code><div><strong>{s.source}</strong><p>{s.detail}</p></div></article>)}</section>}
      {tab==="Activity" && <section><h2>Run history</h2>{state.run ? <p>Assessment | {state.run.mode} | {state.run.latencyMs} ms<br/><code>{state.run.runId}</code></p> : <p>No assessment has run for this scenario.</p>}{roles.map(r=>state.receipts[r] && <p key={r}>{r} workflow | {state.receipts[r]?.reviewer}<br/><code>{state.receipts[r]?.workflowRunId}</code></p>)}{state.routed && <p>Requalification and notification plan routed in this demo session.</p>}</section>}
      <details className="scenario"><summary>Demo scenario controls</summary><p>Changing EU source availability clears the current assessment and sign-offs.</p><button disabled={busy || !ready} onClick={()=>{setState({...initial,missing:!state.missing});fail("");cite("");select("Impact")}}>{state.missing?"Restore EU qualification":"Remove EU qualification"}</button></details>
    </main></>;
}
