import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { analytics, assumptions, periods, productLines, type Period, type ProductLine } from "@/lib/analytics";
import { requireUser } from "@/lib/session";
import "./analytics.css";

export const metadata: Metadata = { title: "Analytics" };

const usd = (n: number, digits = 0) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits });
const pct = (n: number) => `${Math.round(n * 100)}%`;

// The frame prerenders. The numbers stream in: the decided-case history is cached and tagged ("analytics"),
// the cases in flight are read live. Filters live in the URL, so a view can be shared as a link.
export default function AnalyticsPage({ searchParams }: { searchParams: Promise<{ period?: string; line?: string }> }) {
  return <>
    <header className="topbar"><nav className="breadcrumb" aria-label="Breadcrumb"><span aria-current="page">Analytics</span></nav></header>
    <Suspense fallback={<main className="page an" aria-busy="true"><div className="an-head"><h1>Analytics</h1></div><div className="sk-block" style={{ height: 110 }} /><div className="sk-block" style={{ height: 260 }} /></main>}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  </>;
}

async function Dashboard({ searchParams }: { searchParams: Promise<{ period?: string; line?: string }> }) {
  await requireUser();
  const params = await searchParams;
  const period = (params.period && params.period in periods ? params.period : "ytd") as Period;
  const line = productLines.includes(params.line as ProductLine) ? params.line as ProductLine : undefined;
  const a = await analytics({ period, line });
  const href = (next: { period?: Period; line?: ProductLine | null }) => {
    const p = next.period ?? period, l = next.line === null ? undefined : next.line ?? line;
    return `/analytics?period=${p}${l ? `&line=${encodeURIComponent(l)}` : ""}`;
  };
  const maxDays = Math.max(...a.months.map(m => m.days ?? 0), a.daysToDecision.before, 1);
  const caught = [
    { label: "Missing records", value: a.caught.missingRecords, tip: "e.g. no EU qualification on file" },
    { label: "Invented citations", value: a.caught.inventedCitations, tip: "record IDs the model made up, removed" },
    { label: "Model corrections", value: a.caught.modelCorrections, tip: "answers the policy check fixed" },
  ];
  const maxLineDays = Math.max(...a.byLine.map(r => r.before), 1);
  // Budget ring: share of the monthly AI budget used.
  const ring = 2 * Math.PI * 34;
  const maxCaught = Math.max(...caught.map(c => c.value), 1);
  const budgetShare = Math.min(1, a.ai.costUsd / a.ai.budgetUsd);

  return <>
    <main className="page an">
      <div className="an-head">
        <h1>Analytics</h1>
        <nav className="an-filters" aria-label="Filters">
          <div className="an-seg" role="group" aria-label="Period">
            {(Object.keys(periods) as Period[]).map(p => <Link key={p} href={href({ period: p })} aria-current={p === period ? "true" : undefined}>{periods[p]}</Link>)}
          </div>
          <div className="an-seg" role="group" aria-label="Product line">
            <Link href={href({ line: null })} aria-current={!line ? "true" : undefined}>All lines</Link>
            {productLines.map(l => <Link key={l} href={href({ line: l })} aria-current={l === line ? "true" : undefined}>{l}</Link>)}
          </div>
        </nav>
      </div>

      <section className="an-tiles" aria-label="Headline numbers">
        <div><span>Days to decision</span><strong>{a.cases ? a.daysToDecision.workspace : "–"}</strong><em className="is-good">was {a.daysToDecision.before}</em></div>
        <div><span>Time saved</span><strong>{a.effort.hoursSaved} h</strong><em>{a.cases} cases</em></div>
        <div><span>Cost saved</span><strong>{usd(a.effort.costSavedUsd)}</strong><em>net of AI</em></div>
        <div><span>Notices on time</span><strong>{pct(a.notices.onTimeShare)}</strong><em className="is-good">was {pct(a.notices.beforeOnTimeShare)}</em></div>
      </section>

      <section className="an-card" aria-labelledby="trend">
        <header><h2 id="trend">Days to decision, by month</h2><span className="an-legend"><i className="is-manual" />Manual <i className="is-ws" />Workspace <i className="is-base" />Before</span></header>
        <div className="an-bars" role="img" aria-label={`Median days to decision by month. Manual months around ${a.daysToDecision.before} days, workspace months around ${a.daysToDecision.workspace || 2} days.`}>
          <i className="an-base" style={{ bottom: `calc(22px + (100% - 22px) * ${a.daysToDecision.before / maxDays})` }} />
          {a.months.map(m => <div key={m.month} className={`an-bar ${m.inPeriod ? "" : "is-out"}`}>
            {m.days !== null
              ? <span className={`is-${m.mode}`} style={{ height: `${(m.days / maxDays) * 100}%` }} data-tip={`${m.label}: ${m.days} days | ${m.cases} ${m.cases === 1 ? "case" : "cases"}`} tabIndex={0} />
              : <span className="is-none" data-tip={`${m.label}: no cases`} tabIndex={0} />}
            <b>{m.label}</b>
          </div>)}
        </div>
      </section>

      <div className="an-trio">
        <section className="an-card" aria-labelledby="lines">
          <header><h2 id="lines">By product line</h2><span className="an-legend"><i className="is-manual" />Before <i className="is-ws" />Now</span></header>
          <ul className="an-pairs">
            {a.byLine.map(r => <li key={r.line}>
              <Link href={href({ line: r.line })}>{r.line}</Link>
              <span className="an-pairbars">
                <i className="is-before" style={{ width: `${(r.before / maxLineDays) * 100}%` }} title={`Before: ${r.before} days`}><b>{r.before} d</b></i>
                <i className="is-now" style={{ width: `max(26px, ${((r.cases ? r.medianDays : 0) / maxLineDays) * 100}%)` }} title={`Now: ${r.cases ? r.medianDays : "no"} days`}><b>{r.cases ? `${r.medianDays} d` : "–"}</b></i>
              </span>
            </li>)}
          </ul>
        </section>

        <section className="an-card" aria-labelledby="caught">
          <header><h2 id="caught">Caught before sign-off</h2></header>
          <ul className="an-hbars">
            {caught.map(c => <li key={c.label} title={c.tip}>
              <strong>{c.label}</strong>
              <i><b style={{ width: `${(c.value / maxCaught) * 100}%` }} /></i>
              <em>{c.value}</em>
            </li>)}
          </ul>
        </section>

        <section className="an-card an-spendcard" aria-labelledby="spend">
          <header><h2 id="spend">AI spend</h2></header>
          <div className="an-ring" role="meter" aria-valuemin={0} aria-valuemax={a.ai.budgetUsd} aria-valuenow={Number(a.ai.costUsd.toFixed(2))} aria-label="AI spend against the monthly budget">
            <svg width="96" height="96" viewBox="0 0 80 80" aria-hidden="true">
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--sunken)" strokeWidth="9" />
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--sage)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${Math.max(2, budgetShare * ring)} ${ring}`} transform="rotate(-90 40 40)" />
            </svg>
            <span><strong>{usd(a.ai.costUsd, 2)}</strong><small>of {usd(a.ai.budgetUsd)}</small></span>
          </div>
          <p className="an-foot">{usd(a.ai.costPerRunUsd, 4)} per assessment</p>
        </section>
      </div>

      <p className="an-note">Example history (manual until July). AI cost and mistakes measured in tests. Assumes {assumptions.manualHours} h → {assumptions.workspaceHours} h per case at {usd(assumptions.hourlyRate)}/h.</p>
    </main>
  </>;
}
