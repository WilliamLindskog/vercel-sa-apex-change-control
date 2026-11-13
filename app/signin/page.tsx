import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signIn } from "@/app/actions";
import { ApexMark } from "@/app/ui/apex-mark";
import { Strata } from "@/app/ui/strata";
import { currentUser } from "@/lib/session";
import { users } from "@/lib/users";

export const metadata: Metadata = { title: "Sign in" };

// Fictional company history. Newest era first: it sits at the surface of the strata.
const eras = [
  { year: "2026", label: "400+ product lines · 3 regions" },
  { year: "1994", label: "EMEA hub opens, Rotterdam" },
  { year: "1957", label: "First coatings additives" },
  { year: "1912", label: "Polymer stabilizer research" },
  { year: "1871", label: "Cleveland laboratory founded" },
  { year: "1828", label: "Mineral pigment works" },
];

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (await currentUser()) redirect("/cases");
  const { next, error } = await searchParams;

  return <main className="signin">
    <section className="signin-hero" aria-labelledby="hero-title">
      <Strata eras={eras} />
      <div className="hero-copy">
        <p className="hero-mark"><ApexMark size={30} /><span>Apex Additives<small>Est. 1828</small></span></p>
        <h2 id="hero-title">Built on solid ground.</h2>
        <p>Nearly two centuries of formulations, qualifications and customer commitments. Every change is decided on the record.</p>
      </div>
    </section>

    <section className="signin-panel" aria-labelledby="signin-title">
      <p className="eyebrow">Internal portal</p>
      <h1 id="signin-title">Product Change Control</h1>
      <p className="signin-intro">Supplier changes, evidence and sign-offs for Product Change, Quality and Regulatory Affairs.</p>

      <button type="button" className="sso" disabled aria-describedby="sso-note">
        <ApexMark size={20} />Continue with Apex SSO
      </button>
      <p className="sso-note" id="sso-note">Single sign-on is switched off in this demo. Choose a demo account instead.</p>

      <div className="divider"><span>Demo accounts</span></div>
      {error && <p className="form-error" role="alert">That account isn't in the directory. Choose one of the accounts below.</p>}
      <form action={signIn} className="account-list">
        <input type="hidden" name="next" value={next ?? "/cases"} />
        {users.map(user => <button key={user.id} type="submit" name="user" value={user.id} className="account">
          <span className={`avatar tone-${user.id}`} aria-hidden="true">{user.initials}</span>
          <span className="account-text"><strong>{user.name}</strong><span>{user.title} · {user.site}</span></span>
          <svg className="account-chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>)}
      </form>

      <p className="signin-foot">Authorized Apex personnel only. Activity is recorded for audit.</p>
    </section>
  </main>;
}
