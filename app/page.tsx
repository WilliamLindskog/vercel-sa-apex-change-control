import Link from "next/link";
import { ApexMark } from "@/app/ui/apex-mark";
import { users } from "@/lib/users";
import "./heritage.css";

export const metadata = { title: "Inside Apex" };

const chapters = [
  { id: "news", label: "News", image: 4084699, credit: "Johannes Plenio", title: "Inside Apex", text: "This week at Apex, our Cleveland and Rotterdam teams are bringing supplier notices, qualification records and review decisions into one shared case file." },
  { id: "history", label: "History", image: 31853326, credit: "Matheus Bertelli", title: "From earth to colour", text: "Our story began in 1828 with mineral pigments. A dependable colour depended on the material, the hand at the bench and a record of what worked. That knowledge still travels with every formulation." },
  { id: "culture", label: "Culture", image: 18992322, credit: "Daniel Torobekov", title: "The next pair of hands", text: "A colleague picking up a sample should know where it came from, what changed and what still needs a trial. Leaving a clear record is one way we take care of each other across shifts and time zones." },
  { id: "team", label: "Team", image: 18992321, credit: "Daniel Torobekov", title: "Across the Atlantic", text: "Meet the colleagues guiding supplier changes from the first notice to a regional decision." },
];

export default function Home() {
  return <main className="journal">
    <header className="journal-bar"><a className="wordmark" href="#news"><ApexMark size={28}/>Apex Additives</a>
      <nav aria-label="Chapters">{chapters.map(c => <a key={c.id} href={`#${c.id}`}>{c.label}</a>)}</nav>
      <Link className="workspace-link" href="/cases">Workspace ↗</Link>
    </header>
    {chapters.map((chapter, i) => <section id={chapter.id} key={chapter.id} className="chapter" aria-labelledby={chapter.id+"-title"}>
      <div className="scene"><img src={`/journal/${chapter.image}.jpg`} alt="" loading={i ? "lazy" : "eager"} fetchPriority={i ? "auto" : "high"} /></div>
      <div className="chapter-inner"><div className="story">
        <p className="kicker">{chapter.label}<span/> {i === 0 ? "November 2026" : i === 1 ? "Est. 1828" : i === 2 ? "Working at Apex" : "Cleveland & Rotterdam"}</p>
        {i === 0 ? <h1 id="news-title">{chapter.title}</h1> : <h2 id={chapter.id+"-title"}>{chapter.title}</h2>}
        <p className="narrative">{chapter.text}</p>
        {chapter.id === "team" && <ul className="roster">{users.map(u => <li key={u.id}><strong>{u.name}</strong><span>{u.role}</span></li>)}</ul>}
      </div>
      <div className="chapter-foot">{i < chapters.length-1 ? <a href={`#${chapters[i+1].id}`}>↓ &nbsp; {chapters[i+1].label}</a> : <Link href="/cases">Enter workspace ↗</Link>}
        <a href={`https://www.pexels.com/photo/${chapter.image}/`}>Photo by {chapter.credit} ↗</a></div></div>
    </section>)}
  </main>;
}
