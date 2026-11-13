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
      <h1 id="signin-title">Sign in to Change Control</h1>
      <p className="signin-intro">Choose your account to open your workspace.</p>
      {error && <p className="form-error" role="alert">That account isn't in the directory. Choose one of the accounts below.</p>}
      <form action={signIn} className="account-list">
        <input type="hidden" name="next" value={next ?? "/cases"} />
        {users.map(user => <button key={user.id} type="submit" name="user" value={user.id} className="account">
          <span className="avatar" aria-hidden="true">{user.initials}</span>
          <span className="account-text"><strong>{user.name}</strong><span>{user.email}</span></span>
          <span className="account-role">{user.role}</span>
        </button>)}
      </form>
      <p className="signin-note">This demo uses directory accounts without passwords. In production, sign-in goes through Apex single sign-on.</p>
    </section>
    <aside className="signin-context">
      <p className="signin-quote">Supplier changes, product impact and sign-offs in one shared record.</p>
      <p className="signin-sub">Product Change Control, Quality and Regulatory Affairs</p>
    </aside>
  </main>;
}
