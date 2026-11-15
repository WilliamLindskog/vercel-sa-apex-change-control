import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ApexLogo } from "@/app/ui/apex-mark";
import brickMill from "@/app/ui/images/brick-mill-tower.jpg";
import labReview from "@/app/ui/images/culture-lab-review.jpg";
import sandstone from "@/app/ui/images/sandstone-striated.jpg";
import { users } from "@/lib/users";
import { news } from "./news";
import { DemoReset } from "./demo-reset";
import { SignInMenu } from "./signin-menu";
import "./landing.css";

export const metadata: Metadata = { title: "Apex" };

// Apex is fictional. News (see news.ts), history, sites and figures below are demo copy.
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
  // Team portraits (Dana, Priya, Marcus, Ingrid, Kenji, Lucía)
  { name: "Christina @ wocintechchat.com", href: "https://unsplash.com/@wocintechchat" },
  { name: "Siddharth Vyas", href: "https://unsplash.com/@siddharth_vyas1" },
  { name: "Danny Postma", href: "https://unsplash.com/@dannypostma" },
  { name: "Troy Spoelma", href: "https://unsplash.com/@spoelee4" },
  { name: "Redd Francisco", href: "https://unsplash.com/@reddfrancisco" },
  { name: "amirreza momennia", href: "https://unsplash.com/@amirreza_momennia" },
];

// The landing page is fully static (prerendered at build). Only the sign-in menu reads the URL, so it
// streams in behind a boundary; until then the same menu shows with defaults.
async function Menu({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return <SignInMenu accounts={users} next={next ?? "/cases"} error={Boolean(error)} />;
}

export default function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {

  return <div className="landing">
    <header className="lp-bar">
      <a className="lp-brand" href="#top" aria-label="Apex, back to top"><ApexLogo size={30} /></a>
      <nav aria-label="Sections">
        <a href="#news">News</a>
        <a href="#history">History</a>
        <a href="#culture">Culture</a>
      </nav>
      <Suspense fallback={<SignInMenu accounts={users} next="/cases" error={false} />}><Menu searchParams={searchParams} /></Suspense>
    </header>

    <main>
      <div className="stop" id="top"><section className="chapter chapter-hero" aria-labelledby="hero-title">
        <Image src={sandstone} alt="" fill priority placeholder="blur" sizes="100vw" className="chapter-bg" />
        <div className="chapter-body">
          <h1 id="hero-title">Built on solid ground.</h1>
          <p>Additives for coatings and plastics since 1828.</p>
        </div>
      </section></div>

      <div className="stop" id="news"><section className="chapter chapter-news" aria-labelledby="news-title">
        <div className="chapter-body">
          <h2 id="news-title">News</h2>
          <ul className="rail news-rail">
            {news.map((item, i) => <li key={item.slug} style={{ "--i": i } as React.CSSProperties}>
              <Link href={`/news/${item.slug}`}>
                <Image src={item.image} alt="" placeholder="blur" sizes="(max-width: 700px) 80vw, 30vw" style={{ objectPosition: item.position }} />
                <div><time>{item.date}</time><strong>{item.title}</strong><p>{item.summary}</p><span className="news-more" aria-hidden="true">Read more</span></div>
              </Link>
            </li>)}
          </ul>
        </div>
      </section></div>

      <div className="stop" id="history"><section className="chapter chapter-history" aria-labelledby="history-title">
        <Image src={brickMill} alt="A Victorian red-brick mill tower" fill placeholder="blur" sizes="100vw" className="chapter-bg" />
        <div className="chapter-body">
          <h2 id="history-title">History</h2>
          <ol className="rail era-rail">
            {eras.map((era, i) => <li key={era.year} style={{ "--i": i } as React.CSSProperties}><span>{era.year}</span>{era.title}</li>)}
          </ol>
        </div>
      </section></div>

      <div className="stop" id="culture"><section className="chapter chapter-culture" aria-labelledby="culture-title">
        <Image src={labReview} alt="Two scientists checking a rack of samples together" fill placeholder="blur" sizes="100vw" className="chapter-bg" style={{ objectPosition: "center 28%" }} />
        <div className="chapter-body">
          <h2 id="culture-title">Culture</h2>
          <ul className="values">{values.map((value, i) => <li key={value} style={{ "--i": i } as React.CSSProperties}>{value}</li>)}</ul>
        </div>
      </section></div>

    </main>

    <footer className="lp-footer">
      <span>Apex is a fictional company created for a product demo. <a href="/brief">Read the solution brief</a>.</span>
      <DemoReset />
      <span>Photos on <a href="https://unsplash.com">Unsplash</a> by {credits.map((c, i) => <span key={c.name}>{i ? (i === credits.length - 1 ? " and " : ", ") : ""}<a href={c.href}>{c.name}</a></span>)}.</span>
    </footer>
  </div>;
}
