import { gateway } from "@ai-sdk/gateway";
import { generateText, Output } from "ai";
import { assessmentSchema, evidenceSchema, evidenceFor, fixtureAssessment, records } from "./case";

export async function assessSupplierChange(missingEuQualification: boolean) {
  const startedAt = performance.now();
  const runId = `run_${crypto.randomUUID().slice(0, 8)}`;
  // Pin the synthetic upstream to a revision so the displayed ledger and decision use the same records.
  const response = await fetch("https://raw.githubusercontent.com/WilliamLindskog/vercel-sa-apex-change-control/a7a22485cdb8295ed406e10ec7da0e42471850e8/fixtures/apex-evidence.json", {
    cache: "no-store", signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error("Apex evidence register unavailable");
  const ledger = evidenceSchema.array().parse(await response.json());
  if (JSON.stringify(ledger) !== JSON.stringify(evidenceFor(false))) throw new Error("Evidence revision mismatch");
  const available = ledger.filter(row => !missingEuQualification || row.id !== "QLF-EU-03");
  const base = fixtureAssessment(missingEuQualification);

  if (!process.env.AI_GATEWAY_API_KEY) {
    return { assessment: base, runId, mode: "validated-fixture" as const, latencyMs: Math.round(performance.now() - startedAt), model: "Fixture fallback" };
  }

  try {
    const { output } = await generateText({
      model: gateway("openai/gpt-4.1-mini"),
      output: Output.object({ schema: assessmentSchema }),
      temperature: 0,
      prompt: `You are an evidence-bound assistant for a supplier change-control team. You never approve a change. Return only a case assessment grounded in the supplied records. Every affected item must cite evidence IDs. Missing data must be an uncertainty and must block approval.\n\nSupplier change: ${JSON.stringify({ change: "X-17 is discontinued; X-17R has a revised stabilizer package." })}\nRecords: ${JSON.stringify(records(missingEuQualification))}\nEvidence: ${JSON.stringify(available)}\n\nUse this known-safe assessment as the factual ceiling. Do not add facts: ${JSON.stringify(base)}`,
    });
    return { assessment: assessmentSchema.parse(output), runId, mode: "ai-gateway" as const, latencyMs: Math.round(performance.now() - startedAt), model: "openai/gpt-4.1-mini via AI Gateway" };
  } catch (error) {
    console.error("assessment_failed", { runId, error: error instanceof Error ? error.message : "unknown" });
    return { assessment: base, runId, mode: "safe-fallback" as const, latencyMs: Math.round(performance.now() - startedAt), model: "AI Gateway unavailable" };
  }
}
