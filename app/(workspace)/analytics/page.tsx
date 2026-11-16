import type { Metadata } from "next";
import { DemoScenario } from "@/app/ui/demo-scenario";
import Link from "next/link";
import { Suspense } from "react";
import { analytics, periods, productLines, type Period, type ProductLine } from "@/lib/analytics";
import { requireUser } from "@/lib/session";
import "./analytics.css";

export const metadata: Metadata = { title: "Analytics" };

const usd = (n: number, digits = 0) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits });

// Plain operational numbers: what is open, what is due, what got decided, what the checks caught, what AI cost.
// The frame prerenders. The numbers stream in: decided-case history is cached and tagged ("analytics"),
// open cases are read live from their workflows. Filters live in the URL, so a view can be shared as a link.
export default function AnalyticsPage({ searchParams }: { searchParams: Promise<{ period?: string; line?: string }> }) {
  return <>
    <header className="topbar"><nav className="breadcrumb" aria-label="Breadcrumb"><span aria-current="page">Analytics</span></nav><DemoScenario /></header>
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

  const open = a.inFlight.cases;
  const byStage = (["new", "review", "ready"] as const).map(stage => ({ label: stageLabel[stage], value: open.filter(c => c.stage === stage).length, stage }));
  const byLine = productLines.filter(l => !line || l === line).map(l => ({ label: l, value: open.filter(c => c.line === l).length }));
  const deadlines = [...open].sort((x, y) => x.daysLeft - y.daysLeft);
  const maxDays = Math.max(...deadlines.map(c => c.daysLeft), 1);
  const months = a.months;
  const maxMonth = Math.max(...months.map(m => m.cases), 1);
  const caught = [
    { label: "Missing records", value: a.caught.missingRecords },
    { label: "Invented citations", value: a.caught.inventedCitations },
    { label: "Model corrections", value: a.caught.modelCorrections },
  ];
  const ring = 2 * Math.PI * 34;
  const budgetShare = Math.min(1, a.ai.costUsd / a.ai.budgetUsd);

  return <main className="page an">
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

    <div className="an-row">
      <Bars title="Open cases by stage" total={open.length} items={byStage.map(s => ({ ...s, tone: s.stage }))} />
      <Bars title="Open cases by product line" total={open.length} items={byLine} />
    </div>

    <section className="an-card" aria-labelledby="due">
      <header><h2 id="due">Days until each change</h2><span className="an-legend"><i className="is-soon" />Under 30 days</span></header>
      <ul className="an-deadlines">
        {deadlines.map(c => <li key={c.id}>
          <Link href={`/cases/${c.id}`}>{c.material}</Link>
          <i><b className={c.daysLeft < 30 ? "is-soon" : undefined} style={{ width: `${Math.max(3, (c.daysLeft / maxDays) * 100)}%` }} /></i>
          <em>{c.daysLeft} d</em>
        </li>)}
        {deadlines.length === 0 && <li className="an-empty">No open cases</li>}
      </ul>
    </section>

    <section className="an-card" aria-labelledby="decided">
      <header><h2 id="decided">Plans agreed per month</h2><strong className="an-total">{months.reduce((n, m) => n + m.cases, 0)}</strong></header>
      <div className="an-months" role="img" aria-label="Number of plans agreed each month">
        {months.map(m => <div key={m.month} className={m.inPeriod ? undefined : "is-out"}>
          <span style={{ height: `${(m.cases / maxMonth) * 100}%` }} data-tip={`${m.label}: ${m.cases} ${m.cases === 1 ? "case" : "cases"}`} tabIndex={0}>{m.cases > 0 && <b>{m.cases}</b>}</span>
          <small>{m.label}</small>
        </div>)}
      </div>
    </section>

    <div className="an-row">
      <Bars title="Caught before sign-off" items={caught} />
      <section className="an-card an-spendcard" aria-labelledby="spend">
        <header><h2 id="spend">AI spend</h2></header>
        <div className="an-ring" role="meter" aria-valuemin={0} aria-valuemax={a.ai.budgetUsd} aria-valuenow={Number(a.ai.costUsd.toFixed(2))} aria-label="AI spend against the monthly budget">
          <svg width="96" height="96" viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r="34" fill="none" stroke="var(--sunken)" strokeWidth="9" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="var(--sage)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${Math.max(2, budgetShare * ring)} ${ring}`} transform="rotate(-90 40 40)" />
          </svg>
          <span><strong>{usd(a.ai.costUsd, 2)}</strong><small>of {usd(a.ai.budgetUsd)}</small></span>
        </div>
      </section>
    </div>
  </main>;
}

const stageLabel = { new: "New", review: "In review", ready: "Ready to send" } as const;

// One small horizontal bar chart: a label, a bar, the number.
function Bars({ title, items, total }: { title: string; items: { label: string; value: number; tone?: string }[]; total?: number }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return <section className="an-card">
    <header><h2>{title}</h2>{total !== undefined && <strong className="an-total">{total}</strong>}</header>
    <ul className="an-hbars">
      {items.map(i => <li key={i.label}>
        <strong>{i.label}</strong>
        <i><b className={i.tone ? `is-${i.tone}` : undefined} style={{ width: `${(i.value / max) * 100}%` }} /></i>
        <em>{i.value}</em>
      </li>)}
    </ul>
  </section>;
}
