import type { Scenario } from "./apex-systems";

// The demo scenario stands in for the state of Apex's systems. It is one setting for the whole demo, per
// browser, kept in a cookie: every assessment run after it changes uses it. Results already on a case stay
// until someone runs the assessment again.
export const SCENARIO_COOKIE = "apex_scenario";

export const scenarioLabel: Record<Scenario, string> = {
  normal: "All systems normal",
  "missing-eu-qualification": "EU record missing",
  "qms-outage": "Quality system down",
};

export const isScenario = (value: unknown): value is Scenario => typeof value === "string" && value in scenarioLabel;
