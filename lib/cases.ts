import { supplierChange } from "./case";

export type CaseSummary = {
  id: string;
  title: string;
  supplier: string;
  material: string;
  opened: string;
  due: string;
  ownerId: string;
  state: "open" | "closed";
  outcome: string;
};

// The open case is the live demo case. Closed cases are list context only and have no detail page.
export const cases: CaseSummary[] = [
  { id: supplierChange.id, title: supplierChange.title, supplier: supplierChange.supplier, material: "Binder X-17", opened: supplierChange.received, due: supplierChange.deadline, ownerId: "dana", state: "open", outcome: "Awaiting assessment and sign-off" },
  { id: "SCC-2026-033", title: "Dispersant PD-4 production site transfer", supplier: "Halvorsen Chemie", material: "Dispersant PD-4", opened: "2 Sep 2026", due: "21 Oct 2026", ownerId: "dana", state: "closed", outcome: "Approved with customer notification" },
  { id: "SCC-2026-029", title: "Antioxidant AO-12 packaging change", supplier: "Corvane Industrial", material: "Antioxidant AO-12", opened: "11 Aug 2026", due: "30 Sep 2026", ownerId: "dana", state: "closed", outcome: "No product impact" },
];

export const openCaseId = supplierChange.id;
