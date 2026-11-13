import { cases } from "@/lib/cases";
import { users } from "@/lib/users";
import { ApexMark } from "./apex-mark";

const news = [
  { caseId: "SCC-2026-041", date: "12 Nov 2026", title: "A new binder for AeroShield 420 enters review", image: 6583367, alt: "A fan of coating colour samples", summary: "Meridian has proposed X-17R to replace its discontinued binder. The stabilizer package has changed.", detail: "Quality will check whether the replacement meets the coating’s qualification requirements. Regulatory Affairs will review the notification obligations for EMEA customers. FlexAdd 88 uses a different binder and falls outside this review." },
  { caseId: "SCC-2026-033", date: "2 Sep 2026", title: "PD-4 production moves to a new site", image: 34221993, alt: "Machinery on a production line", summary: "Halvorsen Chemie’s site transfer went through Apex change control. The decision included customer notification.", detail: "The transfer concerned where the dispersant was produced. The closed case records the decision as approved with customer notification, giving the next reviewer a reference for a supplier site change." },
  { caseId: "SCC-2026-029", date: "11 Aug 2026", title: "AO-12 packaging review closes", image: 34221998, alt: "Packed cartons in a warehouse", summary: "Apex reviewed Corvane Industrial’s packaging change and recorded no product impact.", detail: "This case concerned the packaging around the antioxidant. The recorded outcome distinguishes a packaging update from a formulation change that requires product requalification." },
];

const history = [
  ["1828", "Mineral pigments", "Apex begins with mineral pigments. Matching a colour from one batch to the next makes the source material and its preparation central to the work."],
  ["1957", "Coatings additives", "The product line expands into coatings additives. Engineers now track how each ingredient behaves in the finished formulation."],
  ["1994", "Rotterdam", "An EMEA hub brings regional customers closer to Apex. Colleagues in Rotterdam and Cleveland share responsibility for changes that cross markets."],
];

const roles: Record<string,string> = {
  dana: "Dana brings the supplier notice to the right people and turns their signed reviews into a plan the next shift can follow.",
  priya: "Priya checks the proposed binder against the coating’s qualification record and identifies what needs a new trial.",
  marcus: "Marcus checks what the change means for EMEA customers. When a qualification record is missing, he flags the gap before the plan moves on.",
};

export function MaterialJourney() {
  return <main className="company">
    <div className="cover" id="top">
      <header><a href="#top" className="identity"><ApexMark size={38}/><strong>APEX<small>ADDITIVES</small></strong></a><a className="login" href="/signin">Log in</a></header>
      <h1>Made at Apex.</h1>
      <nav aria-label="Company sections">{["News","History","Culture"].map(s=><a key={s} href={"#"+s.toLowerCase()}>{s} ↓</a>)}</nav>
    </div>
    <section className="edition" id="news"><h2>Company news</h2>
      <div className="stories">{news.map(n=><article key={n.caseId}>
        <img src={`/journal/${n.image}.webp`} alt={n.alt} loading="lazy"/>
        <div className="story-body"><small>{n.date} / {cases.find(c=>c.id===n.caseId)?.state === "open" ? "In review" : "Closed"}</small>
        <h3>{n.title}</h3><p>{n.summary}</p><details><summary>Read update</summary><p>{n.detail}</p>{n.caseId===cases[0].id && <a href={`/cases/${n.caseId}`}>Open case file →</a>}</details></div>
      </article>)}</div>
    </section>
    <section className="history" id="history"><div className="history-photo"><span>Our history</span><h2>Since 1828.</h2></div>
      <ol>{history.map(([year,title,story])=><li key={year}><time>{year}</time><div><h3>{title}</h3><p>{story}</p></div></li>)}</ol>
    </section>
    <section className="people edition" id="culture"><figure><img src="/journal/8851453.webp" alt="Two scientists comparing a sample at a laboratory bench" loading="lazy"/></figure>
      <div><small>Our culture</small><h2>One change,<br/>three perspectives.</h2><p>When a supplier changes an ingredient, the people who own the product, the qualification and the customer relationship review it together.</p>
      <ul>{users.map(u=><li key={u.id}><h3>{u.name}</h3><small>{u.role} / {u.site}</small><p>{roles[u.id]}</p></li>)}</ul></div>
    </section>
    <footer>Apex Additives<a href="#top">Back to top ↑</a></footer>
  </main>;
}
