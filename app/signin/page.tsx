import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signIn } from "@/app/actions";
import { ApexMark } from "@/app/ui/apex-mark";

import { currentUser } from "@/lib/session";
import { users } from "@/lib/users";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (await currentUser()) redirect("/cases");
  const { next, error } = await searchParams;

  return <main className="signin">
    <section className="signin-hero" aria-labelledby="hero-title">
      
      <div className="hero-copy">
        <p className="hero-mark"><ApexMark size={30} /><span>Apex Additives<small>Est. 1828</small></span></p>
        <h2 id="hero-title">The works at Apex.</h2>
        <p>From mineral pigments in 1828 to specialty additives today. Our formulations carry nearly two centuries of work.</p>
      </div>
      <a className="plate" href="https://www.pexels.com/photo/31887450/">Bryce Canyon | Photography by Alex Moliski ↗</a>
    </section>

    <section className="signin-panel" aria-labelledby="signin-title">
      <p className="eyebrow">Internal portal</p>
      <h1 id="signin-title">Product Change Control</h1>
      <p className="signin-intro">Supplier changes, evidence and sign-offs for Product Change, Quality and Regulatory Affairs.</p>

      <div className="divider"><span>Enter as a demo team member</span></div>
      {error && <p className="form-error" role="alert">That account isn't in the directory. Choose one of the accounts below.</p>}
      <form action={signIn} className="account-list">
        <input type="hidden" name="next" value={next ?? "/cases"} />
        {users.map(user => <button key={user.id} type="submit" name="user" value={user.id} className="account">
          <span className={`avatar tone-${user.id}`} aria-hidden="true">{user.initials}</span>
          <span className="account-text"><strong>{user.name}</strong><span>{user.title} | {user.site}</span></span>
          <svg className="account-chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>)}
      </form>

      <p className="signin-foot">Start with Dana to assess a supplier change. Switch roles inside the case to record each review.</p>
    </section>
  </main>;
}
