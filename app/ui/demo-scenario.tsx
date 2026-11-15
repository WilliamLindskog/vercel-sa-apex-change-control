"use client";

import { useEffect, useState } from "react";
import type { Scenario } from "@/lib/apex-systems";
import { isScenario, SCENARIO_COOKIE, scenarioLabel } from "@/lib/demo-scenario";

const EVENT = "apex:scenario";

function readCookie(): Scenario {
  const match = document.cookie.match(new RegExp(`(?:^|; )${SCENARIO_COOKIE}=([^;]*)`));
  return isScenario(match?.[1]) ? match[1] : "normal";
}

// The current demo scenario, kept in step across every control on the page.
export function useDemoScenario(): [Scenario, (next: Scenario) => void] {
  const [scenario, setScenario] = useState<Scenario>("normal");
  useEffect(() => {
    setScenario(readCookie());
    const sync = () => setScenario(readCookie());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const choose = (next: Scenario) => {
    document.cookie = `${SCENARIO_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    window.dispatchEvent(new Event(EVENT));
  };
  return [scenario, choose];
}

// Shown in the top bar of every workspace page.
export function DemoScenario() {
  const [scenario, choose] = useDemoScenario();
  return <label className="scenario" title="How Apex's systems behave for the next impact check you run">
    <span>Demo scenario</span>
    <select value={scenario} onChange={event => choose(event.target.value as Scenario)}>
      {(Object.keys(scenarioLabel) as Scenario[]).map(key => <option key={key} value={key}>{scenarioLabel[key]}</option>)}
    </select>
  </label>;
}
