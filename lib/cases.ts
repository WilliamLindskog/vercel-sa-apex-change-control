import { displayDate, supplierChanges, type ProductLine } from "./case";

export type Stage = "new" | "assessing" | "review" | "ready" | "done";
export const stages: { id: Stage; label: string }[] = [
  { id: "new", label: "New" },
  { id: "assessing", label: "Assessing" },
  { id: "review", label: "In review" },
  { id: "ready", label: "Ready to send" },
  { id: "done", label: "Done" },
];

// A case as the board and calendar list it. Every case is live: its stage, owner and progress come from
// its own durable workflow (lib/board.ts).
export type CaseSummary = {
  id: string;
  title: string;
  supplier: string;
  material: string;
  line: ProductLine;
  opened: string;
  due: string;
  deadline: string;       // ISO date the change takes effect
  people: string[];
  waitingOn?: string;
  note?: string;
};

export const cases: CaseSummary[] = supplierChanges.map(c => ({
  id: c.id, title: c.title, supplier: c.supplier, material: c.materialName, line: c.line,
  opened: displayDate(c.received), due: displayDate(c.deadline), deadline: c.deadline,
  people: [c.team.lead, c.team.quality, c.team.regulatory],
}));

export const isCase = (id: string) => cases.some(c => c.id === id);
