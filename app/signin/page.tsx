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
    <section className="signin-panel" aria-labelledby="signin-title">
      <div className="signin-brand"><ApexMark /><span>Apex Additives</span></div>
      <h1 id="signin-title">Welcome back</h1>
      <p className="signin-intro">Choose your account to open Change Control.</p>
      {error && <p className="form-error" role="alert">That account isn't in the directory. Choose one of the accounts below.</p>}
      <form action={signIn} className="account-list">
        <input type="hidden" name="next" value={next ?? "/cases"} />
        {users.map(user => <button key={user.id} type="submit" name="user" value={user.id} className="account">
          <span className={`avatar tone-${user.id}`} aria-hidden="true">{user.initials}</span>
          <span className="account-text"><strong>{user.name}</strong><span>{user.title}</span></span>
          <svg className="account-chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>)}
      </form>
      <p className="signin-note">This demo uses directory accounts without passwords. In production, sign-in goes through Apex single sign-on.</p>
    </section>
    <aside className="signin-context">
      <div className="team" aria-hidden="true">{users.map(user => <span key={user.id} className={`avatar large tone-${user.id}`}>{user.initials}</span>)}</div>
      <p className="signin-quote">Every supplier change, decided together.</p>
      <p className="signin-sub">Product Change Control works with Quality and Regulatory Affairs so the right people see the evidence and sign off before anything changes for a customer.</p>
    </aside>
  </main>;
}
