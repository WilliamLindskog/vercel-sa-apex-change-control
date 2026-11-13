import { gateway, type GatewayProviderOptions } from "@ai-sdk/gateway";
import { generateText, Output, stepCountIs, tool } from "ai";
import { z } from "zod";
import { ApexSystemError, apexSession, type ApexSession, type Scenario, type SourceRecord } from "./apex-systems";
import { assessmentSchema, marketLabel, supplierChange, supplierDocuments, type Assessment, type AssessmentRun, type Disposition, type Finding } from "./case";

// How the assessment works, in three layers:
//   1. The agent (AI SDK + AI Gateway) plans the cross-system lookup with tools and writes the assessment.
//   2. A deterministic policy check re-derives each product's status from the records actually retrieved
//      and corrects anything that disagrees. Safety-critical fields never rest on the model alone.
//   3. People sign off. Nothing here approves or routes a change.
// Without a model (no gateway credentials, or every model failed) layer 2 writes the assessment on its own.

// Model IDs come from the live list at https://ai-gateway.vercel.sh/v1/models (checked 13 Nov 2026).
// gpt-5.4-nano is the primary because it is available on AI Gateway free credits and handles tool calls well.
// Haiku 5.5 is cheaper per token but needs paid credits; set ASSESSMENT_MODEL to switch once credits are topped up.
const PRIMARY_MODEL = process.env.ASSESSMENT_MODEL ?? "openai/gpt-5.4-nano";
// Gateway tries these in order if the primary model errors, is degraded or is not available to the account.
// One provider outage should not stop a supplier-change review.
const FALLBACK_MODELS = ["google/gemini-3.8-flash", "anthropic/claude-haiku-5.5"].filter(id => id !== PRIMARY_MODEL);

// USD per million tokens, from the live model list (13 Nov 2026). Used only for the on-page estimate; the exact
// billed cost is in AI Gateway's usage view, which is updated about 90 seconds after a request.
const PRICES: Record<string, { input: number; output: number }> = {
  "openai/gpt-5.4-nano": { input: 0.2, output: 1.25 },
  "google/gemini-3.8-flash": { input: 0.75, output: 3.75 },
  "anthropic/claude-haiku-5.5": { input: 0.1, output: 0.5 },
};

// On Vercel, functions authenticate to AI Gateway with the deployment's OIDC token, which arrives per request
// rather than as an environment variable, so being on Vercel is enough. Locally it comes from `vercel env pull`.
const aiAvailable = () => Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL);

// Spend guards inside the app. The hard ceiling is the AI Gateway budget on the Vercel project; these keep a
// public demo with shared test logins from burning through it with repeated clicks.
const AI_RUNS_PER_CASE_PER_DAY = Number(process.env.AI_RUNS_PER_CASE_PER_DAY ?? 20);
const MAX_AGENT_STEPS = 8;        // each step is one model call; 3 to 5 are normal for this case
const MAX_OUTPUT_TOKENS = 2_000;  // per model call; the assessment itself is well under 1,000

type StepMeta = { usage: { inputTokens?: number; outputTokens?: number }; providerMetadata?: Record<string, unknown> };

// Which model actually answered each model call, from Gateway's routing record, and what the run cost.
// The SDK's response.modelId echoes the requested model even when Gateway fell back to another one.
function servedAndCost(steps: StepMeta[]) {
  let costUsd = 0;
  const servedBy = new Set<string>();
  for (const step of steps) {
    const routing = (step.providerMetadata?.gateway as { routing?: { modelAttempts?: { canonicalSlug: string; success: boolean }[] } } | undefined)?.routing;
    const model = routing?.modelAttempts?.find(attempt => attempt.success)?.canonicalSlug ?? PRIMARY_MODEL;
    servedBy.add(model);
    const price = PRICES[model];
    if (price) costUsd += ((step.usage.inputTokens ?? 0) * price.input + (step.usage.outputTokens ?? 0) * price.output) / 1_000_000;
  }
  return { servedBy: [...servedBy], costUsd };
}

type Fact = {
  finishedGood: string;
  product: string;
  market: "US" | "EU";
  usesMaterial: boolean;
  expected: Disposition;
  evidence: string[];
  noticeDays: number | null;
  reason: string;
  openQuestion?: { owner: "Quality" | "Regulatory Affairs"; detail: string };
};

// The policy, written as code so it can be read, tested and defended. It only uses what the systems returned.
async function establishFacts(session: ApexSession): Promise<Fact[]> {
  await session.material(supplierChange.material);
  const used = await session.whereUsed(supplierChange.material);
  // Purchasing's list and the ERP where-used list can disagree. Check the union of both.
  const scope = [...new Set([...supplierChange.candidates, ...used.map(u => u.finishedGood)])];
  const facts: Fact[] = [];

  for (const finishedGood of scope) {
    const usage = used.find(u => u.finishedGood === finishedGood);
    if (!usage) {
      const good = await session.finishedGood(finishedGood);
      facts.push({ finishedGood, product: good?.product ?? finishedGood, market: (good?.market ?? "US") as "US" | "EU", usesMaterial: false, expected: "unaffected", evidence: [finishedGood], noticeDays: null, reason: `The bill of materials does not contain ${supplierChange.material}.` });
      continue;
    }

    const rules = await session.notificationRules(usage.market);
    const noticeDays = rules[0]?.noticeDays ?? null;
    const ruleIds = rules.map(r => r.id);
    const market = usage.market as "US" | "EU";

    try {
      const records = await session.qualifications(finishedGood);
      const qualification = records.find(q => q.effective && q.material === supplierChange.material);
      if (qualification) {
        facts.push({ finishedGood, product: usage.product, market, usesMaterial: true, expected: "requalification_required", evidence: [qualification.id, "SUP-02", ...ruleIds], noticeDays, reason: `${qualification.id} covers Binder X-17 only, and X-17R has a revised stabilizer package.` });
      } else {
        facts.push({
          finishedGood, product: usage.product, market, usesMaterial: true, expected: "uncertain", evidence: [finishedGood, "SUP-01", ...ruleIds], noticeDays,
          reason: "The quality system returned no effective qualification record, so approved use cannot be established.",
          openQuestion: { owner: "Regulatory Affairs", detail: `No qualification record for ${finishedGood} in ${marketLabel(market)}. Recover or verify it before any decision.` },
        });
      }
    } catch (error) {
      if (!(error instanceof ApexSystemError)) throw error;
      facts.push({
        finishedGood, product: usage.product, market, usesMaterial: true, expected: "uncertain", evidence: [finishedGood, ...ruleIds], noticeDays,
        reason: `The quality system was unavailable (${error.status}), so qualification status is unknown.`,
        openQuestion: { owner: "Quality", detail: `Qualification status for ${finishedGood} could not be read from the QMS. Re-run once it is available.` },
      });
    }
  }
  return facts;
}

function rulesAssessment(facts: Fact[]): Assessment {
  const affected = facts.filter(f => f.usesMaterial);
  const uncertain = facts.filter(f => f.expected === "uncertain");
  return {
    summary: uncertain.length
      ? `${uncertain.map(f => `${f.product} (${marketLabel(f.market)})`).join(" and ")} cannot be decided until a missing record is resolved. ${affected.length - uncertain.length} other use needs requalification before X-17R ships.`
      : `X-17R cannot be used as a direct substitute. ${affected.length} product-market uses need requalification and customer notice; ${facts.length - affected.length} flagged product is unaffected.`,
    findings: facts.map(f => ({ finishedGood: f.finishedGood, product: f.product, market: f.market, disposition: f.expected, rationale: f.reason, evidenceIds: f.evidence, noticeDays: f.noticeDays })),
    openQuestions: facts.flatMap(f => (f.openQuestion ? [{ finishedGood: f.finishedGood, ...f.openQuestion }] : [])),
  };
}

// Layer 2: hold the model to the records. Every correction is kept and shown, so reviewers can see where the model was overruled.
function enforcePolicy(draft: Assessment, facts: Fact[], known: Set<string>) {
  const corrections: string[] = [];
  const findings: Finding[] = [];

  for (const fact of facts) {
    const proposed = draft.findings.find(f => f.finishedGood === fact.finishedGood);
    if (!proposed) {
      corrections.push(`Added ${fact.finishedGood}: the model did not assess it.`);
      findings.push({ finishedGood: fact.finishedGood, product: fact.product, market: fact.market, disposition: fact.expected, rationale: fact.reason, evidenceIds: fact.evidence, noticeDays: fact.noticeDays });
      continue;
    }
    let { disposition, rationale } = proposed;
    if (disposition !== fact.expected) {
      corrections.push(`${fact.finishedGood}: changed "${disposition}" to "${fact.expected}" to match the records.`);
      disposition = fact.expected;
      rationale = fact.reason;
    }
    const cited = proposed.evidenceIds.filter(id => known.has(id));
    for (const id of proposed.evidenceIds.filter(id => !known.has(id))) corrections.push(`${fact.finishedGood}: removed citation ${id}, which no Apex system returned.`);
    findings.push({ ...proposed, product: fact.product, market: fact.market, disposition, rationale, evidenceIds: cited.length ? cited : fact.evidence, noticeDays: fact.noticeDays });
  }
  for (const extra of draft.findings.filter(f => !facts.some(fact => fact.finishedGood === f.finishedGood))) {
    corrections.push(`Dropped ${extra.finishedGood}: it is not in scope for this material.`);
  }

  // Every uncertain product keeps the policy's open question first, so the owner the policy names is the one
  // asked to act. The model's extra questions follow, as long as they concern a product that is really uncertain.
  const openQuestions = [
    ...facts.filter(f => f.openQuestion).map(f => ({ finishedGood: f.finishedGood, ...f.openQuestion! })),
    ...draft.openQuestions.filter(q => facts.some(f => f.finishedGood === q.finishedGood && f.expected === "uncertain" && f.openQuestion?.owner !== q.owner)),
  ];
  return { assessment: { summary: draft.summary, findings, openQuestions }, corrections };
}

// Layer 1: the agent. Tools are read-only and scoped to the three systems; the model never gets a write path.
async function runAgent(session: ApexSession, requestedBy: string) {
  const safe = <T>(fn: () => Promise<T>) => fn().catch(error => {
    if (error instanceof ApexSystemError) return { error: `${error.system} unavailable (HTTP ${error.status}). Treat the affected data as unknown.` };
    throw error;
  });

  const tools = {
    lookupMaterial: tool({ description: "ERP material master: supplier and supply end date for a raw material.", inputSchema: z.object({ material: z.string() }), execute: ({ material }) => safe(() => session.material(material)) }),
    findWhereUsed: tool({ description: "ERP where-used: every finished good whose recipe contains a raw material, with its market.", inputSchema: z.object({ material: z.string() }), execute: ({ material }) => safe(() => session.whereUsed(material)) }),
    getBillOfMaterials: tool({ description: "ERP bill of materials for a finished good. Use to confirm a product does NOT use a material.", inputSchema: z.object({ finishedGood: z.string() }), execute: ({ finishedGood }) => safe(() => session.finishedGood(finishedGood)) }),
    findQualifications: tool({ description: "QMS qualification records for a finished good. An empty list means no record exists.", inputSchema: z.object({ finishedGood: z.string() }), execute: ({ finishedGood }) => safe(() => session.qualifications(finishedGood)) }),
    getNotificationRules: tool({ description: "Regulatory customer-notification rules for formulation changes in a market.", inputSchema: z.object({ market: z.enum(["US", "EU"]) }), execute: ({ market }) => safe(() => session.notificationRules(market)) }),
  };

  return generateText({
    model: gateway(PRIMARY_MODEL),
    providerOptions: {
      gateway: {
        models: FALLBACK_MODELS,
        // Reporting dimensions: spend per person and per feature shows up in AI Gateway usage.
        user: requestedBy,
        tags: ["supplier-change-assessment", `case:${supplierChange.id}`],
      } satisfies GatewayProviderOptions,
    },
    temperature: 0,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    tools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    abortSignal: AbortSignal.timeout(60_000),
    output: Output.object({ schema: assessmentSchema }),
    system: [
      "You assess supplier changes for Apex Additives' Product Change Control team. You never approve or route a change; people do.",
      "Use the tools to check every flagged product: whether it uses the material (ERP), whether it has an effective qualification (QMS), and the customer notice rule for its market (Regulatory).",
      "Every finding must cite the IDs of records the tools returned, or the supplier documents SUP-01 and SUP-02. Never invent IDs.",
      "If a record is missing or a system is unavailable, the disposition is 'uncertain' and you add an open question with an owner. Do not guess.",
    ].join("\n"),
    prompt: [
      `Case ${supplierChange.id}: ${supplierChange.change} ${supplierChange.materialImpact}`,
      `Raw material: ${supplierChange.material}. Supply ends ${supplierChange.deadline}.`,
      `Products flagged by Purchasing: ${supplierChange.candidates.join(", ")}.`,
      `Supplier documents: ${supplierDocuments.map(d => `${d.id} (${d.detail})`).join(" ")}`,
    ].join("\n"),
  });
}

export async function assessSupplierChange(scenario: Scenario, options: { requestedBy: string; aiRunsToday: number }): Promise<AssessmentRun> {
  const started = performance.now();
  const session = apexSession(scenario);
  const finish = (partial: Omit<AssessmentRun, "sources" | "calls" | "latencyMs" | "completedAt">): AssessmentRun => ({
    ...partial,
    sources: [...supplierDocuments, ...session.sources.values()] as SourceRecord[],
    calls: session.calls,
    latencyMs: Math.round(performance.now() - started),
    completedAt: new Date().toISOString(),
  });

  if (!aiAvailable()) {
    const facts = await establishFacts(session);
    return finish({ assessment: rulesAssessment(facts), mode: "rules-only", model: "Policy rules (no model configured)", fallbackReason: "No AI Gateway credentials in this environment.", corrections: [] });
  }
  if (options.aiRunsToday >= AI_RUNS_PER_CASE_PER_DAY) {
    const facts = await establishFacts(session);
    return finish({ assessment: rulesAssessment(facts), mode: "rules-only", model: "Policy rules (daily AI limit reached)", fallbackReason: `This case has used its ${AI_RUNS_PER_CASE_PER_DAY} AI runs for today. The policy rules still give a complete, cited answer.`, corrections: [] });
  }

  try {
    const result = await runAgent(session, options.requestedBy);
    const facts = await establishFacts(session); // reuses the agent's cached lookups; fills any gaps
    const known = new Set([...supplierDocuments.map(d => d.id), ...session.sources.keys()]);
    const { assessment, corrections } = enforcePolicy(result.output, facts, known);
    const generationIds = result.steps.map(step => (step.providerMetadata?.gateway as { generationId?: string } | undefined)?.generationId).filter((id): id is string => Boolean(id));
    const { costUsd, servedBy } = servedAndCost(result.steps as StepMeta[]);
    return finish({
      assessment, corrections, mode: "ai-gateway",
      model: `${servedBy.join(", ")} via AI Gateway`,
      requestedModel: PRIMARY_MODEL,
      usage: { inputTokens: result.totalUsage.inputTokens, outputTokens: result.totalUsage.outputTokens },
      modelCalls: result.steps.length,
      costUsd,
      generationId: generationIds.at(-1),
    });
  } catch (error) {
    // Every model in the fallback chain failed, or the output did not match the schema. The policy still
    // produces a safe, fully cited assessment, and the run says plainly that no model was involved.
    console.error("assessment_model_failed", { case: supplierChange.id, error: error instanceof Error ? error.message : String(error) });
    const facts = await establishFacts(session);
    return finish({ assessment: rulesAssessment(facts), mode: "rules-only", model: "Policy rules (model unavailable)", fallbackReason: error instanceof Error ? error.message.slice(0, 200) : "Model call failed.", corrections: [] });
  }
}
