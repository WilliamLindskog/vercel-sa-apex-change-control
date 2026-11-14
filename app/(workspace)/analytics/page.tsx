import type { Metadata } from "next";
import Link from "next/link";
import { analytics, assumptions, periods, productLines, type Period, type ProductLine } from "@/lib/analytics";
import { requireUser } from "@/lib/session";
import "./analytics.css";

export const metadata: Metadata = { title: "Analytics" };

const usd = (n: number, digits = 0) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits });
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ period?: string; line?: string }> }) {
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
    { label: "Missing records found", value: a.caught.missingRecords, note: "e.g. no EU qualification on file" },
    { label: "Invented citations removed", value: a.caught.inventedCitations, note: "record IDs the model made up" },
    { label: "Model answers corrected", value: a.caught.modelCorrections, note: "by the policy check" },
  ];
  const maxCaught = Math.max(...caught.map(c => c.value), 1);
  const budgetShare = Math.min(1, a.ai.costUsd / a.ai.budgetUsd);

  return <>
    <header className="topbar"><nav className="breadcrumb" aria-label="Breadcrumb"><span aria-current="page">Analytics</span></nav></header>
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
        <div><span>Days to decision</span><strong>{a.cases ? a.daysToDecision.workspace : "—"}</strong><small>was {a.daysToDecision.before} days before the workspace</small></div>
        <div><span>Specialist time saved</span><strong>{a.effort.hoursSaved} h</strong><small>{a.cases} {a.cases === 1 ? "case" : "cases"} decided · {a.daysToDecision.daysSaved} calendar days sooner</small></div>
        <div><span>Cost saved</span><strong>{usd(a.effort.costSavedUsd)}</strong><small>after {usd(a.ai.costUsd, 3)} of AI</small></div>
        <div><span>Customer notices on time</span><strong>{pct(a.notices.onTimeShare)}</strong><small>{a.notices.onTime} of {a.notices.total} · was {pct(a.notices.beforeOnTimeShare)}</small></div>
      </section>

      <section className="an-card" aria-labelledby="trend">
        <header><h2 id="trend">Days from supplier notice to decision</h2><span className="an-legend"><i className="is-manual" />Manual <i className="is-ws" />Workspace <i className="is-base" />Before ({a.daysToDecision.before} d)</span></header>
        <div className="an-bars" role="img" aria-label={`Median days to decision by month. Manual months around ${a.daysToDecision.before} days, workspace months around ${a.daysToDecision.workspace || 2} days.`}>
          <i className="an-base" style={{ bottom: `calc(22px + (100% - 22px) * ${a.daysToDecision.before / maxDays})` }} />
          {a.months.map(m => <div key={m.month} className={`an-bar ${m.inPeriod ? "" : "is-out"}`}>
            {m.days !== null
              ? <span className={`is-${m.mode}`} style={{ height: `${(m.days / maxDays) * 100}%` }} data-tip={`${m.label}: ${m.days} days · ${m.cases} ${m.cases === 1 ? "case" : "cases"}`} tabIndex={0} />
              : <span className="is-none" data-tip={`${m.label}: no cases`} tabIndex={0} />}
            <b>{m.label}</b>
          </div>)}
        </div>
      </section>

      <div className="an-pair">
        <section className="an-card" aria-labelledby="caught">
          <header><h2 id="caught">Problems caught before sign-off</h2></header>
          <ul className="an-hbars">
            {caught.map(c => <li key={c.label}>
              <span><strong>{c.label}</strong><small>{c.note}</small></span>
              <i><b style={{ width: `${(c.value / maxCaught) * 100}%` }} /></i>
              <em>{c.value}</em>
            </li>)}
          </ul>
          <p className="an-foot">{a.inFlight.count} cases in flight{a.inFlight.dueSoon ? `, ${a.inFlight.dueSoon} due within 30 days` : ""}.</p>
        </section>

        <section className="an-card" aria-labelledby="spend">
          <header><h2 id="spend">AI spend</h2></header>
          <div className="an-spend">
            <strong>{usd(a.ai.costUsd, 3)}</strong><span>of the {usd(a.ai.budgetUsd)} monthly budget</span>
          </div>
          <div className="an-meter" role="meter" aria-valuemin={0} aria-valuemax={a.ai.budgetUsd} aria-valuenow={Number(a.ai.costUsd.toFixed(2))} aria-label="AI spend against budget"><i style={{ width: `max(4px, ${budgetShare * 100}%)` }} /></div>
          <dl className="an-dl">
            <div><dt>Assessments run</dt><dd>{a.ai.runs}</dd></div>
            <div><dt>Cost per assessment</dt><dd>{usd(a.ai.costPerRunUsd, 4)}</dd></div>
            <div><dt>Model</dt><dd>{a.ai.model}</dd></div>
          </dl>
        </section>
      </div>

      <section className="an-card" aria-labelledby="lines">
        <header><h2 id="lines">By product line</h2></header>
        <div className="table-wrap an-table">
          <table>
            <thead><tr><th>Product line</th><th>Decided</th><th>Days to decision</th><th>Before</th><th>Time saved</th><th>In flight</th></tr></thead>
            <tbody>{a.byLine.map(r => <tr key={r.line}>
              <td><Link href={href({ line: r.line })}>{r.line}</Link></td><td>{r.cases}</td><td>{r.cases ? r.medianDays : "—"}</td><td>{r.before}</td><td>{r.hoursSaved} h</td><td>{r.open}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <p className="an-note">Sample history: cases from January to July were handled the manual way; from August in the workspace. AI cost and AI mistakes are measured in the AI test set. Assumed effort: {assumptions.manualHours} h per case manually, {assumptions.workspaceHours} h in the workspace, at {usd(assumptions.hourlyRate)} an hour. Ask Helper to draft a report for any period or product line.</p>
    </main>
  </>;
}
