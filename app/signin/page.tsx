import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ApexLogo } from "@/app/ui/apex-mark";
import brickMill from "@/app/ui/images/brick-mill-tower.jpg";
import paintSwatches from "@/app/ui/images/binder-paint-swatches.jpg";
import rotterdamLab from "@/app/ui/images/rotterdam-lab-flasks.jpg";
import singapore from "@/app/ui/images/singapore-marina-bay.jpg";
import labReview from "@/app/ui/images/culture-lab-review.jpg";
import sandstone from "@/app/ui/images/sandstone-striated.jpg";
import { currentUser } from "@/lib/session";
import { users } from "@/lib/users";
import { SignInMenu } from "./signin-menu";
import "./landing.css";

export const metadata: Metadata = { title: "Apex" };

// Apex is fictional. News, history, sites and figures below are demo copy.
const news = [
  { date: "12 Nov 2026", title: "Binder X-17 change review opens", image: paintSwatches, position: "center 18%" },
  { date: "28 Oct 2026", title: "Rotterdam lab finishes REACH update", image: rotterdamLab, position: "center" },
  { date: "30 Sep 2026", title: "Cleveland marks 198 years", image: brickMill, position: "center" },
  { date: "4 Sep 2026", title: "Singapore technical service expands", image: singapore, position: "58% center" },
];

const eras = [
  { year: "1828", title: "Pigment works" },
  { year: "1871", title: "First laboratory" },
  { year: "1912", title: "Polymer stabilizers" },
  { year: "1957", title: "Coatings additives" },
  { year: "1994", title: "Rotterdam hub" },
  { year: "2026", title: "400+ product lines" },
];

const values = ["Show the evidence.", "People make the call."];

const credits = [
  { name: "Haci", href: "https://unsplash.com/@e_haci" },
  { name: "Maksym Harbar", href: "https://unsplash.com/@maksym_harbar" },
  { name: "Holly Landkammer", href: "https://unsplash.com/@hlandkammer" },
  { name: "Thijs", href: "https://unsplash.com/@zthijs" },
  { name: "Clay Banks", href: "https://unsplash.com/@claybanks" },
  { name: "National Cancer Institute", href: "https://unsplash.com/@nci" },
  { name: "Julia Taubitz", href: "https://unsplash.com/@justmejuliee" },
  { name: "Kirill Petropavlov", href: "https://unsplash.com/@kp89_" },
  // Team portraits (Dana, Priya, Marcus)
  { name: "Christina @ wocintechchat.com", href: "https://unsplash.com/@wocintechchat" },
  { name: "Siddharth Vyas", href: "https://unsplash.com/@siddharth_vyas1" },
  { name: "Danny Postma", href: "https://unsplash.com/@dannypostma" },
];

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (await currentUser()) redirect("/cases");
  const { next, error } = await searchParams;

  return <div className="landing">
    <header className="lp-bar">
      <a className="lp-brand" href="#top" aria-label="Apex, back to top"><ApexLogo size={30} /></a>
      <nav aria-label="Sections">
        <a href="#news">News</a>
        <a href="#history">History</a>
        <a href="#culture">Culture</a>
      </nav>
      <SignInMenu accounts={users} next={next ?? "/cases"} error={Boolean(error)} />
    </header>

    <main>
      <section className="chapter chapter-hero" id="top" aria-labelledby="hero-title">
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
            {news.map((item, i) => <li key={item.title} style={{ "--i": i } as React.CSSProperties}>
              <Image src={item.image} alt="" placeholder="blur" sizes="(max-width: 700px) 80vw, 30vw" style={{ objectPosition: item.position }} />
              <div><time>{item.date}</time><strong>{item.title}</strong></div>
            </li>)}
          </ul>
        </div>
      </section>

      <section className="chapter chapter-history" id="history" aria-labelledby="history-title">
        <Image src={brickMill} alt="A Victorian red-brick mill tower" fill placeholder="blur" sizes="100vw" className="chapter-bg" />
        <div className="chapter-body">
          <h2 id="history-title">History</h2>
          <ol className="rail era-rail">
            {eras.map((era, i) => <li key={era.year} style={{ "--i": i } as React.CSSProperties}><span>{era.year}</span>{era.title}</li>)}
          </ol>
        </div>
      </section>

      <section className="chapter chapter-culture" id="culture" aria-labelledby="culture-title">
        <Image src={labReview} alt="Two scientists checking a rack of samples together" fill placeholder="blur" sizes="100vw" className="chapter-bg" style={{ objectPosition: "center 28%" }} />
        <div className="chapter-body">
          <h2 id="culture-title">Culture</h2>
          <ul className="values">{values.map((value, i) => <li key={value} style={{ "--i": i } as React.CSSProperties}>{value}</li>)}</ul>
        </div>
      </section>

    </main>

    <footer className="lp-footer">
      <span>Apex is a fictional company created for a product demo. <a href="/brief">Read the solution brief</a>.</span>
      <span>Photos on <a href="https://unsplash.com">Unsplash</a> by {credits.map((c, i) => <span key={c.name}>{i ? (i === credits.length - 1 ? " and " : ", ") : ""}<a href={c.href}>{c.name}</a></span>)}.</span>
    </footer>
  </div>;
}
