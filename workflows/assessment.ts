import { WorkflowAgent } from "@ai-sdk/workflow";
import { Output, stepCountIs } from "ai";
import { apexSession, type Scenario, type SourceRecord, type SystemCall } from "@/lib/apex-systems";
import { AGENT_INSTRUCTIONS, agentGatewayOptions, agentPrompt, agentTools, modelPlan, policyCheckedRun, rulesOnlyRun, runAgentTool, type AgentToolName, type StepMeta } from "@/lib/assessment";
import { assessmentSchema, type AssessmentRun, type ProgressItem } from "@/lib/case";

// The durable assessment, run inside the case workflow. What makes it durable:
//   - every lookup in Apex's systems is its own step: retried on its own, and never repeated once it succeeded;
//   - every model call is a step too (WorkflowAgent), so a crash or deploy mid-run resumes after the last
//     completed call instead of starting over and paying for the model twice;
//   - the policy check is a final step that re-reads the records independently of what the model saw.
// After each lookup the caller publishes progress, so people watch the check happen rather than a spinner.

export async function durableAssessment(
  input: { scenario: Scenario; requestedBy: string; aiRunsToday: number },
  onProgress: (item: ProgressItem) => Promise<void>,
): Promise<AssessmentRun> {
  const plan = await planRun(input.aiRunsToday);
  if (!plan.useModel) {
    await onProgress({ system: "Policy", label: "Checking the records with the policy rules", ok: true });
    return rulesOnlyStep(input.scenario, plan.model, plan.reason, plan.startedAt);
  }

  const sources: SourceRecord[] = [];
  const calls: SystemCall[] = [];
  const tools = Object.fromEntries((Object.keys(agentTools) as AgentToolName[]).map(name => [name, {
    ...agentTools[name],
    // Workflow-level wrapper around a step: the lookup is durable, the bookkeeping stays deterministic.
    execute: async (args: Record<string, string>) => {
      const result = await lookupStep(input.scenario, name, args);
      sources.push(...result.sources);
      calls.push(...result.calls);
      await onProgress(result.progress);
      return result.output;
    },
  }]));

  const agent = new WorkflowAgent({
    model: plan.model,
    instructions: AGENT_INSTRUCTIONS,
    tools,
    output: Output.object({ schema: assessmentSchema }),
    stopWhen: stepCountIs(plan.maxSteps),
    maxOutputTokens: plan.maxOutputTokens,
    providerOptions: agentGatewayOptions(input.requestedBy),
  });

  try {
    const result = await agent.generate({ prompt: agentPrompt() });
    await onProgress({ system: "Policy", label: "Checking the AI's answer against the records", ok: true });
    const steps: StepMeta[] = result.steps.map(step => ({ usage: { inputTokens: step.usage.inputTokens, outputTokens: step.usage.outputTokens }, providerMetadata: step.providerMetadata as Record<string, unknown> | undefined }));
    return policyCheckStep({ scenario: input.scenario, draft: result.output, agentSources: sources, agentCalls: calls, steps, startedAt: plan.startedAt });
  } catch (error) {
    // Every model in Gateway's fallback chain failed, or the output did not match the schema.
    await onProgress({ system: "AI", label: "AI unavailable, using the policy rules", ok: false });
    return rulesOnlyStep(input.scenario, "Policy rules (model unavailable)", error instanceof Error ? error.message.slice(0, 200) : "Model call failed.", plan.startedAt);
  }
}

async function planRun(aiRunsToday: number) {
  "use step";
  // Reads environment and clock, so it runs as a step: its result is recorded and replayed, never recomputed.
  return { ...modelPlan(aiRunsToday), startedAt: Date.now() };
}

const describe = (name: AgentToolName, args: Record<string, string>): Pick<ProgressItem, "system" | "label"> => {
  switch (name) {
    case "lookupMaterial": return { system: "ERP", label: `Material ${args.material}` };
    case "findWhereUsed": return { system: "ERP", label: `Where ${args.material} is used` };
    case "getBillOfMaterials": return { system: "ERP", label: `Bill of materials for ${args.finishedGood}` };
    case "findQualifications": return { system: "QMS", label: `Qualification for ${args.finishedGood}` };
    case "getNotificationRules": return { system: "Regulatory", label: `Notice rules for ${args.market === "EU" ? "EMEA" : "the US"}` };
  }
};

async function lookupStep(scenario: Scenario, name: AgentToolName, args: Record<string, string>) {
  "use step";
  const session = apexSession(scenario);
  const started = Date.now();
  const output = await runAgentTool(session, name, args);
  const failed = Boolean(output && typeof output === "object" && "error" in output);
  return {
    output,
    sources: [...session.sources.values()],
    calls: session.calls,
    progress: { ...describe(name, args), ok: !failed, ms: Date.now() - started } satisfies ProgressItem,
  };
}

async function policyCheckStep(input: Parameters<typeof policyCheckedRun>[0]) {
  "use step";
  return policyCheckedRun(input);
}

async function rulesOnlyStep(scenario: Scenario, model: string, reason: string, startedAt: number) {
  "use step";
  return rulesOnlyRun(scenario, model, reason, startedAt);
}
