import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ApexMark } from "@/app/ui/apex-mark";
import brickMill from "@/app/ui/images/brick-mill-tower.jpg";
import brickWorks from "@/app/ui/images/brick-works.jpg";
import sandstone from "@/app/ui/images/sandstone-striated.jpg";
import sandstoneSwirl from "@/app/ui/images/sandstone-swirl.jpg";
import { currentUser } from "@/lib/session";
import { users } from "@/lib/users";
import { SignInMenu } from "./signin-menu";
import "./landing.css";

export const metadata: Metadata = { title: "Apex Additives" };

// Apex Additives is fictional. News, history, sites and figures below are demo copy.
const news = [
  { date: "12 Nov 2026", title: "Binder X-17 change review opens", image: sandstone },
  { date: "28 Oct 2026", title: "Rotterdam lab finishes REACH update", image: sandstoneSwirl },
  { date: "30 Sep 2026", title: "Cleveland marks 198 years", image: brickMill },
  { date: "4 Sep 2026", title: "Singapore technical service expands", image: brickWorks },
];

const eras = [
  { year: "1828", title: "Pigment works" },
  { year: "1871", title: "First laboratory" },
  { year: "1912", title: "Polymer stabilizers" },
  { year: "1957", title: "Coatings additives" },
  { year: "1994", title: "Rotterdam hub" },
  { year: "2026", title: "400+ product lines" },
];

const values = ["Evidence before opinion", "People approve", "Every region counts", "No customer surprised"];
const sites = ["Cleveland", "Rotterdam", "Singapore"];

const credits = [
  { name: "Haci", href: "https://unsplash.com/@e_haci" },
  { name: "Maksym Harbar", href: "https://unsplash.com/@maksym_harbar" },
  { name: "Holly Landkammer", href: "https://unsplash.com/@hlandkammer" },
  { name: "Thijs", href: "https://unsplash.com/@zthijs" },
];

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (await currentUser()) redirect("/cases");
  const { next, error } = await searchParams;

  return <div className="landing">
    <header className="lp-bar">
      <a className="lp-brand" href="#top"><ApexMark size={26} /><span>Apex Additives</span></a>
      <nav aria-label="Sections">
        <a href="#news">News</a>
        <a href="#history">History</a>
        <a href="#culture">Culture</a>
        <a href="#team">Our Team</a>
      </nav>
      <SignInMenu accounts={users} next={next ?? "/cases"} error={Boolean(error)} />
    </header>

    <main>
      <section className="chapter" id="top" aria-labelledby="hero-title">
        <Image src={sandstone} alt="" fill priority placeholder="blur" sizes="100vw" className="chapter-bg" />
        <div className="chapter-body">
          <h1 id="hero-title">Built on solid ground.</h1>
          <p>Additives for coatings and plastics since 1828.</p>
        </div>
      </section>

      <section className="chapter chapter-news" id="news" aria-labelledby="news-title">
        <div className="chapter-body">
          <h2 id="news-title">News</h2>
          <ul className="rail news-rail">
            {news.map(item => <li key={item.title}>
              <Image src={item.image} alt="" placeholder="blur" sizes="(max-width: 700px) 80vw, 25vw" />
              <div><time>{item.date}</time><strong>{item.title}</strong></div>
            </li>)}
          </ul>
        </div>
      </section>

      <section className="chapter" id="history" aria-labelledby="history-title">
        <Image src={brickMill} alt="A Victorian red-brick mill tower" fill placeholder="blur" sizes="100vw" className="chapter-bg" />
        <div className="chapter-body">
          <h2 id="history-title">History</h2>
          <ol className="rail era-rail">
            {eras.map(era => <li key={era.year}><span>{era.year}</span>{era.title}</li>)}
          </ol>
        </div>
      </section>

      <section className="chapter" id="culture" aria-labelledby="culture-title">
        <Image src={sandstoneSwirl} alt="" fill placeholder="blur" sizes="100vw" className="chapter-bg" />
        <div className="chapter-body">
          <h2 id="culture-title">Culture</h2>
          <ul className="values">{values.map(value => <li key={value}>{value}</li>)}</ul>
        </div>
      </section>

      <section className="chapter" id="team" aria-labelledby="team-title">
        <Image src={brickWorks} alt="Red-brick works buildings with tall windows" fill placeholder="blur" sizes="100vw" className="chapter-bg" />
        <div className="chapter-body">
          <h2 id="team-title">Our Team</h2>
          <p>1,900 colleagues in {sites.slice(0, -1).join(", ")} and {sites.at(-1)}.</p>
          <div className="team-faces" aria-label="Change Control team">
            {users.map(user => <span key={user.id} className="team-face"><span className={`avatar tone-${user.id}`} aria-hidden="true">{user.initials}</span><span>{user.name}<small>{user.role}</small></span></span>)}
          </div>
        </div>
      </section>
    </main>

    <footer className="lp-footer">
      <span>Apex Additives is a fictional company created for a product demo.</span>
      <span>Photos on <a href="https://unsplash.com">Unsplash</a> by {credits.map((c, i) => <span key={c.name}>{i ? (i === credits.length - 1 ? " and " : ", ") : ""}<a href={c.href}>{c.name}</a></span>)}.</span>
    </footer>
  </div>;
}
