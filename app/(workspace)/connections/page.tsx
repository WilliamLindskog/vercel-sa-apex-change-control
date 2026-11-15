import type { Metadata } from "next";
import { Suspense } from "react";
import { systemsActivity } from "@/lib/board";
import { requireUser } from "@/lib/session";
import "./connections.css";

export const metadata: Metadata = { title: "Connections" };

// Two kinds of connection, kept honest:
//   Apex systems: live today. The app reads them through Apex's service API; the numbers below come from
//                 the lookups real assessments made.
//   Your tools:   phase 2, through Vercel Connect. Shown so people know what is coming; nothing here pretends to work.
const apexSystems = [
  { system: "ERP", name: "SAP S/4HANA", what: "Materials, where-used, bills of materials", mark: "SAP", tone: "sap" },
  { system: "QMS", name: "Veeva Vault QMS", what: "Qualification records", mark: "V", tone: "veeva" },
  { system: "Regulatory", name: "Regulatory service", what: "Customer notice rules per market", mark: "R", tone: "reg" },
] as const;

const tools = [
  { name: "Outlook", what: "A supplier email opens the case on its own.", mark: "O", tone: "outlook" },
  { name: "Microsoft Teams", what: "Mango sends your nudges and sign-off requests.", mark: "T", tone: "teams" },
  { name: "Slack", what: "The same, for teams on Slack.", mark: "#", tone: "slack" },
  { name: "Salesforce", what: "Names the customers each notice must reach.", mark: "S", tone: "salesforce" },
];

const when = (iso: string | null) => iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "Not yet";

export default function ConnectionsPage() {
  return <>
    <header className="topbar"><nav className="breadcrumb" aria-label="Breadcrumb"><span aria-current="page">Connections</span></nav></header>
    <main className="page cn">
      <h1>Connections</h1>

      <section aria-labelledby="apex-h">
        <header className="cn-head"><h2 id="apex-h">Apex systems</h2><span className="pill pill-ready">Live</span></header>
        <Suspense fallback={<div className="cn-grid">{apexSystems.map(s => <div key={s.system} className="cn-card sk-block" style={{ height: 150 }} />)}</div>}>
          <ApexSystems />
        </Suspense>
        <p className="cn-note">Read-only, through Apex's service API with a service token. In production: Vercel Secure Compute (static IPs, VPC peering).</p>
      </section>

      <section aria-labelledby="tools-h">
        <header className="cn-head"><h2 id="tools-h">Your tools</h2><span className="pill">Phase 2</span></header>
        <div className="cn-grid is-four">
          {tools.map(t => <div key={t.name} className="cn-card is-planned">
            <div className="cn-top"><span className={`cn-logo is-${t.tone}`} aria-hidden="true">{t.mark}</span><strong>{t.name}</strong></div>
            <p>{t.what}</p>
            <button className="btn btn-secondary" disabled title="Phase 2">Connect</button>
          </div>)}
        </div>
        <p className="cn-note">Through Vercel Connect: IT approves each tool once, you connect your own account, and the app only gets short-lived tokens. No passwords or keys are stored.</p>
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
      return <div key={s.system} className="cn-card">
        <div className="cn-top"><span className={`cn-logo is-${s.tone}`} aria-hidden="true">{s.mark}</span><strong>{s.name}</strong>
          <span className={`cn-status ${a.failures ? "is-warn" : ""}`}>{a.failures ? `${a.failures} failed` : "Connected"}</span></div>
        <p>{s.what}</p>
        <dl className="cn-stats">
          <div><dt>Lookups</dt><dd>{a.lookups}</dd></div>
          <div><dt>Avg response</dt><dd>{a.avgMs !== null ? `${a.avgMs} ms` : "–"}</dd></div>
          <div><dt>Last read</dt><dd>{when(a.lastAt)}</dd></div>
        </dl>
      </div>;
    })}
  </div>;
}
