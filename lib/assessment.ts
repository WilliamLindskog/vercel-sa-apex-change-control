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

export type Fact = {
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
export async function establishFacts(session: ApexSession): Promise<Fact[]> {
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

export function rulesAssessment(facts: Fact[]): Assessment {
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
export function enforcePolicy(draft: Assessment, facts: Fact[], known: Set<string>) {
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
    // The records the policy relied on are always cited, alongside any valid ones the model chose,
    // so every finding carries its key evidence (for example the qualification record) whatever the model cited.
    findings.push({ ...proposed, product: fact.product, market: fact.market, disposition, rationale, evidenceIds: [...new Set([...cited, ...fact.evidence])], noticeDays: fact.noticeDays });
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

// Layer 1: the agent. Prompt, tools and output shape are defined once and used by both runners:
// the durable one inside the case workflow (workflows/assessment.ts) and the direct one below (used by the evals).
// Tools are read-only and scoped to the three systems; the model never gets a write path.

export const AGENT_INSTRUCTIONS = [
  "You assess supplier changes for Apex Additives' Product Change Control team. You never approve or route a change; people do.",
  "Use the tools to check every flagged product: whether it uses the material (ERP), whether it has an effective qualification (QMS), and the customer notice rule for its market (Regulatory).",
  "Every finding must cite the IDs of records the tools returned, or the supplier documents SUP-01 and SUP-02. Never invent IDs.",
  "If a record is missing or a system is unavailable, the disposition is 'uncertain' and you add an open question with an owner. Do not guess.",
].join("\n");

export const agentPrompt = () => [
  `Case ${supplierChange.id}: ${supplierChange.change} ${supplierChange.materialImpact}`,
  `Raw material: ${supplierChange.material}. Supply ends ${supplierChange.deadline}.`,
  `Products flagged by Purchasing: ${supplierChange.candidates.join(", ")}.`,
  `Supplier documents: ${supplierDocuments.map(d => `${d.id} (${d.detail})`).join(" ")}`,
].join("\n");

export const agentTools = {
  lookupMaterial: { description: "ERP material master: supplier and supply end date for a raw material.", inputSchema: z.object({ material: z.string() }) },
  findWhereUsed: { description: "ERP where-used: every finished good whose recipe contains a raw material, with its market.", inputSchema: z.object({ material: z.string() }) },
  getBillOfMaterials: { description: "ERP bill of materials for a finished good. Use to confirm a product does NOT use a material.", inputSchema: z.object({ finishedGood: z.string() }) },
  findQualifications: { description: "QMS qualification records for a finished good. An empty list means no record exists.", inputSchema: z.object({ finishedGood: z.string() }) },
  getNotificationRules: { description: "Regulatory customer-notification rules for formulation changes in a market.", inputSchema: z.object({ market: z.enum(["US", "EU"]) }) },
} as const;
export type AgentToolName = keyof typeof agentTools;

// Runs one tool against Apex's systems. A system outage becomes data the model can reason about, not a crash.
export async function runAgentTool(session: ApexSession, name: AgentToolName, input: Record<string, string>) {
  try {
    switch (name) {
      case "lookupMaterial": return await session.material(input.material);
      case "findWhereUsed": return await session.whereUsed(input.material);
      case "getBillOfMaterials": return await session.finishedGood(input.finishedGood);
      case "findQualifications": return await session.qualifications(input.finishedGood);
      case "getNotificationRules": return await session.notificationRules(input.market);
    }
  } catch (error) {
    if (error instanceof ApexSystemError) return { error: `${error.system} unavailable (HTTP ${error.status}). Treat the affected data as unknown.` };
    throw error;
  }
}

export const agentGatewayOptions = (requestedBy: string) => ({
  gateway: {
    models: FALLBACK_MODELS,
    // Reporting dimensions: spend per person and per feature shows up in AI Gateway usage.
    user: requestedBy,
    tags: ["supplier-change-assessment", `case:${supplierChange.id}`],
  } satisfies GatewayProviderOptions,
});

// Decides, outside any workflow, whether this run may use a model at all.
export function modelPlan(aiRunsToday: number): { useModel: true; model: string; maxSteps: number; maxOutputTokens: number } | { useModel: false; model: string; reason: string } {
  if (!aiAvailable()) return { useModel: false, model: "Policy rules (no model configured)", reason: "No AI Gateway credentials in this environment." };
  if (aiRunsToday >= AI_RUNS_PER_CASE_PER_DAY) return { useModel: false, model: "Policy rules (daily AI limit reached)", reason: `This case has used its ${AI_RUNS_PER_CASE_PER_DAY} AI runs for today. The policy rules still give a complete, cited answer.` };
  return { useModel: true, model: PRIMARY_MODEL, maxSteps: MAX_AGENT_STEPS, maxOutputTokens: MAX_OUTPUT_TOKENS };
}

// Layer 2 as a finished run: re-read the records independently, hold the model's draft to them, and price the run.
export async function policyCheckedRun(input: { scenario: Scenario; draft: Assessment; agentSources: SourceRecord[]; agentCalls: ApexSession["calls"]; steps: StepMeta[]; startedAt: number }): Promise<AssessmentRun> {
  const session = apexSession(input.scenario);
  const facts = await establishFacts(session);
  const known = new Set([...supplierDocuments.map(d => d.id), ...input.agentSources.map(s => s.id), ...session.sources.keys()]);
  const { assessment, corrections } = enforcePolicy(input.draft, facts, known);
  const { costUsd, servedBy } = servedAndCost(input.steps);
  const sources = new Map<string, SourceRecord>([...supplierDocuments, ...input.agentSources, ...session.sources.values()].map(s => [s.id, s]));
  const generationIds = input.steps.map(step => (step.providerMetadata?.gateway as { generationId?: string } | undefined)?.generationId).filter((id): id is string => Boolean(id));
  return {
    assessment, corrections, mode: "ai-gateway",
    model: `${servedBy.join(", ")} via AI Gateway`,
    requestedModel: PRIMARY_MODEL,
    usage: input.steps.reduce((sum, step) => ({ inputTokens: (sum.inputTokens ?? 0) + (step.usage.inputTokens ?? 0), outputTokens: (sum.outputTokens ?? 0) + (step.usage.outputTokens ?? 0) }), { inputTokens: 0, outputTokens: 0 } as { inputTokens?: number; outputTokens?: number }),
    modelCalls: input.steps.length,
    costUsd,
    generationId: generationIds.at(-1),
    sources: [...sources.values()],
    calls: [...input.agentCalls, ...session.calls],
    latencyMs: Date.now() - input.startedAt,
    completedAt: new Date().toISOString(),
  };
}

// The safe answer without a model: the policy alone, fully cited, and saying plainly why no model was used.
export async function rulesOnlyRun(scenario: Scenario, model: string, reason: string, startedAt = Date.now()): Promise<AssessmentRun> {
  const session = apexSession(scenario);
  const facts = await establishFacts(session);
  return {
    assessment: rulesAssessment(facts), mode: "rules-only", model, fallbackReason: reason, corrections: [],
    sources: [...supplierDocuments, ...session.sources.values()], calls: session.calls,
    latencyMs: Date.now() - startedAt, completedAt: new Date().toISOString(),
  };
}

// Direct runner: one call, no workflow. Used by the AI test set (evals/run.mts), which exercises the same prompt,
// tools and policy as the durable runner without needing a Workflow world.
export async function assessSupplierChange(scenario: Scenario, options: { requestedBy: string; aiRunsToday: number }): Promise<AssessmentRun> {
  const startedAt = Date.now();
  const plan = modelPlan(options.aiRunsToday);
  if (!plan.useModel) return rulesOnlyRun(scenario, plan.model, plan.reason, startedAt);

  const session = apexSession(scenario);
  const tools = Object.fromEntries((Object.keys(agentTools) as AgentToolName[]).map(name => [name, tool({
    ...agentTools[name],
    execute: (input: Record<string, string>) => runAgentTool(session, name, input),
  } as never)]));
  try {
    const result = await generateText({
      model: gateway(plan.model),
      providerOptions: agentGatewayOptions(options.requestedBy),
      // No temperature: the reasoning models used here ignore it. Consistency comes from the policy check instead.
      maxOutputTokens: plan.maxOutputTokens,
      tools,
      stopWhen: stepCountIs(plan.maxSteps),
      abortSignal: AbortSignal.timeout(60_000),
      output: Output.object({ schema: assessmentSchema }),
      system: AGENT_INSTRUCTIONS,
      prompt: agentPrompt(),
    });
    return policyCheckedRun({ scenario, draft: result.output, agentSources: [...session.sources.values()], agentCalls: session.calls, steps: result.steps as StepMeta[], startedAt });
  } catch (error) {
    console.error("assessment_model_failed", { case: supplierChange.id, error: error instanceof Error ? error.message : String(error) });
    return rulesOnlyRun(scenario, "Policy rules (model unavailable)", error instanceof Error ? error.message.slice(0, 200) : "Model call failed.", startedAt);
  }
}

export type { StepMeta };
