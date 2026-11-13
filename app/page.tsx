import Link from "next/link";
import { ApexMark } from "@/app/ui/apex-mark";
import "./heritage.css";

export const metadata = { title: "Our company | Apex Additives" };

export default function Home() {
  return <main className="heritage">
    <section className="heritage-cover">
      <header className="heritage-nav">
        <a className="heritage-name" href="/"><ApexMark size={32}/> Apex Additives</a>
        <nav aria-label="Company"><a href="#history">Our history</a><a href="#culture">Culture</a></nav>
        <Link className="staff-link" href="/cases">Employee workspace ↗</Link>
      </header>
      <div className="cover-title">
        <span className="folio">Specialty materials / Est. 1828</span>
        <h1>The people<br/>behind the <i>materials.</i></h1>
        <p>From mineral pigments to protective coatings, generations of Apex colleagues have shaped what goes into the finished product.</p>
      </div>
      <div className="cover-caption"><a href="#history">Explore our history ↓</a><a href="https://www.loc.gov/resource/det.4a18921/">Maumee River, Ohio / 1905–1920 ↗</a></div>
    </section>
    <section id="history" className="history-spread">
      <div className="history-copy"><span className="folio">Our history</span><h2>It began<br/>with pigment.</h2>
        <p>In 1828, Apex began with mineral pigments. Making a dependable colour meant knowing the material intimately and keeping a record that the next person at the bench could use.</p>
        <p>Today our teams work on additives for coatings and plastics. A change to a single binder can mean another round of qualification, a conversation with a supplier, or a call to a customer halfway around the world.</p>
      </div>
      <figure><img src="/archive/cleveland.jpg" width="1024" height="815" loading="lazy" alt="Archival view of industrial works in Cleveland, Ohio"/><figcaption>Federal Wire and Steel works, Cleveland <a href="https://www.loc.gov/resource/det.4a06931/">Library of Congress ↗</a></figcaption></figure>
    </section>
    <section id="culture" className="culture-spread"><span className="folio">Our culture</span><h2>How we work together.</h2>
      <div className="culture-columns"><article><h3>At the bench</h3><p>Quality starts with a sample and a question. When a supplier changes a formulation, our engineers establish what the evidence supports and what still needs a trial.</p></article>
      <article><h3>Across borders</h3><p>A coating can reach customers in several markets. Regulatory colleagues bring local requirements into the conversation before anyone commits to a change.</p></article>
      <article><h3>Between shifts</h3><p>The next colleague should be able to pick up a file and understand the decision. We record the source, the open question and the person who can answer it.</p></article></div>
    </section>
    <footer className="heritage-footer"><span className="heritage-name"><ApexMark size={26}/> Apex Additives</span><Link href="/cases">Enter employee workspace →</Link></footer>
  </main>;
}
