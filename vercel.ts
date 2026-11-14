import type { VercelConfig } from "@vercel/config/v1";

// Deployment settings as code, so they are reviewed like any other change.
export const config: VercelConfig = {
  framework: "nextjs",

  // Fluid Compute: one instance serves many requests at once and bills active CPU, not wall-clock time.
  // This app mostly waits (on the model, on Apex's systems, on people), so waiting is nearly free.
  fluid: true,

  // Functions run in Washington, D.C. (iad1, AWS us-east-1), next to where Apex's systems would sit.
  // Pinned here so "data stays in us-east-1" is a reviewed setting, not a dashboard default.
  regions: ["iad1"],

  // Timeouts sit next to the code: maxDuration in each route (Helper: 30 s). Long work runs as workflow steps.
};
