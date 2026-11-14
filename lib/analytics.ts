import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import evalResults from "@/evals/results/latest.json";
import { boardCards } from "./board";

// Analytics for supplier changes. The page and the Helper's reports both read analytics(), so they always agree.
//
// Where the numbers come from:
// - Decided cases: a sample history (Jan to Jul handled the manual way, from Aug in the workspace).
//   "Before" is measured from the manual cases, not assumed.
// - AI cost and AI mistakes caught: measured in the AI test set (evals/results/latest.json).
// - Effort and rate: stated assumptions, shown on the page.

export const productLines = ["Coatings", "Plastics", "Inks"] as const;
export type ProductLine = (typeof productLines)[number];
export const periods = { q3: "Q3 2026", q4: "Q4 2026", ytd: "2026 to date" } as const;
export type Period = keyof typeof periods;

export const assumptions = {
  manualHours: 18,    // exports, look-ups, spreadsheet and email chasing per case
  workspaceHours: 3,  // reading the assessment and signing off
  hourlyRate: 95,     // loaded cost of a specialist hour, USD
  aiRunsPerCase: 2,   // first assessment plus one re-run on average
};
const ai = evalResults.summary;
const aiCostPerRun = ai.averageCostUsd;
const inventedPerRun = ai.inventedCitations / ai.runs;
const correctedShare = Number(ai.runsNeedingACorrection.split("/")[0]) / Number(ai.runsNeedingACorrection.split("/")[1]);

type Mode = "manual" | "workspace";
// [id, material, line, notice date, decided date, customer notices, notices late, records missing]
type Row = [string, string, ProductLine, string, string, number, number, number];
const manual: Row[] = [
  ["SCC-2026-003", "Resin R-40", "Coatings", "2026-01-08", "2026-01-26", 3, 1, 0],
  ["SCC-2026-005", "Talc T-7", "Plastics", "2026-01-19", "2026-02-02", 2, 0, 0],
  ["SCC-2026-007", "Pigment PY-74", "Inks", "2026-02-04", "2026-02-25", 4, 1, 0],
  ["SCC-2026-009", "Wax W-180", "Coatings", "2026-02-23", "2026-03-09", 1, 0, 0],
  ["SCC-2026-011", "Stabiliser S-2", "Plastics", "2026-03-10", "2026-03-27", 3, 1, 0],
  ["SCC-2026-013", "Binder X-12", "Coatings", "2026-03-30", "2026-04-13", 2, 0, 0],
  ["SCC-2026-015", "Varnish V-9", "Inks", "2026-04-15", "2026-05-06", 5, 2, 0],
  ["SCC-2026-017", "Filler F-3", "Plastics", "2026-05-04", "2026-05-15", 1, 0, 0],
  ["SCC-2026-019", "Dispersant PD-2", "Coatings", "2026-05-26", "2026-06-12", 3, 1, 0],
  ["SCC-2026-021", "Pigment PR-57", "Inks", "2026-06-09", "2026-06-24", 2, 0, 0],
  ["SCC-2026-023", "Slip agent E-5", "Plastics", "2026-06-29", "2026-07-17", 4, 1, 0],
  ["SCC-2026-025", "Matting agent M-1", "Coatings", "2026-07-13", "2026-07-27", 2, 0, 0],
];
const workspace: Row[] = [
  ["SCC-2026-027", "Silica SX-4", "Coatings", "2026-08-03", "2026-08-05", 2, 0, 1],
  ["SCC-2026-029", "Antioxidant AO-12", "Plastics", "2026-08-11", "2026-08-12", 0, 0, 0],
  ["SCC-2026-030", "Pigment PB-7", "Inks", "2026-08-24", "2026-08-26", 3, 0, 0],
  ["SCC-2026-031", "Wax W-200", "Coatings", "2026-09-01", "2026-09-03", 1, 0, 1],
  ["SCC-2026-033", "Dispersant PD-4", "Coatings", "2026-09-02", "2026-09-04", 4, 0, 1],
  ["SCC-2026-034", "UV absorber U-3", "Plastics", "2026-09-21", "2026-09-22", 2, 0, 0],
  ["SCC-2026-035", "Varnish V-12", "Inks", "2026-10-05", "2026-10-08", 3, 0, 1],
  ["SCC-2026-036", "Talc T-9", "Plastics", "2026-10-14", "2026-10-15", 1, 0, 0],
  ["SCC-2026-037", "Resin R-44", "Coatings", "2026-10-16", "2026-10-18", 2, 0, 0],
  ["SCC-2026-039", "Pigment PY-83", "Inks", "2026-11-02", "2026-11-04", 2, 0, 1],
];

const DAY = 86_400_000;
const days = (from: string, to: string) => Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / DAY));
const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b), mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const inPeriod = (date: string, period: Period) => {
  const month = Number(date.slice(5, 7));
  return period === "ytd" || (period === "q3" ? month >= 7 && month <= 9 : month >= 10);
};

const decided = [...manual.map(r => [...r, "manual"] as const), ...workspace.map(r => [...r, "workspace"] as const)]
  .map(([id, material, line, opened, decidedOn, notices, late, missing, mode]) => ({
    id, material, line, opened, decided: decidedOn, notices, late, missing, mode: mode as Mode, days: days(opened, decidedOn),
  }));
export type DecidedCase = (typeof decided)[number];

// Decided-case history for a period and product line. Same for everyone and only changes when a case is
// decided, so it is cached and tagged; a decision event calls revalidateTag("analytics").
async function history(period: Period, line?: ProductLine) {
  "use cache";
  cacheTag("analytics");
  cacheLife("hours");
  const ofLine = decided.filter(c => !line || c.line === line);
  const before = ofLine.filter(c => c.mode === "manual");
  const scope = ofLine.filter(c => c.mode === "workspace" && inPeriod(c.decided, period));
  const baselineDays = median(before.map(c => c.days));
  const workspaceDays = median(scope.map(c => c.days));

  const aiRuns = scope.length * assumptions.aiRunsPerCase;
  const aiCost = aiRuns * aiCostPerRun;
  const hoursSaved = scope.length * (assumptions.manualHours - assumptions.workspaceHours);
  const notices = scope.reduce((n, c) => n + c.notices, 0);
  const noticesLate = scope.reduce((n, c) => n + c.late, 0);
  const beforeNotices = before.reduce((n, c) => n + c.notices, 0);
  const beforeLate = before.reduce((n, c) => n + c.late, 0);

  // Median days to decision for every month of 2026 so far, for the trend chart.
  const months = Array.from({ length: 11 }, (_, i) => {
    const key = `2026-${String(i + 1).padStart(2, "0")}`;
    const of = ofLine.filter(c => c.decided.startsWith(key));
    return { month: key, label: new Date(Date.UTC(2026, i, 1)).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }), cases: of.length, days: of.length ? median(of.map(c => c.days)) : null, mode: of[0]?.mode ?? null, inPeriod: inPeriod(`${key}-15`, period) };
  });

  const byLine = productLines.filter(l => !line || l === line).map(l => {
    const of = decided.filter(c => c.line === l && c.mode === "workspace" && inPeriod(c.decided, period));
    return { line: l, cases: of.length, medianDays: median(of.map(c => c.days)), before: median(decided.filter(c => c.line === l && c.mode === "manual").map(c => c.days)), hoursSaved: of.length * (assumptions.manualHours - assumptions.workspaceHours) };
  });

  return {
    filter: { period, periodLabel: periods[period], line: line ?? "All product lines" },
    cases: scope.length,
    daysToDecision: { workspace: workspaceDays, before: baselineDays, daysSaved: Math.round(scope.reduce((n, c) => n + Math.max(0, baselineDays - c.days), 0)) },
    effort: { hoursSaved, costSavedUsd: Math.round(hoursSaved * assumptions.hourlyRate - aiCost) },
    notices: { total: notices, onTime: notices - noticesLate, onTimeShare: notices ? (notices - noticesLate) / notices : 1, beforeOnTimeShare: beforeNotices ? (beforeNotices - beforeLate) / beforeNotices : 1 },
    caught: {
      missingRecords: scope.reduce((n, c) => n + c.missing, 0),
      inventedCitations: Math.round(aiRuns * inventedPerRun),
      modelCorrections: Math.round(aiRuns * correctedShare),
    },
    ai: { runs: aiRuns, costUsd: aiCost, costPerRunUsd: aiCostPerRun, model: ai.models[0], budgetUsd: 5 },
    months,
    // Every decided case for the line, oldest first, for the "each decision" chart.
    timeline: [...ofLine].sort((x, y) => x.decided.localeCompare(y.decided)).map(c => ({ id: c.id, material: c.material, decided: c.decided, days: c.days, mode: c.mode, inPeriod: c.mode === "manual" || inPeriod(c.decided, period) })),
    byLine,
    decided: scope.map(({ id, material, line, days }) => ({ id, material, line, days })),
  };
}

// History (cached) plus what is in flight right now (live, per request).
export async function analytics({ period = "ytd", line }: { period?: Period; line?: ProductLine } = {}) {
  await connection(); // "in flight" and days left are about now, so this part is request time
  const [past, cards] = await Promise.all([history(period, line), boardCards()]);
  const open = cards.filter(c => c.stage !== "done" && (!line || c.line === line));
  const daysLeft = (due: string) => Math.ceil((Date.parse(due) - Date.now()) / DAY);
  return {
    ...past,
    byLine: past.byLine.map(r => ({ ...r, open: open.filter(c => c.line === r.line).length })),
    inFlight: { count: open.length, dueSoon: open.filter(c => daysLeft(c.due) < 30).length, cases: open.map(c => ({ id: c.id, material: c.material, line: c.line, stage: c.stage, blocked: c.blocked, daysLeft: daysLeft(c.due) })) },
  };
}
export type Analytics = Awaited<ReturnType<typeof analytics>>;
