import snapshot from "../fixtures/apex-evidence.json";
import { z } from "zod";

export const evidenceSchema = z.object({
  id: z.string(),
  source: z.string(),
  detail: z.string(),
  type: z.enum(["supplier", "qualification", "regulatory", "product"]),
});

export const assessmentSchema = z.object({
  decision: z.enum(["requalification_required", "follow_up_required"]),
  summary: z.string(),
  affected: z.array(z.object({
    recordId: z.string(),
    product: z.string(),
    region: z.string(),
    disposition: z.enum(["qualified", "requalification_required", "unaffected", "uncertain"]),
    rationale: z.string(),
    evidenceIds: z.array(z.string()).min(1),
  })),
  uncertainties: z.array(z.object({
    recordId: z.string(),
    detail: z.string(),
    owner: z.enum(["Regulatory Affairs", "Product Change Lead"]),
  })),
  recommendedRoute: z.string(),
});

export type Assessment = z.infer<typeof assessmentSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;

export type ProductRecord = {
  id: string;
  product: string;
  region: string;
  status: "qualified" | "requalification_required" | "unaffected" | "uncertain";
  detail: string;
  evidenceIds: string[];
};

export const supplierChange = {
  id: "SCC-2026-041",
  title: "Binder X-17 replacement proposed",
  supplier: "Meridian Specialty Materials",
  received: "12 Nov 2026",
  deadline: "28 Feb 2027",
  change: "Supplier will discontinue Binder X-17 and proposes Binder X-17R as the replacement.",
  materialImpact: "Replacement formulation has a revised stabilizer package. No performance equivalency claim has been accepted by Apex.",
};

export const evidence = evidenceSchema.array().parse(snapshot);

// The curveball removes the EU qualification record, as if the system of record could not return it.
export const evidenceFor = (missingEuQualification = false) =>
  missingEuQualification ? evidence.filter(item => item.id !== "QLF-EU-03") : evidence;

export function records(missingEuQualification = false): ProductRecord[] {
  return [
    {
      id: "US-COAT-420",
      product: "AeroShield 420",
      region: "United States",
      status: "requalification_required",
      detail: "Qualified for X-17 only. X-17R requires technical requalification before use.",
      evidenceIds: ["QLF-US-14", "SUP-01", "SUP-02"],
    },
    {
      id: "EU-COAT-420",
      product: "AeroShield 420",
      region: "EMEA",
      status: missingEuQualification ? "uncertain" : "requalification_required",
      detail: missingEuQualification
        ? "EU qualification record is unavailable. No approval decision can be made."
        : "Regional qualification is required before use; Regulatory must review customer notification obligations.",
      evidenceIds: missingEuQualification ? ["SUP-01", "REG-EU-07", "PRD-420"] : ["QLF-EU-03", "SUP-02", "REG-EU-07"],
    },
    {
      id: "US-PLASTIC-88",
      product: "FlexAdd 88",
      region: "United States",
      status: "unaffected",
      detail: "Does not use Binder X-17 and is outside this supplier change.",
      evidenceIds: ["PRD-88"],
    },
  ];
}

export function fixtureAssessment(missingEuQualification = false): Assessment {
  const eu = missingEuQualification
    ? {
        recordId: "EU-COAT-420",
        product: "AeroShield 420",
        region: "EMEA",
        disposition: "uncertain" as const,
        rationale: "The qualification record is missing. Supplier and regulatory evidence alone cannot establish approved use.",
        evidenceIds: ["SUP-01", "REG-EU-07", "PRD-420"],
      }
    : {
        recordId: "EU-COAT-420",
        product: "AeroShield 420",
        region: "EMEA",
        disposition: "requalification_required" as const,
        rationale: "The EU qualification covers X-17 only; the revised formulation requires requalification and a regional notification review.",
        evidenceIds: ["QLF-EU-03", "SUP-02", "REG-EU-07"],
      };

  return assessmentSchema.parse({
    decision: missingEuQualification ? "follow_up_required" : "requalification_required",
    summary: missingEuQualification
      ? "The missing EU qualification record blocks approval. The US coating still requires requalification; the US plastic additive is unaffected."
      : "X-17R cannot be approved as a direct substitution. Requalification is required for AeroShield 420 in the US and EMEA; FlexAdd 88 is unaffected.",
    affected: [
      { recordId: "US-COAT-420", product: "AeroShield 420", region: "United States", disposition: "requalification_required", rationale: "The existing qualification covers X-17, not the revised X-17R stabilizer package.", evidenceIds: ["QLF-US-14", "SUP-01", "SUP-02"] },
      eu,
      { recordId: "US-PLASTIC-88", product: "FlexAdd 88", region: "United States", disposition: "unaffected", rationale: "This product does not use X-17.", evidenceIds: ["PRD-88"] },
    ],
    uncertainties: missingEuQualification
      ? [{ recordId: "EU-COAT-420", detail: "EU qualification evidence is missing from the system of record. Approval is blocked until Regulatory restores or verifies the record.", owner: "Regulatory Affairs" }]
      : [{ recordId: "EU-COAT-420", detail: "Regional customer-notification applicability requires Regulatory confirmation before the final route is sent.", owner: "Regulatory Affairs" }],
    recommendedRoute: missingEuQualification
      ? "Assign Regulatory Affairs to recover the EU qualification record. Do not approve the EMEA use case."
      : "Route a requalification and customer-notification plan to the Product Change Lead after Quality and Regulatory reviews.",
  });
}
