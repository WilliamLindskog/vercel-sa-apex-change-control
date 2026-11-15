import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApexLogo } from "@/app/ui/apex-mark";
import { findArticle, news } from "@/app/signin/news";
import { PublicAccount } from "@/app/signin/public-account";
import "@/app/signin/landing.css";
import "./article.css";

// Public news pages, prerendered at build; unknown slugs are a 404. Apex is fictional, and so is this news.

export function generateStaticParams() {
  return news.map(article => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const article = findArticle((await params).slug);
  return { title: article?.title ?? "News", description: article?.summary };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const article = findArticle((await params).slug);
  if (!article) notFound();
  const more = news.filter(other => other.slug !== article.slug);

  return <div className="landing article-page">
    <header className="lp-bar">
      <Link className="lp-brand" href="/signin" aria-label="Apex, home"><ApexLogo size={30} /></Link>
      <nav aria-label="Sections">
        <Link href="/signin#news">News</Link>
        <Link href="/signin#history">History</Link>
        <Link href="/signin#culture">Culture</Link>
      </nav>
      <PublicAccount />
    </header>

    <main className="article">
      <figure className="article-hero">
        <Image src={article.image} alt="" fill priority placeholder="blur" sizes="100vw" style={{ objectPosition: article.position }} />
      </figure>

      <div className="article-grid">
        <article>
          <time>{article.date}</time>
          <h1>{article.title}</h1>
          <p className="article-lede">{article.summary}</p>
          {article.body.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        </article>
        <aside aria-label="Key facts">
          <dl className="article-facts">{article.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        </aside>
      </div>

      <nav className="article-more" aria-label="More news">
        <h2>More news</h2>
        <ul>{more.map(other => <li key={other.slug}><Link href={`/news/${other.slug}`}>
          <Image src={other.image} alt="" placeholder="blur" sizes="(max-width: 700px) 90vw, 30vw" style={{ objectPosition: other.position }} />
          <span><time>{other.date}</time><strong>{other.title}</strong></span>
        </Link></li>)}</ul>
      </nav>
    </main>

    <footer className="lp-footer"><span>Apex is a fictional company created for a product demo.</span></footer>
  </div>;
}
