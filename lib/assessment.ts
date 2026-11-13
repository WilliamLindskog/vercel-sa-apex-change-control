import { gateway } from "@ai-sdk/gateway";
import { generateText, Output } from "ai";
import { assessmentSchema, evidenceFor, fixtureAssessment, records } from "./case";

export async function assessSupplierChange(missingEuQualification: boolean) {
  const startedAt = performance.now();
  const runId = `run_${crypto.randomUUID().slice(0, 8)}`;
  const base = fixtureAssessment(missingEuQualification);

  if (!process.env.AI_GATEWAY_API_KEY) {
    return { assessment: base, runId, mode: "validated-fixture" as const, latencyMs: Math.round(performance.now() - startedAt), model: "Fixture fallback" };
  }

  try {
    const { output } = await generateText({
      model: gateway("openai/gpt-4.1-mini"),
      output: Output.object({ schema: assessmentSchema }),
      temperature: 0,
      prompt: `You are an evidence-bound assistant for a supplier change-control team. You never approve a change. Return only a case assessment grounded in the supplied records. Every affected item must cite evidence IDs. Missing data must be an uncertainty and must block approval.\n\nSupplier change: ${JSON.stringify({ change: "X-17 is discontinued; X-17R has a revised stabilizer package." })}\nRecords: ${JSON.stringify(records(missingEuQualification))}\nEvidence: ${JSON.stringify(evidenceFor(missingEuQualification))}\n\nUse this known-safe assessment as the factual ceiling. Do not add facts: ${JSON.stringify(base)}`,
    });
    return { assessment: assessmentSchema.parse(output), runId, mode: "ai-gateway" as const, latencyMs: Math.round(performance.now() - startedAt), model: "openai/gpt-4.1-mini via AI Gateway" };
  } catch (error) {
    console.error("assessment_failed", { runId, error: error instanceof Error ? error.message : "unknown" });
    return { assessment: base, runId, mode: "safe-fallback" as const, latencyMs: Math.round(performance.now() - startedAt), model: "AI Gateway unavailable" };
  }
}
