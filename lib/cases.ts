import { supplierChange } from "./case";

export type Stage = "new" | "assessing" | "review" | "ready" | "done";
export const stages: { id: Stage; label: string }[] = [
  { id: "new", label: "New" },
  { id: "assessing", label: "Assessing" },
  { id: "review", label: "In review" },
  { id: "ready", label: "Ready to send" },
  { id: "done", label: "Done" },
];

export type CaseSummary = {
  id: string;
  title: string;
  supplier: string;
  material: string;
  opened: string;
  due: string;
  people: string[];
  products: number;
  // The live case takes its stage from its workflow; sample cases are fixed and view-only.
  live?: boolean;
  stage?: Stage;
  note?: string;
};

// One live case backed by the durable workflow. The rest are sample cases so the board reads like a working week.
export const cases: CaseSummary[] = [
  { id: supplierChange.id, title: supplierChange.title, supplier: supplierChange.supplier, material: "Binder X-17", opened: supplierChange.received, due: supplierChange.deadline, people: ["dana", "priya", "marcus"], products: 3, live: true },
  { id: "SCC-2026-044", title: "Pigment PB-15:3 grade change", supplier: "Sunfield Colours", material: "Pigment PB-15:3", opened: "13 Nov 2026", due: "15 Jan 2027", people: ["dana"], products: 4, stage: "new", note: "Notice received yesterday" },
  { id: "SCC-2026-042", title: "Wax W-210 plant relocation", supplier: "Nordhavn Waxes", material: "Wax W-210", opened: "3 Nov 2026", due: "31 Dec 2026", people: ["dana", "priya"], products: 2, stage: "review", note: "Quality reviewing" },
  { id: "SCC-2026-038", title: "Silica SX-9 packaging size change", supplier: "Corvane Industrial", material: "Silica SX-9", opened: "21 Oct 2026", due: "5 Dec 2026", people: ["dana", "priya", "marcus"], products: 1, stage: "ready", note: "Both signed" },
  { id: "SCC-2026-033", title: "Dispersant PD-4 site transfer", supplier: "Halvorsen Chemie", material: "Dispersant PD-4", opened: "2 Sep 2026", due: "21 Oct 2026", people: ["dana", "priya", "marcus"], products: 5, stage: "done", note: "Approved with customer notice" },
  { id: "SCC-2026-029", title: "Antioxidant AO-12 packaging change", supplier: "Corvane Industrial", material: "Antioxidant AO-12", opened: "11 Aug 2026", due: "30 Sep 2026", people: ["dana"], products: 2, stage: "done", note: "No product impact" },
];

export const openCaseId = supplierChange.id;
