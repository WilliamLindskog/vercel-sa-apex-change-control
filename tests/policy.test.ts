import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { handle } from "../apex-systems/lib/handler.js";
import { apexSession, type Scenario } from "../lib/apex-systems";
import { enforcePolicy, establishFacts, type Fact } from "../lib/assessment";
import type { Assessment } from "../lib/case";

// The policy is what makes the AI safe to use, so it is tested without the AI and without the network:
// the mock of Apex's systems runs in-process behind a stubbed fetch.
process.env.APEX_SYSTEMS_URL = "http://apex.test";
process.env.APEX_SYSTEMS_TOKEN = "test-token";
process.env.APEX_SYSTEMS_LATENCY = "0";
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => handle(new Request(input, init));

const factsFor = async (scenario: Scenario) => establishFacts(apexSession(scenario));
const byId = (facts: Fact[]) => Object.fromEntries(facts.map(f => [f.finishedGood, f]));

describe("policy reads Apex's systems correctly", () => {
  beforeEach(() => { process.env.APEX_SYSTEMS_TOKEN = "test-token"; });

  test("normal: both AeroShield uses need requalification, FlexAdd 88 is unaffected", async () => {
    const f = byId(await factsFor("normal"));
    assert.equal(f["FG-420-US"].expected, "requalification_required");
    assert.equal(f["FG-420-EU"].expected, "requalification_required");
    assert.equal(f["FG-088-US"].expected, "unaffected");
    assert.equal(f["FG-420-US"].noticeDays, 60);
    assert.equal(f["FG-420-EU"].noticeDays, 90);
    assert.ok(f["FG-420-EU"].evidence.includes("QLF-EU-03"));
  });

  test("missing EU record: EMEA becomes uncertain and Regulatory Affairs owns the follow-up", async () => {
    const f = byId(await factsFor("missing-eu-qualification"));
    assert.equal(f["FG-420-EU"].expected, "uncertain");
    assert.equal(f["FG-420-EU"].openQuestion?.owner, "Regulatory Affairs");
    assert.equal(f["FG-420-US"].expected, "requalification_required");
  });

  test("quality system outage: every affected use is uncertain and Quality owns the follow-up", async () => {
    const f = byId(await factsFor("qms-outage"));
    assert.equal(f["FG-420-US"].expected, "uncertain");
    assert.equal(f["FG-420-EU"].expected, "uncertain");
    assert.equal(f["FG-420-US"].openQuestion?.owner, "Quality");
    assert.equal(f["FG-088-US"].expected, "unaffected");
  });

  test("a wrong service token is refused, not silently ignored", async () => {
    const realFetch = globalThis.fetch;
    // Client and mock share process.env in-process, so tamper with the header on the way to the mock instead.
    globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
      handle(new Request(input, { ...init, headers: { ...(init?.headers as Record<string, string>), authorization: "Bearer wrong-token" } }));
    try {
      await assert.rejects(factsFor("normal"), /401/);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("policy corrects the model", () => {
  const base = async () => {
    const session = apexSession("missing-eu-qualification");
    const facts = await establishFacts(session);
    const known = new Set(["SUP-01", "SUP-02", ...session.sources.keys()]);
    return { facts, known };
  };
  const draft = (findings: Assessment["findings"], openQuestions: Assessment["openQuestions"] = []): Assessment => ({ summary: "Draft", findings, openQuestions });
  const finding = (finishedGood: string, disposition: Assessment["findings"][number]["disposition"], evidenceIds: string[]) =>
    ({ finishedGood, product: "x", market: "US" as const, disposition, rationale: "model text", evidenceIds, noticeDays: null });

  test("overrules a status that contradicts the records", async () => {
    const { facts, known } = await base();
    const { assessment, corrections } = enforcePolicy(draft([
      finding("FG-420-US", "qualified", ["QLF-US-14"]),
      finding("FG-420-EU", "requalification_required", ["SUP-01"]),
      finding("FG-088-US", "unaffected", ["FG-088-US"]),
    ]), facts, known);
    const status = Object.fromEntries(assessment.findings.map(f => [f.finishedGood, f.disposition]));
    assert.equal(status["FG-420-US"], "requalification_required");
    assert.equal(status["FG-420-EU"], "uncertain");
    assert.equal(corrections.filter(c => c.includes("changed")).length, 2);
  });

  test("removes citations no Apex system returned, and falls back to the policy's sources", async () => {
    const { facts, known } = await base();
    const { assessment, corrections } = enforcePolicy(draft([
      finding("FG-420-US", "requalification_required", ["QLF-US-14", "BOM:FG-420-US"]),
      finding("FG-420-EU", "uncertain", ["QLF-EU-03"]), // the record the QMS did not return
      finding("FG-088-US", "unaffected", ["FG-088-US"]),
    ]), facts, known);
    const cited = Object.fromEntries(assessment.findings.map(f => [f.finishedGood, f.evidenceIds]));
    assert.deepEqual(cited["FG-420-US"], ["QLF-US-14"]);
    assert.ok(!cited["FG-420-EU"].includes("QLF-EU-03"));
    assert.ok(cited["FG-420-EU"].length > 0);
    assert.equal(corrections.filter(c => c.includes("removed citation")).length, 2);
  });

  test("adds products the model skipped and drops products outside the case", async () => {
    const { facts, known } = await base();
    const { assessment, corrections } = enforcePolicy(draft([
      finding("FG-420-US", "requalification_required", ["QLF-US-14"]),
      finding("FG-999-XX", "unaffected", ["SUP-01"]),
    ]), facts, known);
    const ids = assessment.findings.map(f => f.finishedGood).sort();
    assert.deepEqual(ids, ["FG-088-US", "FG-420-EU", "FG-420-US"]);
    assert.ok(corrections.some(c => c.startsWith("Dropped FG-999-XX")));
  });

  test("the policy's open question comes first, so the right owner is asked to act", async () => {
    const { facts, known } = await base();
    const { assessment } = enforcePolicy(draft(
      [finding("FG-420-US", "requalification_required", ["QLF-US-14"]), finding("FG-420-EU", "uncertain", ["SUP-01"]), finding("FG-088-US", "unaffected", ["FG-088-US"])],
      [{ finishedGood: "FG-420-EU", owner: "Quality", detail: "Model's own question" }],
    ), facts, known);
    assert.equal(assessment.openQuestions[0].owner, "Regulatory Affairs");
    assert.equal(assessment.openQuestions.length, 2);
  });
});
