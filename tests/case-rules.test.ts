import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { assignedActor, invalidateAssessment, rejectionFor } from "../lib/case-rules";
import type { CaseState, Finding, SignOff } from "../lib/case";
import type { ReviewRole } from "../lib/users";

// The sign-off rules the case workflow enforces: three assessments, in order, and nothing routed while a record is missing.
const finding = (disposition: Finding["disposition"]): Finding => ({ finishedGood: "FG-420-EU", product: "AeroShield 420", market: "EU", disposition, rationale: "", evidenceIds: ["QLF-EU-03"], noticeDays: 90 });
const signed = (role: ReviewRole): SignOff => ({ role, reviewer: "Test", note: "ok", at: "2026-11-15T10:00:00Z" });

function caseWith(roles: ReviewRole[], disposition: Finding["disposition"] = "requalification_required"): CaseState {
  return {
    caseId: "SCC-2026-041", runId: "run", scenario: "normal", version: 1, assessing: false,
    assessment: { assessment: { summary: "", findings: [finding(disposition)], openQuestions: [] }, sources: [], calls: [], mode: "rules-only", model: "", corrections: [], latencyMs: 0, completedAt: "" },
    signOffs: { Technical: null, Quality: null, Regulatory: null, ...Object.fromEntries(roles.map(r => [r, signed(r)])) },
    routed: null, aiRuns: { day: "", count: 0 }, progress: [], log: [],
  };
}
const sign = (role: ReviewRole) => ({ type: "sign" as const, role, reviewer: "Test", note: "ok", at: "" });
const route = { type: "route" as const, by: "Test", to: "Purchasing", at: "" };

describe("sign-off order", () => {
  test("Technical can sign first", () => assert.equal(rejectionFor(caseWith([]), sign("Technical")), null));
  test("Quality cannot sign before Technical", () => assert.match(rejectionFor(caseWith([]), sign("Quality")) ?? "", /Technical assessment must be signed off first/));
  test("Regulatory cannot sign before Quality", () => assert.match(rejectionFor(caseWith(["Technical"]), sign("Regulatory")) ?? "", /Quality assessment must be signed off first/));
  test("Regulatory can sign once Technical and Quality have", () => assert.equal(rejectionFor(caseWith(["Technical", "Quality"]), sign("Regulatory")), null));
  test("no one signs twice", () => assert.match(rejectionFor(caseWith(["Technical"]), sign("Technical")) ?? "", /already signed off/));
});

describe("sending the plan", () => {
  test("needs all three assessments", () => assert.match(rejectionFor(caseWith(["Technical", "Quality"]), route) ?? "", /all three assessments/));
  test("goes through once all three are signed", () => assert.equal(rejectionFor(caseWith(["Technical", "Quality", "Regulatory"]), route), null));
  test("a missing record blocks Regulatory and the plan", () => {
    assert.match(rejectionFor(caseWith(["Technical", "Quality"], "uncertain"), sign("Regulatory")) ?? "", /record is missing/);
    assert.match(rejectionFor(caseWith(["Technical", "Quality", "Regulatory"], "uncertain"), route) ?? "", /record is missing/);
  });
});

describe("checking again", () => {
  test("a sent plan can be reopened by a new impact check", () => {
    const sent = { ...caseWith(["Technical", "Quality", "Regulatory"]), routed: { by: "Test", to: "Purchasing", at: "" } };
    assert.equal(rejectionFor(sent, { type: "assess", by: "Test", at: "" }), null);
  });
  test("but not while a check is already running", () => {
    assert.match(rejectionFor({ ...caseWith([]), assessing: true }, { type: "assess", by: "Test", at: "" }) ?? "", /already running/);
  });
});

test("each case uses its assigned people across product lines", () => {
  const coatings = { lead: "peter", lab: "lisa", quality: "quinn", regulatory: "rachel" };
  const plastics = { ...coatings, lead: "paula", quality: "quentin" };
  for (const team of [coatings, plastics]) {
    for (const type of ["assess", "route", "scenario"]) assert.equal(assignedActor(team, { type }), team.lead);
    assert.equal(assignedActor(team, sign("Quality")), team.quality);
    assert.equal(assignedActor(team, sign("Technical")), team.lab);
    assert.equal(assignedActor(team, sign("Regulatory")), team.regulatory);
  }
});

test("a failed re-check leaves no routable plan or signable evidence", () => {
  const previous = caseWith(["Technical", "Quality", "Regulatory"]);
  const pending = invalidateAssessment({ ...previous, routed: { by: "Peter", at: "", to: "Purchasing" } });
  assert.equal(pending.routed, null);
  assert.deepEqual(Object.values(pending.signOffs), [null, null, null]);
  assert.match(rejectionFor(pending, route) ?? "", /completed impact check/);
  assert.match(rejectionFor(pending, sign("Technical")) ?? "", /before the impact check/);
  assert.ok(previous.signOffs.Regulatory);
});

test("commands from a previous assessment or reset cannot approve the current plan", () => {
  const state = caseWith(["Technical", "Quality", "Regulatory"]);
  for (const command of [sign("Regulatory"), route]) {
    assert.match(rejectionFor(state, { ...command, runId: state.runId, version: 0 }) ?? "", /case changed/);
    assert.match(rejectionFor(state, { ...command, runId: "old-run", version: state.version }) ?? "", /case changed/);
  }
});
