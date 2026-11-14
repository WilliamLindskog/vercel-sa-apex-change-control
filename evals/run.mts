import { mkdir, writeFile } from "node:fs/promises";
import { handle } from "../apex-systems/lib/handler.js";
import type { Scenario } from "../lib/apex-systems";
import { assessSupplierChange } from "../lib/assessment";
import type { Disposition } from "../lib/case";

// AI behaviour check: runs the real assessment (AI SDK through AI Gateway) several times per scenario and
// measures two things separately:
//   - how good the model is on its own (status errors, invented citations, skipped products), and
//   - whether the final answer people see is right after the policy check (it must be, every time).
// Apex's systems are the in-process mock, so only model calls leave the machine.
//
// Run: npm run eval            (needs AI Gateway credentials: `vercel env pull .env.development.local`)
//      EVAL_RUNS=3 npm run eval

process.env.APEX_SYSTEMS_URL = "http://apex.test";
process.env.APEX_SYSTEMS_TOKEN = "eval-token";
process.env.APEX_SYSTEMS_LATENCY = "0";
globalThis.fetch = ((original: typeof fetch) => (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  return url.startsWith("http://apex.test") ? handle(new Request(input, init)) : original(input, init);
})(globalThis.fetch);

const RUNS = Number(process.env.EVAL_RUNS ?? 5);
// AI Gateway free credits are rate limited per minute; a pause keeps every run on the model instead of the fallback.
const PAUSE_MS = Number(process.env.EVAL_PAUSE_MS ?? 15_000);

// Ground truth for each scenario, written by hand from the records, not derived from the code under test.
const expected: Record<Scenario, Record<string, Disposition>> = {
  normal: { "FG-420-US": "requalification_required", "FG-420-EU": "requalification_required", "FG-088-US": "unaffected" },
  "missing-eu-qualification": { "FG-420-US": "requalification_required", "FG-420-EU": "uncertain", "FG-088-US": "unaffected" },
  "qms-outage": { "FG-420-US": "uncertain", "FG-420-EU": "uncertain", "FG-088-US": "unaffected" },
};

type Row = { scenario: Scenario; run: number; mode: string; model: string; finalCorrect: boolean; modelStatusErrors: number; inventedCitations: number; skipped: number; costUsd: number; latencyMs: number };

const rows: Row[] = [];
for (const scenario of Object.keys(expected) as Scenario[]) {
  for (let run = 1; run <= RUNS; run++) {
    if (rows.length) await new Promise(resolve => setTimeout(resolve, PAUSE_MS));
    const result = await assessSupplierChange(scenario, { requestedBy: "eval", aiRunsToday: 0 });
    const final = Object.fromEntries(result.assessment.findings.map(f => [f.finishedGood, f.disposition]));
    const finalCorrect = Object.entries(expected[scenario]).every(([id, d]) => final[id] === d) && result.assessment.findings.length === 3;
    const count = (pattern: RegExp) => result.corrections.filter(c => pattern.test(c)).length;
    rows.push({
      scenario, run, mode: result.mode, model: result.model.replace(" via AI Gateway", ""), finalCorrect,
      modelStatusErrors: count(/changed "/), inventedCitations: count(/removed citation/), skipped: count(/^Added /),
      costUsd: result.costUsd ?? 0, latencyMs: result.latencyMs,
    });
    const r = rows.at(-1)!;
    console.log(`${scenario.padEnd(26)} #${run}  ${r.mode.padEnd(10)} final ${r.finalCorrect ? "correct" : "WRONG  "}  model errors ${r.modelStatusErrors}  invented ${r.inventedCitations}  skipped ${r.skipped}  $${r.costUsd.toFixed(4)}  ${r.latencyMs} ms`);
  }
}

const ai = rows.filter(r => r.mode === "ai-gateway");
const findings = ai.length * 3;
const summary = {
  ranAt: new Date().toISOString(),
  runs: rows.length,
  aiRuns: ai.length,
  models: [...new Set(ai.map(r => r.model))],
  finalAnswerCorrect: `${rows.filter(r => r.finalCorrect).length}/${rows.length}`,
  modelStatusAccuracy: findings ? `${findings - ai.reduce((s, r) => s + r.modelStatusErrors + r.skipped, 0)}/${findings} findings` : "n/a",
  runsNeedingACorrection: `${ai.filter(r => r.modelStatusErrors + r.inventedCitations + r.skipped > 0).length}/${ai.length}`,
  inventedCitations: ai.reduce((s, r) => s + r.inventedCitations, 0),
  averageCostUsd: ai.length ? Number((ai.reduce((s, r) => s + r.costUsd, 0) / ai.length).toFixed(5)) : 0,
  averageLatencyMs: ai.length ? Math.round(ai.reduce((s, r) => s + r.latencyMs, 0) / ai.length) : 0,
  byScenario: Object.fromEntries((Object.keys(expected) as Scenario[]).map(s => {
    const subset = ai.filter(r => r.scenario === s);
    return [s, { modelStatusErrors: subset.reduce((n, r) => n + r.modelStatusErrors, 0), inventedCitations: subset.reduce((n, r) => n + r.inventedCitations, 0), runs: subset.length }];
  })),
};
console.log("\n" + JSON.stringify(summary, null, 2));
await mkdir(new URL("./results/", import.meta.url), { recursive: true });
await writeFile(new URL("./results/latest.json", import.meta.url), JSON.stringify({ summary, rows }, null, 2));
