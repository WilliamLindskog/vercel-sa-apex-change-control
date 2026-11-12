# Apex Change Control POC

A decision-first supplier-change workspace for a fictional specialty-additives manufacturer. 

## What it proves

- **Apex systems stay outside Vercel.** The app reads a fixed, server-side fixture that represents the supplier update, product master, qualification, and regulatory systems. It does not replace those systems or expose their credentials to the browser.
- **AI assists but never approves.** `POST /api/assessment` uses AI SDK and AI Gateway when `AI_GATEWAY_API_KEY` is configured. Its output is constrained by a Zod schema and every material conclusion carries fixture evidence IDs. Without a key, or if a provider call fails, the public POC returns the same schema-validated fixture assessment and labels that state clearly.
- **Human review is durable.** Quality and Regulatory Affairs reviews each start a Vercel Workflow. The workflow ID is shown in the app; the Product Change Lead route cannot become final until both reviews are recorded.
- **The safe failure path is visible.** “Simulate missing EU record” removes the EU qualification fixture, resets the reviews, makes the EMEA record uncertain, and prevents approval or routing until Regulatory recovers the evidence.

## Vercel primitives and rationale

| Primitive | Role in this POC | Deliberate boundary |
| --- | --- | --- |
| Next.js on Vercel | Public case workspace and dynamic server routes | Browser receives rendered decisions and review actions, not supplier credentials. |
| AI SDK + AI Gateway | Schema-validated assessment with a swappable model path | AI organizes cited evidence; it cannot make or execute an approval. |
| Vercel Workflows | Durable, inspectable Quality and Regulatory review records | Review state is a human-in-the-loop workflow, not an autonomous agent loop. |
| Vercel Observability | Request, latency, failure, and workflow-run inspection | The POC shows run IDs in the UI; production would use the Vercel dashboards for traces and metrics. |

For a production Apex integration, Secure Compute or Connect would cross the private API boundary. Rolling Releases would support a canary and instant rollback of the workspace after pilot validation. They are not included in the POC because no live private API or release cohort is in scope.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Click **Run assessment**, record both reviews, then inspect the routed outcome. Click **Simulate missing EU record** to demonstrate the curveball.

To use the live model path locally, set `AI_GATEWAY_API_KEY` in `.env.local`. The deployed Vercel project can use its workload identity or the same environment variable. No model key is bundled to the client.

## Validation

```bash
npm run build
```

Validated locally:

1. Initial case displays the change, affected product-region records, evidence ledger, uncertainty, owners, and next action.
2. Assessment returns a Zod-validated, evidence-linked result and a visible run ID, mode, and latency.
3. Quality then Regulatory reviews each start a workflow and enable the sole route.
4. Removing the EU qualification record blocks approval and disables the Regulatory review until evidence recovery.

## Demo script

1. Frame the risk: X-17 is discontinued; the supplier’s replacement has a changed stabilizer package.
2. Show the three affected records, the evidence ledger, and run the assessment.
3. Record Quality and Regulatory reviews, then show the Product Change Lead route.
4. Trigger the missing-EU-record curveball. The route is removed and Regulatory becomes the required owner.
5. Explain the system boundary, schema validation, workflow durability, and the production rollout path.

## Trade-offs and known limits

- The system of record is an in-memory fixture by design. This proves the boundary without adding an integration or a credential-management surface.
- The fixture fallback lets reviewers use the public demo without a model key. It is deliberately labeled and should be replaced by a configured AI Gateway model in a real pilot.
- Review state is displayed in client state for the guided POC, while the audit event is sent through a durable Vercel Workflow. A production implementation would read the case and review state back from Apex’s durable source of record.
- The POC makes no unvalidated claim about cycle-time, cost, or quality improvement. A pilot should baseline documented-decision time, review wait time, assessment rework, and late customer notifications.
