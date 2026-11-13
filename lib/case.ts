import { z } from "zod";
import type { Scenario, SourceRecord, SystemCall } from "./apex-systems";

// The case as it arrives: a supplier notice by email, plus the products Purchasing flagged from memory.
// Everything else (what actually uses the material, what is qualified, what customers must be told)
// comes from Apex's systems at assessment time.
export const supplierChange = {
  id: "SCC-2026-041",
  title: "Binder X-17 replacement proposed",
  supplier: "Meridian Specialty Materials",
  material: "MAT-000417",
  received: "12 Nov 2026",
  deadline: "28 Feb 2027",
  change: "Supplier will discontinue Binder X-17 and proposes Binder X-17R as the replacement.",
  materialImpact: "Replacement formulation has a revised stabilizer package. No performance equivalency claim has been accepted by Apex.",
  // Flagged by Purchasing because they order X-17-family binders. ERP decides which ones really use MAT-000417.
  candidates: ["FG-420-US", "FG-420-EU", "FG-088-US"],
};

export const supplierDocuments: SourceRecord[] = [
  { id: "SUP-01", system: "Supplier notice", title: "Supplier change notice | 12 Nov 2026", detail: "X-17 production ends 28 Feb 2027; X-17R is the proposed replacement." },
  { id: "SUP-02", system: "Supplier notice", title: "Supplier technical statement | Rev. 2", detail: "X-17R contains a revised stabilizer package; equivalency is not certified." },
];

export const dispositions = ["requalification_required", "unaffected", "uncertain", "qualified"] as const;
export type Disposition = (typeof dispositions)[number];
export const owners = ["Quality", "Regulatory Affairs", "Product Change Lead"] as const;

// The shape the model must return. Anything outside it is rejected before it reaches a person.
export const assessmentSchema = z.object({
  summary: z.string().describe("Two sentences for the Product Change Lead: what is affected and what has to happen."),
  findings: z.array(z.object({
    finishedGood: z.string().describe("ERP finished good number, e.g. FG-420-US"),
    product: z.string(),
    market: z.enum(["US", "EU"]),
    disposition: z.enum(dispositions),
    rationale: z.string().describe("One sentence, citing what the records say."),
    evidenceIds: z.array(z.string()).min(1).describe("IDs of the records this finding relies on"),
    noticeDays: z.number().nullable().describe("Customer notice period from the regulatory rule, if one applies"),
  })),
  openQuestions: z.array(z.object({
    finishedGood: z.string(),
    detail: z.string(),
    owner: z.enum(owners),
  })),
});

export type Assessment = z.infer<typeof assessmentSchema>;
export type Finding = Assessment["findings"][number];

export type AssessmentRun = {
  assessment: Assessment;
  sources: SourceRecord[];
  calls: SystemCall[];
  mode: "ai-gateway" | "rules-only";
  model: string;
  fallbackReason?: string;
  corrections: string[];
  latencyMs: number;
  usage?: { inputTokens?: number; outputTokens?: number };
  modelCalls?: number;
  costUsd?: number;
  requestedModel?: string;
  generationId?: string;
  completedAt: string;
};

export type SignOff = { role: "Quality" | "Regulatory Affairs"; reviewer: string; note: string; at: string };

// The durable case record. The workflow owns it; the UI only ever reads the latest snapshot.
export type CaseState = {
  caseId: string;
  runId: string;
  scenario: Scenario;
  version: number;
  assessing: boolean;
  assessment: AssessmentRun | null;
  signOffs: { Quality: SignOff | null; "Regulatory Affairs": SignOff | null };
  routed: { by: string; to: string; at: string } | null;
  aiRuns: { day: string; count: number };
  log: { at: string; text: string }[];
};

export const marketLabel = (market: string) => (market === "EU" ? "EMEA" : "United States");
