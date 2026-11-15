import type { Metadata } from "next";
import { Suspense } from "react";
import { systemsActivity } from "@/lib/board";
import { tools } from "@/lib/connections";
import { requireUser } from "@/lib/session";
import "./connections.css";

export const metadata: Metadata = { title: "Connections" };

// Two kinds of connection, kept honest:
//   Apex systems: live today, read-only through Apex's service API (production: Vercel Secure Compute).
//                 The numbers come from the lookups real assessments made.
//   Your tools:   phase 2, through Vercel Connect (IT-approved connectors, per-person consent, short-lived
//                 tokens). Shown so people know what is coming; nothing here pretends to work.
const apexSystems = [
  { system: "ERP", name: "SAP S/4HANA", mark: "SAP", tone: "sap" },
  { system: "QMS", name: "Veeva QMS", mark: "V", tone: "veeva" },
  { system: "Regulatory", name: "Regulatory", mark: "R", tone: "reg" },
] as const;


export default function ConnectionsPage() {
  return <>
    <header className="topbar"><nav className="breadcrumb" aria-label="Breadcrumb"><span aria-current="page">Connections</span></nav></header>
    <main className="page cn">
      <h1>Connections</h1>

      <section aria-labelledby="apex-h">
        <header className="cn-head"><h2 id="apex-h">Apex systems</h2><span className="cn-tag" title="Read-only through Apex's service API. Production: Vercel Secure Compute.">Read-only</span></header>
        <Suspense fallback={<div className="cn-grid">{apexSystems.map(s => <div key={s.system} className="cn-card sk-block" style={{ height: 64 }} />)}</div>}>
          <ApexSystems />
        </Suspense>
      </section>

      <section aria-labelledby="tools-h">
        <header className="cn-head"><h2 id="tools-h">Your tools</h2><span className="cn-tag" title="IT approves each tool; you connect your own account; the app only gets short-lived tokens.">Vercel Connect, phase 2</span></header>
        <div className="cn-grid is-four">
          {tools.map(t => <div key={t.name} className="cn-card is-planned">
            <span className={`cn-logo is-${t.id}`} aria-hidden="true">{t.mark}</span>
            <strong>{t.name}</strong>
            {t.connected ? <span className="cn-status">Connected</span> : <button className="cn-connect" disabled title="Phase 2">Connect</button>}
          </div>)}
        </div>
      </section>
    </main>
  </>;
}

async function ApexSystems() {
  await requireUser();
  const activity = await systemsActivity();
  return <div className="cn-grid">
    {apexSystems.map(s => {
      const a = activity.find(x => x.system === s.system)!;
      return <div key={s.system} className="cn-card" title={`${a.lookups} lookups${a.avgMs !== null ? `, ${a.avgMs} ms on average` : ""}`}>
        <span className={`cn-logo is-${s.tone}`} aria-hidden="true">{s.mark}</span>
        <span className="cn-name"><strong>{s.name}</strong><small>{a.avgMs !== null ? `${a.avgMs} ms` : "–"}</small></span>
        <span className={`cn-status ${a.failures ? "is-warn" : ""}`}>{a.failures ? `${a.failures} failed` : "Connected"}</span>
      </div>;
    })}
  </div>;
}
