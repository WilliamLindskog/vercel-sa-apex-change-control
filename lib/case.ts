import { z } from "zod";
import type { Scenario, SourceRecord, SystemCall } from "./apex-systems";

// A supplier-change case as it arrives: the supplier's notice, plus the products Purchasing flagged from memory.
// Everything else (what actually uses the material, what is qualified, what customers must be told) comes
// from Apex's systems at assessment time. Each case runs as its own durable workflow.
export type ChangeType = "FORMULATION" | "SITE" | "PACKAGING";
export type ProductLine = "Coatings" | "Plastics" | "Inks";
export type StartStage = "new" | "review" | "ready" | "done";

export type SupplierChange = {
  id: string;
  title: string;
  supplier: string;
  material: string;          // SAP material number
  materialName: string;      // e.g. "Binder X-17"
  becomes: string;           // what replaces it: a grade, a site or a pack
  changeType: ChangeType;
  line: ProductLine;
  received: string;          // ISO date the notice arrived
  deadline: string;          // ISO date the change takes effect / supply ends
  change: string;
  materialImpact: string;
  candidates: string[];      // flagged by Purchasing; ERP decides which really use the material
  team: { lead: string; quality: string; regulatory: string };
  documents: SourceRecord[];
  // Where the case stands when the demo starts. Earlier steps are replayed through the same workflow rules.
  start: { stage: StartStage; qualitySigned?: boolean; scenario?: Scenario };
};

const docs = (notice: string, statement: string, received: string): SourceRecord[] => [
  { id: "SUP-01", system: "Supplier notice", title: `Supplier change notice | ${received}`, detail: notice },
  { id: "SUP-02", system: "Supplier notice", title: "Supplier technical statement", detail: statement },
];

export const supplierChanges: SupplierChange[] = [
  {
    id: "SCC-2026-029", title: "Antioxidant AO-12 packaging change", supplier: "Corvane Industrial", material: "MAT-000112", materialName: "Antioxidant AO-12", becomes: "500 kg octabins",
    changeType: "PACKAGING", line: "Plastics", received: "2026-08-11", deadline: "2026-09-30",
    change: "AO-12 moves from 25 kg bags to 500 kg octabins.", materialImpact: "Same grade, same plant. Only the pack changes.",
    candidates: ["FG-190-US"], team: { lead: "ingrid", quality: "kenji", regulatory: "lucia" },
    documents: docs("25 kg bags end 30 Sep 2026; 500 kg octabins from then on.", "Product, grade and plant unchanged. Certificate of analysis unchanged.", "11 Aug 2026"),
    start: { stage: "done" },
  },
  {
    id: "SCC-2026-033", title: "Dispersant PD-4 site transfer", supplier: "Halvorsen Chemie", material: "MAT-000404", materialName: "Dispersant PD-4", becomes: "Antwerp plant",
    changeType: "SITE", line: "Coatings", received: "2026-09-02", deadline: "2026-10-21",
    change: "PD-4 production moves from Leverkusen to Antwerp.", materialImpact: "Same recipe; new reactor line and raw-material sources at the new site.",
    candidates: ["FG-430-US", "FG-430-EU", "FG-440-US", "FG-440-EU"], team: { lead: "dana", quality: "priya", regulatory: "marcus" },
    documents: docs("Leverkusen output ends 21 Oct 2026; Antwerp supplies from then on.", "Antwerp batches meet the same specification; three validation lots attached.", "2 Sep 2026"),
    start: { stage: "done" },
  },
  {
    id: "SCC-2026-038", title: "Silica SX-9 packaging change", supplier: "Corvane Industrial", material: "MAT-000309", materialName: "Silica SX-9", becomes: "15 kg valve bags",
    changeType: "PACKAGING", line: "Coatings", received: "2026-10-21", deadline: "2026-12-05",
    change: "SX-9 moves from 10 kg to 15 kg valve bags.", materialImpact: "Same grade and plant. Only the pack changes.",
    candidates: ["FG-450-US"], team: { lead: "dana", quality: "priya", regulatory: "lucia" },
    documents: docs("10 kg bags end 5 Dec 2026.", "Product unchanged; pallet pattern changes.", "21 Oct 2026"),
    start: { stage: "ready" },
  },
  {
    id: "SCC-2026-039", title: "Pigment PY-83 grade change", supplier: "Sunfield Colours", material: "MAT-000683", materialName: "Pigment PY-83", becomes: "PY-83 HR",
    changeType: "FORMULATION", line: "Inks", received: "2026-11-02", deadline: "2026-12-15",
    change: "Sunfield replaces PY-83 with the higher-opacity grade PY-83 HR.", materialImpact: "Shade within tolerance per supplier; opacity is higher.",
    candidates: ["FG-720-US", "FG-730-US"], team: { lead: "ingrid", quality: "kenji", regulatory: "lucia" },
    documents: docs("PY-83 standard grade ends 15 Dec 2026; PY-83 HR replaces it.", "Shade delta E under 1.0; opacity up 8%. Not certified as equivalent.", "2 Nov 2026"),
    start: { stage: "done" },
  },
  {
    id: "SCC-2026-040", title: "Wax W-210 plant relocation", supplier: "Nordhavn Waxes", material: "MAT-000210", materialName: "Wax W-210", becomes: "Esbjerg plant",
    changeType: "SITE", line: "Coatings", received: "2026-11-03", deadline: "2026-12-31",
    change: "W-210 production moves from Aarhus to Esbjerg.", materialImpact: "Same recipe; new prilling tower.",
    candidates: ["FG-440-US", "FG-440-EU"], team: { lead: "dana", quality: "priya", regulatory: "marcus" },
    documents: docs("Aarhus output ends 31 Dec 2026.", "Particle size distribution may shift slightly; drop-point unchanged.", "3 Nov 2026"),
    start: { stage: "review" },
  },
  {
    id: "SCC-2026-041", title: "Binder X-17 replacement proposed", supplier: "Meridian Specialty Materials", material: "MAT-000417", materialName: "Binder X-17", becomes: "X-17R",
    changeType: "FORMULATION", line: "Coatings", received: "2026-11-12", deadline: "2027-02-28",
    change: "Supplier will discontinue Binder X-17 and proposes Binder X-17R as the replacement.",
    materialImpact: "Replacement formulation has a revised stabilizer package. No performance equivalency claim has been accepted by Apex.",
    candidates: ["FG-420-US", "FG-420-EU", "FG-088-US"], team: { lead: "dana", quality: "priya", regulatory: "marcus" },
    documents: docs("X-17 production ends 28 Feb 2027; X-17R is the proposed replacement.", "X-17R contains a revised stabilizer package; equivalency is not certified.", "12 Nov 2026"),
    start: { stage: "new" },
  },
  {
    id: "SCC-2026-042", title: "UV absorber UV-5 discontinued", supplier: "Brightwater Chemicals", material: "MAT-000505", materialName: "UV absorber UV-5", becomes: "UV-5X",
    changeType: "FORMULATION", line: "Plastics", received: "2026-11-09", deadline: "2027-03-31",
    change: "Brightwater discontinues UV-5 and offers UV-5X.", materialImpact: "UV-5X uses a different benzotriazole; weathering data is from the supplier only.",
    candidates: ["FG-170-US", "FG-170-EU", "FG-175-US"], team: { lead: "ingrid", quality: "kenji", regulatory: "marcus" },
    documents: docs("UV-5 ends 31 Mar 2027; UV-5X is offered as replacement.", "UV-5X has a different benzotriazole; 2,000 h weathering data attached.", "9 Nov 2026"),
    start: { stage: "review", qualitySigned: true, scenario: "missing-eu-qualification" },
  },
  {
    id: "SCC-2026-043", title: "Slip agent E-8 site transfer", supplier: "Halvorsen Chemie", material: "MAT-000508", materialName: "Slip agent E-8", becomes: "Gdańsk plant",
    changeType: "SITE", line: "Plastics", received: "2026-11-10", deadline: "2027-02-15",
    change: "E-8 production moves from Hamburg to Gdańsk.", materialImpact: "Same recipe; different fatty-acid source.",
    candidates: ["FG-160-US", "FG-160-EU"], team: { lead: "ingrid", quality: "kenji", regulatory: "marcus" },
    documents: docs("Hamburg output ends 15 Feb 2027.", "Fatty-acid source changes; purity specification unchanged.", "10 Nov 2026"),
    start: { stage: "review" },
  },
  {
    id: "SCC-2026-044", title: "Pigment PB-15:3 grade change", supplier: "Sunfield Colours", material: "MAT-000615", materialName: "Pigment PB-15:3", becomes: "PB-15:3B",
    changeType: "FORMULATION", line: "Inks", received: "2026-11-13", deadline: "2027-01-15",
    change: "Sunfield moves PB-15:3 to a beta crystal form, PB-15:3B.", materialImpact: "Shade shifts greener; food-contact status to be confirmed.",
    candidates: ["FG-710-US", "FG-710-EU", "FG-725-US"], team: { lead: "ingrid", quality: "kenji", regulatory: "marcus" },
    documents: docs("PB-15:3 alpha form ends 15 Jan 2027.", "Beta form; shade greener; migration data pending.", "13 Nov 2026"),
    start: { stage: "new" },
  },
  {
    id: "SCC-2026-045", title: "Resin R-50 grade change", supplier: "Meridian Specialty Materials", material: "MAT-000502", materialName: "Resin R-50", becomes: "R-50N",
    changeType: "FORMULATION", line: "Inks", received: "2026-11-13", deadline: "2027-01-31",
    change: "Meridian replaces R-50 with the bio-based grade R-50N.", materialImpact: "Softening point 4 °C lower; adhesion data from the supplier only.",
    candidates: ["FG-710-US", "FG-710-EU", "FG-730-US"], team: { lead: "ingrid", quality: "kenji", regulatory: "lucia" },
    documents: docs("R-50 ends 31 Jan 2027; R-50N replaces it.", "R-50N is 40% bio-based; softening point 4 °C lower.", "13 Nov 2026"),
    start: { stage: "new" },
  },
  {
    id: "SCC-2026-046", title: "Talc T-12 packaging change", supplier: "Nordic Minerals", material: "MAT-000312", materialName: "Talc T-12", becomes: "1 t big bags",
    changeType: "PACKAGING", line: "Plastics", received: "2026-11-14", deadline: "2027-03-31",
    change: "T-12 moves from 25 kg bags to 1 t big bags.", materialImpact: "Same grade and mine. Only the pack changes.",
    candidates: ["FG-150-US", "FG-150-EU"], team: { lead: "ingrid", quality: "kenji", regulatory: "marcus" },
    documents: docs("25 kg bags end 31 Mar 2027.", "Product unchanged; big-bag discharge station needed.", "14 Nov 2026"),
    start: { stage: "new" },
  },
];

export const findChange = (id: string) => supplierChanges.find(c => c.id === id);
export const getChange = (id: string) => {
  const change = findChange(id);
  if (!change) throw new Error(`Unknown case ${id}`);
  return change;
};

// The case the demo script walks through, and the one the AI test set runs against.
export const supplierChange = getChange("SCC-2026-041");
export const supplierDocuments = supplierChange.documents;

const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const displayDate = shortDate;

// What a reviewer would typically write, drafted from the assessment. Used to prefill the sign-off box,
// and as the note on sign-offs replayed when a case starts part-way through.
export function defaultNote(role: "Quality" | "Regulatory Affairs", findings: { product: string; market: string; disposition: string; noticeDays: number | null }[], change: SupplierChange) {
  const name = (f: { product: string; market: string }) => `${f.product.replace(/ \(eu\)$/i, "")} ${f.market}`;
  if (role === "Quality") {
    const retest = findings.filter(f => f.disposition === "requalification_required");
    return retest.length ? `Requalification required for ${retest.map(name).join(", ")} before ${change.becomes} is used.` : `No requalification needed: existing qualifications cover ${change.becomes}.`;
  }
  const notices = findings.filter(f => f.disposition !== "unaffected" && f.noticeDays);
  return notices.length ? `Customer notices: ${notices.map(f => `${f.noticeDays} days ${f.market === "EU" ? "EMEA" : "US"}`).filter((v, i, a) => a.indexOf(v) === i).join(", ")}.` : "No customer notice required.";
}

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

export type ProgressItem = { system: "ERP" | "QMS" | "Regulatory" | "AI" | "Policy"; label: string; ok: boolean; ms?: number };

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
  // Live progress of the running assessment, one entry per lookup. Cleared when a new assessment starts.
  progress: ProgressItem[];
  log: { at: string; text: string }[];
};

export const marketLabel = (market: string) => (market === "EU" ? "EMEA" : "United States");
