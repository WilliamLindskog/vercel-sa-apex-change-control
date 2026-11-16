import type { Metadata } from "next";
import Link from "next/link";
import { PublicAccount } from "@/app/signin/public-account";
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
  ["choices", "Why Vercel"],
  ["demo", "Demo"],
  ["rollout", "Rollout"],
  ["success", "Success"],
  ["risks", "Risks"],
  ["validation", "AI checks"],
  ["feedback", "Feedback"],
] as const;

export default function Brief() {
  return <div className="brief">
    <header className="brief-bar">
      <Link href="/signin" className="brief-brand" aria-label="Apex"><ApexLogo size={26} /></Link>
      <span>Solution brief | November 2026</span>
      <PublicAccount />
    </header>

    <main className="brief-main">
      <section className="brief-hero">
        <p className="brief-for">For Apex Additives | Product Management, Lab, Production & QC, Regulatory</p>
        <h1>Agree the testing plan before the notice deadline.</h1>
        <div className="value-pair">
          <div><strong>AI on top of the systems you already run</strong><p>SAP, Veeva and the regulatory service stay. Each product finding links to the records used in its assessment.</p></div>
          <div><strong>People still decide</strong><p>Each case waits for three sign-offs in order (technical, quality, regulatory) and keeps a full history.</p></div>
        </div>
      </section>

      <p className="note"><a href="/apex-pilot.pdf">View the customer slide deck (PDF)</a></p>
      <nav className="brief-toc" aria-label="Sections">{sections.map(([id, label], i) => <a key={id} href={`#${id}`}><span>{i + 1}</span>{label}</a>)}</nav>

      <section id="problem" className="brief-section">
        <h2>1 | The problem</h2>
        <p className="lede">A supplier ends corrosion inhibitor CI-17, a raw material. Apex must find every final product that contains it, decide what testing each needs, and tell customers on time.</p>
        <ul className="ticks">
          <li>Today this is SAP exports, Veeva look-ups, Excel and email sign-offs.</li>
          <li>Late notices mean penalties; missing records mean audit findings.</li>
        </ul>
        <div className="bars" aria-label="Time from supplier notice to an agreed plan, estimated">
          <div><span>Today</span><i style={{ width: "100%" }} /><b>1 to 3 weeks</b></div>
          <div><span>Pilot target</span><i style={{ width: "8%" }} /><b>≤ 2 days</b></div>
        </div>
        <p className="note">In the illustrative case history, the manual median is 16 days and 7 of 32 notices were late. At 36 cases per year and $95 per hour, reducing effort from 18 to 3 hours per case would release 540 hours, valued at $51,300 annually before pilot and operating costs.</p>
      </section>

      <section id="architecture" className="brief-section">
        <h2>2 | Architecture</h2>
        <h3>Today</h3>
        <ol className="flow" aria-label="Current state">
          <li><strong>Supplier notice</strong><span>PDF in one buyer's inbox</span></li>
          <li><strong>Manual look-ups</strong><span>SAP export, Veeva search, rules lookup</span></li>
          <li><strong>Spreadsheet + email</strong><span>joined by hand, sign-offs by reply</span></li>
          <li className="is-pain"><strong>Agreed plan</strong><span>1 to 3 weeks, no single record</span></li>
        </ol>
        <h3>With Vercel</h3>
        <div className="arch">
          <div className="arch-col stays">
            <h3>Stays at Apex</h3>
            <ul>
              <li><strong>SAP S/4HANA</strong><span>where-used</span></li>
              <li><strong>Veeva Vault QMS</strong><span>qualifications</span></li>
              <li><strong>Regulatory service</strong><span>notice rules</span></li>
              <li><strong>SSO and audit store</strong><span>identity, decisions</span></li>
            </ul>
          </div>
          <div className="arch-boundary">
            <span>Read-only API</span>
            <i aria-hidden="true" />
            <small>Production: Secure Compute. Demo: a token-protected mock.</small>
          </div>
          <div className="arch-col vercel">
            <h3>On Vercel</h3>
            <ul>
              <li><strong>Next.js workspace</strong><span>board, case page, Mango</span></li>
              <li><strong>Workflows</strong><span>one durable run per case</span></li>
              <li><strong>AI SDK agent</strong><span>read-only tools, checked output</span></li>
              <li><strong>AI Gateway</strong><span>fallback, estimated model cost and spend controls</span></li>
              <li><strong>Vercel Connect</strong><span>phase 2: Outlook, Teams, Salesforce</span></li>
            </ul>
          </div>
        </div>
        <p className="note">SAP, Veeva and Regulatory remain authoritative. The workspace retains the evidence, decision history and approvals needed for each case.</p>
      </section>

      <section id="choices" className="brief-section">
        <h2>3 | Why Vercel, and the trade-offs</h2>
        <table className="brief-table">
          <thead><tr><th>Choice</th><th>Why</th><th>Trade-off</th></tr></thead>
          <tbody>
            <tr><td>AI SDK + Gateway</td><td>Any model, automatic fallback, cost per run, hard budget.</td><td>The model is checked by policy, not trusted.</td></tr>
            <tr><td>Workflows</td><td>Cases wait days for people; runs survive crashes and deploys.</td><td>Open runs keep the code they started on.</td></tr>
            <tr><td>Cache Components</td><td>Pages paint a static shell at once; reference data is cached and tagged.</td><td>The live case is never cached, so sign-offs are never stale.</td></tr>
            <tr><td>Fluid Compute</td><td>CPU billing pauses during I/O waits. Memory and invocations also contribute to cost.</td><td>Long work moves into the workflow.</td></tr>
            <tr><td>Rolling Releases</td><td>Every release goes to 10%, then 50%, then everyone, with approval.</td><td>Needs the Git release path.</td></tr>
            <tr><td>Runtime Cache</td><td>Mango's per-person limit, shared by all instances.</td><td>Best effort; the Gateway budget is the hard cap.</td></tr>
            <tr><td>Vercel Connect (phase 2)</td><td>Per-person access to Outlook, Teams and Salesforce, through connectors IT approves.</td><td>Each person consents once per tool.</td></tr>
            <tr><td>Secure Compute</td><td>Private link into Apex's network.</td><td>Production only; mocked in the demo.</td></tr>
            <tr><td>Open source core</td><td>Next.js, the AI SDK and the Workflow SDK are open source; the app is plain TypeScript in Apex's repo.</td><td>Moving to another host would require equivalent workflow storage, routing and release controls.</td></tr>
          </tbody>
        </table>
      </section>

      <section id="demo" className="brief-section">
        <h2>4 | Try it</h2>
        <div className="cols">
          <ul className="links">
            <li><a href={`${APP}/signin`}>Live workspace</a></li>
            <li><a href={REPO}>Public repository</a></li>
            <li><a href="https://apex-systems-mock.vercel.app/health">Mock of Apex's systems</a></li>
          </ul>
          <ul className="ticks">
            <li><strong>Peter</strong>, Product Manager: leads the change, runs the impact check, sends the plan</li>
            <li><strong>Lisa</strong>, Lab Manager: technical assessment (lab-scale tests)</li>
            <li><strong>Quinn</strong>, Production & QC: quality assessment (production trial, QC tests)</li>
            <li><strong>Rachel</strong>, Regulatory Expert: regulatory assessment (compliance, customer notices)</li>
            <li>Plus <strong>Paula</strong> and <strong>Quentin</strong> for Plastics and Inks</li>
          </ul>
        </div>
        <ol className="steps-list">
          <li>As Peter, open Corrosion inhibitor CI-17 and run the impact check.</li>
          <li>Approve the plans as Lisa, then Quinn, then Rachel; back as Peter, send the plan.</li>
          <li>Pick a failure scenario and run it again.</li>
          <li>Open Analytics, then ask Mango for a Q4 report.</li>
        </ol>
      </section>

      <section id="rollout" className="brief-section">
        <h2>5 | Rollout</h2>
        <ol className="timeline">
          <li><strong>Preview</strong><span>Every change gets its own link.</span></li>
          <li><strong>Validate</strong><span>All 10 historical outcomes match and model-backed checks pass.</span></li>
          <li><strong>Canary</strong><span>10%, then 50% of users. Used for this demo.</span></li>
          <li><strong>Cut over</strong><span>100%; pilot team moves in.</span></li>
          <li><strong>Roll back</strong><span>One click; open cases keep running.</span></li>
        </ol>
        <h3>Phase 2: connect the tools people already use</h3>
        <p className="note">Through Vercel Connect: Apex IT approves each connector once; each person connects their own account; the app gets short-lived tokens, never stored secrets.</p>
        <ul className="ticks">
          <li><strong>Outlook</strong>: a supplier email opens the case workflow on its own.</li>
          <li><strong>Teams or Slack</strong>: Mango sends the check-ins it drafts, as the person.</li>
          <li><strong>Salesforce</strong>: one more read-only tool names the customers to notify.</li>
        </ul>
      </section>

      <section id="success" className="brief-section">
        <h2>6 | Success and pilot</h2>
        <div className="cols">
          <ul className="ticks">
            <li><strong>Business:</strong> compare workflow timestamps, reviewer time and actual delivery receipts from Customer Service with the baseline. Analytics illustrates these measures with sample data.</li>
            <li><strong>Technical:</strong> valid citations, cost per run, fallback rate.</li>
          </ul>
          <ul className="ticks">
            <li><strong>Pilot:</strong> one product line for six weeks. Apex supplies 10 historical cases with known outcomes.</li>
            <li><strong>Owner:</strong> a Product Manager, with one Lab, one Production & QC and one Regulatory reviewer.</li>
          </ul>
        </div>
        <table className="brief-table gates">
          <thead><tr><th>Entry: before the pilot</th><th>Gates: to widen the rollout</th><th>Exit: pilot succeeded</th></tr></thead>
          <tbody><tr>
            <td><ul className="ticks">
              <li>Sponsor and account executive agree the pilot budget, one product line, staffing and week-six decision in writing</li>
              <li>Read-only test access to SAP, Veeva and regulatory, over Secure Compute</li>
              <li>Apex SSO on; roles from directory groups</li>
              <li>Ten adjudicated cases and notice dates available for validation</li>
              <li>Security and data review signed off</li>
            </ul></td>
            <td><ul className="ticks">
              <li><strong>Preview → 10%:</strong> tests and AI checks pass; a reviewer approves</li>
              <li><strong>10% → 50%:</strong> no workflow errors or invalid citations; cost and fallback in budget</li>
              <li><strong>50% → 100%:</strong> pilot users agree with the decisions</li>
              <li><strong>Roll back:</strong> any invalid citation or error spike</li>
            </ul></td>
            <td><ul className="ticks">
              <li>Median plan time ≤ 2 days and mean effort ≤ 3 staff hours per case</li>
              <li>Reviewers verify that every material finding cites supporting evidence. Missing qualifications block routing.</li>
              <li>Customer Service confirms every due notice arrived on time</li>
              <li>Sponsor reviews measured results and costs with the account executive</li>
            </ul></td>
          </tr></tbody>
        </table>
      </section>

      <p className="note"><strong>Week-six decision.</strong> If the agreed gates pass, the sponsor and account executive review a priced deployment for the next product line. Otherwise pause expansion, record the gap and agree whether to stop or fund a time-boxed correction. New connectors require a separate scope decision.</p>

      <section id="risks" className="brief-section">
        <h2>7 | Risks</h2>
        <ul className="ticks">
          <li>The model makes mistakes. A policy check corrects it, and people sign off.</li>
          <li>The demo reads a mock; real systems need Secure Compute and test data.</li>
          <li>Demo sign-in is a role switcher. Production: Apex SSO over OIDC, roles from directory groups, every sign-off tied to the real person, and Vercel Passport in front of every deployment.</li>
          <li>EU data rules need regions and providers set before go-live. AI Gateway supports zero data retention and Apex's own provider keys.</li>
        </ul>
      </section>

      <section id="validation" className="brief-section">
        <h2>8 | How the AI was checked</h2>
        <div className="stats">
          <div><strong>{evals.finalAnswerCorrect}</strong><span>runs matched all expected product dispositions</span></div>
          <div><strong>{evals.modelStatusAccuracy.replace(" findings", "")}</strong><span>product disposition labels correct before policy</span></div>
          <div><strong>{evals.inventedCitations}</strong><span>unreturned citation IDs removed (occurrences)</span></div>
          <div><strong>${evals.averageCostUsd.toFixed(4)}</strong><span>estimated model cost per assessment</span></div>
        </div>
        <p className="note">{evals.runs} real runs across three scenarios (<code>npm run eval</code>), scoring final dispositions against hand-written expectations. Reviewers assess the relevance of citations and explanations separately. Policy and approval tests run without a model (<code>npm test</code>). Last run {new Date(evals.ranAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}. Built with Claude Code, Codex and the Vercel CLI.</p>
      </section>

      <section id="feedback" className="brief-section">
        <h2>9 | Feedback on Vercel</h2>
        <div className="cols">
          <ul className="ticks">
            <li><strong>Good:</strong> OIDC for AI Gateway, so no API keys.</li>
            <li><strong>Good:</strong> Workflow hooks made sign-off a few lines.</li>
          </ul>
          <ul className="ticks">
            <li><strong>Better:</strong> free-tier rate limit reads like a model ban.</li>
            <li><strong>Better:</strong> <code>modelId</code> hides which model served after fallback.</li>
          </ul>
        </div>
      </section>
    </main>

    <footer className="brief-foot">Apex is a fictional company created for a Vercel Solutions Architect take-home.</footer>
  </div>;
}
