import { getHookByToken, getRun, resumeHook, start } from "workflow/api";
import type { Scenario } from "./apex-systems";
import type { CaseState } from "./case";
import { caseToken, supplierChangeCase, type CaseCommand } from "@/workflows/supplier-change-case";

// Server-side access to the durable case. There is no database: the workflow run is the record,
// found through its hook token, and its latest snapshot is the last chunk on its stream.

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function activeRunId(caseId: string) {
  try { return (await getHookByToken(caseToken(caseId))).runId; } catch { return null; }
}

// Open the case if no run holds it yet. Waits until the hook is registered, so the next command finds it.
export async function openCase(caseId: string, scenario: Scenario = "normal") {
  const existing = await activeRunId(caseId);
  if (existing) return existing;
  const run = await start(supplierChangeCase, [{ caseId, scenario }]);
  for (let i = 0; i < 40 && !(await activeRunId(caseId)); i++) await sleep(150);
  return (await activeRunId(caseId)) ?? run.runId;
}

export async function latestState(runId: string, timeoutMs = 8000): Promise<CaseState | null> {
  const reader = getRun(runId).getReadable({ startIndex: -1 }).getReader();
  const timeout = sleep(timeoutMs).then(() => ({ value: null, done: true as const }));
  const result = await Promise.race([reader.read(), timeout]);
  reader.cancel().catch(() => {});
  return (result.value as CaseState | null) ?? null;
}

export async function sendCommand(caseId: string, command: CaseCommand) {
  await openCase(caseId);
  await resumeHook(caseToken(caseId), command);
}

// Demo control: close the current case run and open a fresh one under a different scenario.
export async function restartCase(caseId: string, scenario: Scenario, by: string) {
  if (await activeRunId(caseId)) {
    await resumeHook(caseToken(caseId), { type: "close", by, at: new Date().toISOString() } satisfies CaseCommand);
    for (let i = 0; i < 40 && (await activeRunId(caseId)); i++) await sleep(150);
  }
  return openCase(caseId, scenario);
}
