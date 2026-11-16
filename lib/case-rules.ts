import type { CaseState, SupplierChange } from "./case";
import { reviewOrder, type ReviewRole } from "./users";
import type { CaseCommand } from "@/workflows/supplier-change-case";

export function assignedActor(team: SupplierChange["team"], command: { type: string; role?: ReviewRole }) {
  const reviewers = { Technical: team.lab, Quality: team.quality, Regulatory: team.regulatory };
  return command.type === "sign" && command.role ? reviewers[command.role] : team.lead;
}

// Prior snapshots remain in the durable stream. Current decisions must use the next successful check.
export function invalidateAssessment(state: CaseState): CaseState {
  return { ...state, assessment: null, routed: null, signOffs: { Technical: null, Quality: null, Regulatory: null } };
}

// The case rules. The case workflow runs every command through this before accepting it, so no client or
// API shortcut can skip them. Kept free of workflow imports so it can be tested on its own.
export function rejectionFor(state: CaseState, command: CaseCommand): string | null {
  if ((command.type === "route" || command.type === "sign") && command.version !== undefined &&
      (command.version !== state.version || command.runId !== state.runId)) return "the case changed; review the latest evidence";
  const uncertain = state.assessment?.assessment.findings.some(f => f.disposition === "uncertain") ?? false;
  switch (command.type) {
    case "assess":
      if (state.assessing) return "an impact check is already running";
      // A sent plan can be reopened: new data after the plan went out means checking again. The workflow
      // clears the sign-offs and the sent plan, so everyone re-confirms against the new evidence.
      return null;
    case "sign": {
      if (!state.assessment) return `the ${command.role} assessment cannot be signed before the impact check`;
      if (state.signOffs[command.role]) return `the ${command.role} assessment is already signed off`;
      // Strict order: Technical, then Quality, then Regulatory. Each builds on the one before.
      const before = reviewOrder[reviewOrder.indexOf(command.role) - 1];
      if (before && !state.signOffs[before]) return `the ${before} assessment must be signed off first`;
      if (command.role === "Regulatory" && uncertain) return "the Regulatory assessment cannot be signed while a record is missing";
      return null;
    }
    case "route":
      if (!state.assessment) return "a completed impact check is required";
      if (state.routed) return "the plan has already been routed";
      if (uncertain) return "a record is missing, so nothing can be routed";
      if (reviewOrder.some(review => !state.signOffs[review])) return "all three assessments must be signed off before routing";
      return null;
    default:
      return null;
  }
}
