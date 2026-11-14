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
      <span>Solution brief · November 2026</span>
      <a className="brief-cta" href={`${APP}/signin`}>Open the demo</a>
    </header>

    <main className="brief-main">
      <section className="brief-hero">
        <p className="brief-for">For Apex Additives · Change Control, Quality, Regulatory</p>
        <h1>Supplier changes decided in days, not weeks.</h1>
        <div className="value-pair">
          <div><strong>AI on top of the systems you already run</strong><p>SAP, Veeva and the regulatory service stay. Every AI answer cites a record.</p></div>
          <div><strong>People still decide</strong><p>Each case waits for Quality and Regulatory sign-off, and keeps a full history.</p></div>
          <div><strong>A Helper for the team</strong><p>Plans the day, drafts check-ins and reports from the same live numbers.</p></div>
        </div>
      </section>

      <nav className="brief-toc" aria-label="Sections">{sections.map(([id, label], i) => <a key={id} href={`#${id}`}><span>{i + 1}</span>{label}</a>)}</nav>

      <section id="problem" className="brief-section">
        <h2>1 · The problem</h2>
        <p className="lede">A supplier ends Binder X-17. Apex must find every affected product, check it is qualified, and tell customers on time.</p>
        <ul className="ticks">
          <li>Today this is SAP exports, Veeva look-ups, Excel and email sign-offs.</li>
          <li>Late notices mean penalties; missing records mean audit findings.</li>
        </ul>
        <div className="bars" aria-label="Time from supplier notice to documented decision, estimated">
          <div><span>Today</span><i style={{ width: "100%" }} /><b>1 to 3 weeks</b></div>
          <div><span>With the workspace</span><i style={{ width: "8%" }} /><b>1 to 2 days</b></div>
        </div>
        <p className="note">Today's figure is Apex's own estimate; the pilot measures both.</p>
      </section>

      <section id="architecture" className="brief-section">
        <h2>2 · Architecture</h2>
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
              <li><strong>Next.js workspace</strong><span>board, case page, Helper</span></li>
              <li><strong>Workflows</strong><span>one durable run per case</span></li>
              <li><strong>AI SDK agent</strong><span>read-only tools, checked output</span></li>
              <li><strong>AI Gateway</strong><span>fallback, cost, budget</span></li>
            </ul>
          </div>
        </div>
        <p className="note">Nothing is copied or migrated. Systems of record stay validated where they are.</p>
      </section>

      <section id="choices" className="brief-section">
        <h2>3 · Why Vercel, and the trade-offs</h2>
        <table className="brief-table">
          <thead><tr><th>Choice</th><th>Why</th><th>Trade-off</th></tr></thead>
          <tbody>
            <tr><td>AI SDK + Gateway</td><td>Any model, automatic fallback, cost per run, hard budget.</td><td>The model is checked by policy, not trusted.</td></tr>
            <tr><td>Workflows</td><td>Cases wait days for people; runs survive crashes and deploys.</td><td>Open runs keep the code they started on.</td></tr>
            <tr><td>Fluid Compute</td><td>Mostly waiting on AI and SAP; billed for active CPU only.</td><td>Long work moves into the workflow.</td></tr>
            <tr><td>Rolling Releases</td><td>Every release goes to 10%, then 50%, then everyone, with approval.</td><td>Needs the Git release path.</td></tr>
            <tr><td>Runtime Cache</td><td>Helper's per-person limit, shared by all instances.</td><td>Best effort; the Gateway budget is the hard cap.</td></tr>
            <tr><td>Secure Compute</td><td>Private link into Apex's network.</td><td>Production only; mocked in the demo.</td></tr>
          </tbody>
        </table>
      </section>

      <section id="demo" className="brief-section">
        <h2>4 · Try it</h2>
        <div className="cols">
          <ul className="links">
            <li><a href={`${APP}/signin`}>Live workspace</a></li>
            <li><a href={REPO}>Public repository</a></li>
            <li><a href="https://apex-systems-mock.vercel.app/health">Mock of Apex's systems</a></li>
          </ul>
          <ul className="ticks">
            <li><strong>Dana</strong>, Change Lead: runs the assessment</li>
            <li><strong>Priya</strong>, Quality: signs off scope</li>
            <li><strong>Marcus</strong>, Regulatory: signs off notices</li>
          </ul>
        </div>
        <ol className="steps-list">
          <li>As Dana, open Binder X-17 and run the assessment.</li>
          <li>Sign off as Priya, then Marcus; send the plan.</li>
          <li>Pick a failure scenario and run it again.</li>
          <li>Open Analytics, then ask Helper for a Q4 report.</li>
        </ol>
      </section>

      <section id="rollout" className="brief-section">
        <h2>5 · Rollout</h2>
        <ol className="timeline">
          <li><strong>Preview</strong><span>Every change gets its own link.</span></li>
          <li><strong>Validate</strong><span>AI tests must pass.</span></li>
          <li><strong>Canary</strong><span>10%, then 50% of users. Used for this demo.</span></li>
          <li><strong>Cut over</strong><span>100%; pilot team moves in.</span></li>
          <li><strong>Roll back</strong><span>One click; open cases keep running.</span></li>
        </ol>
      </section>

      <section id="success" className="brief-section">
        <h2>6 · Success and pilot</h2>
        <div className="cols">
          <ul className="ticks">
            <li><strong>Business:</strong> days to decision, notices on time, audit findings. Tracked on the Analytics page.</li>
            <li><strong>Technical:</strong> valid citations, cost per run, fallback rate.</li>
          </ul>
          <ul className="ticks">
            <li><strong>Pilot:</strong> one product line, 10 past cases as baseline.</li>
            <li><strong>Exit:</strong> decisions in days, 100% valid citations, no missed notices.</li>
          </ul>
        </div>
      </section>

      <section id="risks" className="brief-section">
        <h2>7 · Risks</h2>
        <ul className="ticks">
          <li>The model makes mistakes. A policy check corrects it, and people sign off.</li>
          <li>The demo reads a mock; real systems need Secure Compute and test data.</li>
          <li>Demo sign-in has no passwords; production uses Apex SSO.</li>
          <li>EU data rules need regions and providers set before go-live.</li>
        </ul>
      </section>

      <section id="validation" className="brief-section">
        <h2>8 · How the AI was checked</h2>
        <div className="stats">
          <div><strong>{evals.finalAnswerCorrect}</strong><span>correct after the policy check</span></div>
          <div><strong>{evals.modelStatusAccuracy.replace(" findings", "")}</strong><span>right from the model alone</span></div>
          <div><strong>{evals.inventedCitations}</strong><span>invented citations caught</span></div>
          <div><strong>${evals.averageCostUsd.toFixed(4)}</strong><span>average cost per run</span></div>
        </div>
        <p className="note">{evals.runs} real runs across three scenarios (<code>npm run eval</code>), plus policy tests without a model (<code>npm test</code>). Last run {new Date(evals.ranAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}. Built with Claude Code, Codex and the Vercel CLI.</p>
      </section>

      <section id="feedback" className="brief-section">
        <h2>9 · Feedback on Vercel</h2>
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
