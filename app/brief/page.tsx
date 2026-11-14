import type { Metadata } from "next";
import Link from "next/link";
import { ApexLogo } from "@/app/ui/apex-mark";
import evalResults from "@/evals/results/latest.json";
import "./brief.css";

export const metadata: Metadata = {
  title: "Solution brief",
  description: "How Vercel helps Apex decide supplier changes faster, with evidence and human sign-off, alongside the systems Apex already runs.",
};

const APP = "https://vercel-sa-take-home-build.vercel.app";
const REPO = "https://github.com/WilliamLindskog/vercel-sa-apex-change-control";
const evals = evalResults.summary;

const sections = [
  ["problem", "Problem"],
  ["architecture", "Architecture"],
  ["choices", "Vercel choices"],
  ["demo", "Demo"],
  ["rollout", "Rollout"],
  ["success", "Success and pilot"],
  ["risks", "Risks"],
  ["validation", "AI validation"],
  ["feedback", "Feedback"],
] as const;

export default function Brief() {
  return <div className="brief">
    <header className="brief-bar">
      <Link href="/signin" className="brief-brand" aria-label="Apex"><ApexLogo size={26} /></Link>
      <span>Solution brief · November 2026</span>
      <a className="brief-cta" href={`${APP}/signin`}>Open the demo</a>
    </header>

    <main className="brief-main">
      <section className="brief-hero">
        <p className="brief-for">For Apex Additives · Product Change Control, Quality, Regulatory Affairs</p>
        <h1>Supplier changes decided in days, with every answer traceable to a record.</h1>
        <div className="value-pair">
          <div><strong>Add trustworthy AI to the systems Apex already runs.</strong><p>SAP, the quality system and the regulatory service stay where they are. Vercel adds the workspace and an AI that reads across them, cites every record and gets corrected when it is wrong.</p></div>
          <div><strong>Every decision is durable, auditable and approved by people.</strong><p>Each case is a durable workflow that waits for Quality and Regulatory sign-off, survives restarts and deploys, and keeps a full history.</p></div>
        </div>
      </section>

      <nav className="brief-toc" aria-label="Sections">{sections.map(([id, label], i) => <a key={id} href={`#${id}`}><span>{i + 1}</span>{label}</a>)}</nav>

      <section id="problem" className="brief-section">
        <h2>1 · The problem</h2>
        <p className="lede">A supplier discontinues Binder X-17. Before the last order date, Apex must know which products and markets use it, whether each is qualified, and which customers must be told and when.</p>
        <div className="cols">
          <div>
            <h3>Today</h3>
            <ul className="ticks">
              <li>The notice arrives as a PDF in one buyer's inbox.</li>
              <li>Someone exports a where-used list from SAP, checks qualifications in Veeva, finds notice rules in the regulatory system and joins it all in Excel.</li>
              <li>Sign-offs happen over email. Missing records go unnoticed.</li>
            </ul>
          </div>
          <div>
            <h3>What it costs</h3>
            <ul className="ticks">
              <li>1 to 3 weeks from notice to a documented decision.</li>
              <li>Late or missed customer notices: contract penalties and stopped lines at customers.</li>
              <li>Audit findings, because no single record shows who decided what, on which evidence.</li>
            </ul>
          </div>
        </div>
        <div className="bars" aria-label="Time from supplier notice to documented decision, estimated">
          <div><span>Today, manual</span><i style={{ width: "100%" }} /><b>1 to 3 weeks</b></div>
          <div><span>With the workspace</span><i style={{ width: "8%" }} /><b>Assessment in under a minute; sign-offs in 1 to 2 days</b></div>
        </div>
        <p className="note">Today's figure is the customer's own estimate. The pilot measures both against a baseline Apex agrees before kickoff.</p>
      </section>

      <section id="architecture" className="brief-section">
        <h2>2 · Architecture: Vercel augments and connects</h2>
        <div className="arch">
          <div className="arch-col stays">
            <h3>Stays at Apex</h3>
            <ul>
              <li><strong>SAP S/4HANA</strong><span>materials, recipes, where-used</span></li>
              <li><strong>Veeva Vault QMS</strong><span>qualification records</span></li>
              <li><strong>Regulatory service</strong><span>customer notice rules per market</span></li>
              <li><strong>Apex SSO and audit store</strong><span>identity, record of decisions</span></li>
            </ul>
          </div>
          <div className="arch-boundary">
            <span>Read-only service API</span>
            <i aria-hidden="true" />
            <small>Production: Secure Compute (static egress IPs, VPC peering). Demo: mock deployed as its own project, token protected.</small>
          </div>
          <div className="arch-col vercel">
            <h3>On Vercel</h3>
            <ul>
              <li><strong>Next.js workspace</strong><span>case page, sign-offs, Fluid Compute functions</span></li>
              <li><strong>Workflows</strong><span>one durable run per case, human-in-the-loop hooks</span></li>
              <li><strong>AI SDK agent</strong><span>five read-only tools, schema-checked output</span></li>
              <li><strong>AI Gateway</strong><span>model fallback, per-run cost, $5/month budget</span></li>
            </ul>
          </div>
        </div>
        <h3>Why each system stays</h3>
        <ul className="ticks">
          <li><strong>SAP, Veeva and the regulatory service</strong> are the systems of record, validated and audited. The workspace only reads them; nothing is copied or migrated.</li>
          <li><strong>Identity</strong> stays with Apex SSO. The demo uses directory accounts without passwords.</li>
          <li><strong>The audit record</strong> stays with Apex: each sign-off is written back as an event, de-duplicated on case and time.</li>
        </ul>
      </section>

      <section id="choices" className="brief-section">
        <h2>3 · Vercel choices and trade-offs</h2>
        <table className="brief-table">
          <thead><tr><th>Choice</th><th>Why</th><th>Trade-off accepted</th></tr></thead>
          <tbody>
            <tr><td>AI SDK + AI Gateway</td><td>One API for every model, automatic fallback if a provider fails, cost and usage per run, a hard budget.</td><td>The model is not trusted on its own: a policy check re-derives every status from the records and corrects it.</td></tr>
            <tr><td>Workflows</td><td>A case waits days for people. The run is the record: it survives crashes and deploys, and enforces the sign-off rules.</td><td>Runs stay on the code they started with, so a deploy needs a new case run to pick up changes.</td></tr>
            <tr><td>Next.js on Fluid Compute</td><td>The app mostly waits on the model and Apex's systems; Fluid bills active CPU, not waiting time.</td><td>Long requests are avoided: the assessment runs in the workflow, and the page polls for the result.</td></tr>
            <tr><td>Secure Compute (production)</td><td>Apex's systems sit in a private network. Static egress IPs and VPC peering cross that boundary safely.</td><td>Not in the demo: a token-protected mock stands in for it.</td></tr>
            <tr><td>Rolling Releases</td><td>Canary new prompts or model changes to a share of traffic, with instant rollback.</td><td>Requires the Git-connected release path described in section 5.</td></tr>
          </tbody>
        </table>
      </section>

      <section id="demo" className="brief-section">
        <h2>4 · Try the demo</h2>
        <div className="cols">
          <div>
            <h3>Links</h3>
            <ul className="links">
              <li><a href={`${APP}/signin`}>Live workspace</a></li>
              <li><a href={REPO}>Public repository</a></li>
              <li><a href="https://apex-systems-mock.vercel.app/health">Mock of Apex's systems</a></li>
            </ul>
          </div>
          <div>
            <h3>Test accounts (Sign in → Use a demo account)</h3>
            <ul className="ticks">
              <li><strong>Dana Okafor</strong>, Product Change Lead: runs the assessment, receives the plan</li>
              <li><strong>Priya Raman</strong>, Quality: signs off the technical scope</li>
              <li><strong>Marcus Lindqvist</strong>, Regulatory Affairs: signs off customer notices</li>
            </ul>
          </div>
        </div>
        <ol className="steps-list">
          <li>Sign in as Dana, open case SCC-2026-041 and run the assessment.</li>
          <li>Switch to Priya, then Marcus, using the button on each sign-off card.</li>
          <li>Route the plan to Dana.</li>
          <li>Set the demo scenario to <em>EU record missing</em> or <em>Quality system down</em> and run it again.</li>
        </ol>
      </section>

      <section id="rollout" className="brief-section">
        <h2>5 · Rollout plan</h2>
        <ol className="timeline">
          <li><strong>Preview</strong><span>Every change gets its own preview deployment, connected to the mock or a QA copy of Apex's systems.</span></li>
          <li><strong>Validate</strong><span>The AI test set runs against the preview; the policy tests must pass.</span></li>
          <li><strong>Canary</strong><span>Rolling Release to 10%, then 50% of users, watching cost, policy corrections and fallback rate.</span></li>
          <li><strong>Cut over</strong><span>100% of traffic; the pilot team works only in the workspace.</span></li>
          <li><strong>Roll back</strong><span>Instant rollback to the previous deployment. Open case runs continue on the code they started with.</span></li>
        </ol>
      </section>

      <section id="success" className="brief-section">
        <h2>6 · Success measures and pilot</h2>
        <div className="cols">
          <div>
            <h3>Measures</h3>
            <ul className="ticks">
              <li><strong>Business:</strong> time from notice to documented decision; customer notices sent on time; audit findings.</li>
              <li><strong>Technical:</strong> every finding cites a record a system returned; correct answer after policy check on every run; cost per assessment; fallback rate.</li>
            </ul>
          </div>
          <div>
            <h3>Pilot</h3>
            <ul className="ticks">
              <li><strong>Entry:</strong> read access to one product line through Secure Compute, named Quality and Regulatory reviewers, 10 past supplier changes as a baseline.</li>
              <li><strong>Exit:</strong> decisions in days, not weeks; 100% valid citations; no missed notices across the 10 cases.</li>
              <li><strong>Commercial:</strong> a paid pilot that converts to an annual agreement when the exit criteria are met.</li>
            </ul>
          </div>
        </div>
        <h3>Chosen not to build</h3>
        <p className="note">Case creation, writing back to SAP or Veeva, autonomous approval, more workflows. Each is valuable later; none is needed to prove the decision pattern.</p>
      </section>

      <section id="risks" className="brief-section">
        <h2>7 · Known limitations and risks</h2>
        <ul className="ticks">
          <li>The model makes mistakes: it invented record IDs in testing. The policy check catches these, and people still sign off. A model is never the last word.</li>
          <li>The demo reads a mock, not SAP or Veeva. Real integration needs Apex's API gateway, Secure Compute and test data.</li>
          <li>Demo sign-in has no passwords. Production uses Apex SSO.</li>
          <li>AI Gateway free credits are rate limited; when the model is unavailable the policy answers alone and says so.</li>
          <li>Regional data rules (for example EU data staying in the EU) need function region and provider routing set before production.</li>
        </ul>
      </section>

      <section id="validation" className="brief-section">
        <h2>8 · How the AI was validated</h2>
        <div className="stats">
          <div><strong>{evals.finalAnswerCorrect}</strong><span>runs with the correct final answer after the policy check</span></div>
          <div><strong>{evals.modelStatusAccuracy.replace(" findings", "")}</strong><span>findings the model got right on its own</span></div>
          <div><strong>{evals.inventedCitations}</strong><span>invented citations caught and removed</span></div>
          <div><strong>${evals.averageCostUsd.toFixed(4)}</strong><span>average cost per assessment ({evals.models.join(", ")})</span></div>
        </div>
        <ul className="ticks">
          <li><strong>Policy tests</strong> (<code>npm test</code>): 8 tests run the mock in-process and check every scenario and every kind of correction, without a model.</li>
          <li><strong>AI test set</strong> (<code>npm run eval</code>): {evals.runs} real assessments across three scenarios, checked against answers written by hand from the records. Last run {new Date(evals.ranAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}.</li>
          <li><strong>Built with</strong> Claude Code and Codex in the terminal, the Vercel CLI, and the Next.js, AI SDK and Workflow docs shipped in <code>node_modules</code>. Every change was checked in a browser and with a production build.</li>
        </ul>
      </section>

      <section id="feedback" className="brief-section">
        <h2>9 · Feedback on Vercel</h2>
        <div className="cols">
          <div>
            <h3>Worked well</h3>
            <ul className="ticks">
              <li>OIDC for AI Gateway: no API key in the app at all, locally or deployed.</li>
              <li>Workflow hooks made human-in-the-loop sign-off a few lines of code, with durability for free.</li>
              <li>Version-matched docs inside <code>node_modules</code> kept the AI coding tools on current APIs.</li>
            </ul>
          </div>
          <div>
            <h3>Could be better</h3>
            <ul className="ticks">
              <li>The free-tier rate limit returns "Free tier users do not have access to this model", which reads like a model restriction.</li>
              <li><code>response.modelId</code> echoes the requested model after a Gateway fallback; the served model is only in routing metadata.</li>
              <li>A card is required before Gateway answers at all; the error links to billing, but a dashboard hint before the first request would help.</li>
            </ul>
          </div>
        </div>
      </section>
    </main>

    <footer className="brief-foot">Apex is a fictional company created for a Vercel Solutions Architect take-home.</footer>
  </div>;
}
