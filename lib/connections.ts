// Personal tools people can connect, through Vercel Connect (phase 2). One list, read by the Connections
// page and by Mango, so both agree on what is connected. Nothing is connected in the demo: flipping
// `connected` means a real connector exists (IT-approved, per-person consent, short-lived tokens).
export type Tool = { id: "outlook" | "teams" | "slack" | "salesforce"; name: string; mark: string; connected: boolean };

export const tools: Tool[] = [
  { id: "outlook", name: "Outlook", mark: "O", connected: false },
  { id: "teams", name: "Teams", mark: "T", connected: false },
  { id: "slack", name: "Slack", mark: "#", connected: false },
  { id: "salesforce", name: "Salesforce", mark: "S", connected: false },
];

export const tool = (id: Tool["id"]) => tools.find(t => t.id === id)!;
