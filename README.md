# Apex Change Control

A supplier-change workspace for Apex Additives, a fictional specialty-additives maker. Built on Vercel for a Solutions Architect take-home.

When a supplier changes or discontinues a material, Apex must find every affected product, check each one is qualified, and notify customers on time. Today that takes 1 to 3 weeks of SAP exports, Veeva look-ups, spreadsheets and email. This workspace reads across those systems, has AI draft the assessment with a citation for every finding, and holds the case until Quality and Regulatory sign off.

- **Live app:** https://vercel-sa-take-home-build.vercel.app (Sign in → use a demo account)
- **Solution brief (customer-facing):** https://vercel-sa-take-home-build.vercel.app/brief
- **Mock of Apex's systems:** https://apex-systems-mock.vercel.app/health

## Demo accounts

| Account | Role | Does |
| --- | --- | --- |
| Dana Okafor | Product Change Lead, Coatings | Runs the assessment, sends the plan |
| Ingrid Solberg | Product Change Lead, Plastics & Inks | Same, for her product lines |
| Priya Raman | Quality | Signs off the technical scope |
| Marcus Lindqvist | Regulatory Affairs, EMEA | Signs off customer notices |
| Kenji Watanabe | Quality, Plastics & Inks | Signs off the technical scope |
| Lucía Fernández | Regulatory Affairs, Americas | Signs off customer notices |

The demo uses directory accounts without passwords; production would use Apex SSO.

## What's in it

- **Board and Calendar:** every case by stage, with whose turn it is. The board is drag-to-advance where the case rules allow it, and the calendar runs from notice to end of supply. Every case is live: 11 supplier changes across Coatings, Plastics and Inks, each its own durable workflow with its own lead and reviewers. Cases that start part-way replay their earlier steps through the same rules. A bell lists the cases waiting on you.
- **Case page:** the answer first (affected products, what needs re-testing, what can't be decided), then sign-offs and the evidence behind each finding.
- **Analytics:** days to decision against the manual baseline, time and cost saved, notices on time, problems caught and AI spend, filtered by period and product line.
- **Helper:** a chat assistant (lower right) that reads the same board and analytics data. It prioritises your day, drafts check-ins and drafts reports. It only drafts; people send.

## Architecture

```
 Apex (stays where it is)                   Vercel
 ┌──────────────────────────┐   read-only   ┌───────────────────────────────────────────────┐
 │ SAP S/4HANA  where-used  │◄──── API ─────│ Next.js workspace (Fluid Compute)             │
 │ Veeva QMS    qualif.     │  bearer token │  ├─ Workflow: one durable run per case        │
 │ Regulatory   notice rules│               │  │   └─ WorkflowAgent assessment (AI SDK)     │
 └──────────────────────────┘               │  ├─ Helper chat (AI SDK, tool calling)        │
  demo: apex-systems/ deployed as its own   │  └─ AI Gateway: fallback, cost, budget (OIDC) │
  Vercel project; prod: Secure Compute      └───────────────────────────────────────────────┘
```

- **The boundary** (`lib/apex-systems.ts`): each system speaks its own dialect (SAP OData, Veeva, a REST rules service) and is parsed with Zod at the edge. Every record read becomes a citable source. The mock in `apex-systems/` is a separate Vercel project protected by a token.
- **The case is a workflow** (`workflows/supplier-change-case.ts`): one run per case, waiting days for people through a hook keyed on the case ID. Sign-off rules are enforced in the run. It survives crashes and deploys because its state is the workflow's event history, not server memory.
- **The assessment is durable step by step** (`workflows/assessment.ts`): every system lookup and every model call is its own step, so a crash resumes after the last completed call without paying for the model twice. A final policy step re-reads the records and corrects the model where it's wrong.
- **AI Gateway** (`lib/assessment.ts`): `openai/gpt-5.4-nano` first, falling back to Gemini Flash and Claude Haiku. The served model and cost are recorded per run. Auth is the deployment's OIDC token, so there's no API key in the app.

## Rendering and caching

Cache Components is on (`next.config.ts`), with Partial Prefetching.

| What | How it renders | Why |
| --- | --- | --- |
| Solution brief | Static, built once | The same for everyone |
| Sign-in landing | Static shell; only the menu reads the URL | Fast first impression |
| Workspace frame (sidebar) | Static shell; account menu and Helper stream in | Who you are is a request-time cookie |
| Case index, analytics history | `"use cache"`, tagged `cases` / `analytics`, `cacheLife("hours")` | Shared reference data that changes rarely |
| Live case (Binder X-17), "in flight" | Request time (`connection()`), streamed behind `<Suspense>` | Workflow state changes on its own schedule; a sign-off must never be stale |

- **Sign-in gate:** `proxy.ts`, before any page renders. That is what lets the pages keep a static shell.
- **Invalidation:** `POST /api/revalidate` with a shared secret calls `revalidateTag(tag, "max")`. In production, Apex's systems would call it when a case is decided or the case index changes.

## Vercel features used

| Feature | Why | Trade-off accepted |
| --- | --- | --- |
| Next.js on Fluid Compute | Mostly waiting on AI and Apex's systems; billed for active CPU. Pinned with the region in `vercel.ts` | Long work moves into the workflow; the page shows live progress |
| Cache Components | Static shell, streamed live data, tagged cache for reference data | The live case is deliberately never cached |
| Workflows | Cases wait days for people; durable, auditable, enforces sign-off | Open runs keep the code they started on |
| AI SDK + AI Gateway | One API for any model, automatic fallback, cost per run, hard budget | The model is checked by a policy step, never trusted alone |
| Runtime Cache | Helper's per-person hourly limit, shared across instances | No atomic increment: a best-effort guard; the Gateway budget is the hard cap |
| Git deploys + Rolling Releases | A preview link per change; production rolls out 10% → 50% → 100% with manual approval | Needs the Git-connected path, set up mid-project |
| Secure Compute (production only) | Private link into Apex's network | Mocked in the demo |

## Spend guards

- AI Gateway budget: $5/month on the project (hard cap).
- Assessment: 20 AI runs per case per day, 8 model calls and 2,000 output tokens per call. After that, the policy rules answer alone and say so.
- Helper: 30 questions per person per hour, 12 turns of history, 900 output tokens, 25-second timeout.

## How the AI was checked

- `npm test`: policy tests run the mock in-process and check every scenario and correction, without a model.
- `npm run eval`: real assessments across three scenarios (normal, missing EU qualification, quality system down), checked against hand-written answers. Latest results are in `evals/results/latest.json`: 15/15 correct after the policy check, 42/45 findings right from the model alone, and every invented citation caught.

## Release and rollback

Every change gets a preview link from its branch. Merging to `main` builds production, which rolls out through Rolling Releases: 10%, then 50%, then 100%, each step approved by hand (`vercel rolling-release approve`).

Rehearsed on 14 Nov 2026:

- `vercel rollback <previous deployment>` put the previous version on production in about 3 seconds, for all traffic, with no canary.
- The live case's workflow run kept the same run ID and state through the rollback and the return. Runs live in Workflows, not in a deployment.
- `vercel promote <new deployment>` brings the new version back, but with Rolling Releases on it starts again at 10%: going forward is gradual, going back is instant.
- A new rollout can't start while one is active; finish it (`complete`) or abort it first.

## Run locally

```bash
npm install
node apex-systems/dev.js   # mock of Apex's systems on :4100
```

```bash
vercel env pull .env.development.local   # AI Gateway OIDC token
npm run dev
```

Without `APEX_SYSTEMS_URL` and `APEX_SYSTEMS_TOKEN`, local runs use the mock on `localhost:4100`. A deployed environment refuses to start without them.

## Known limits

- The mock stands in for SAP, Veeva and the regulatory service; real integration needs Apex's API gateway and Secure Compute.
- The analytics history (Jan to Oct) is example data, labelled as such. Cases loaded part-way replay their assessment with the policy rules, not the model.
- Demo sign-in has no passwords.
- EU data rules need function regions and provider routing set before production.
