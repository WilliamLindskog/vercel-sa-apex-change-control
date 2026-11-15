"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, waitingCounts } from "@/app/actions";
import { ApexMark } from "@/app/ui/apex-mark";
import type { Role, User } from "@/lib/users";

const groups: { role: Role; label: string }[] = [
  { role: "Product Change Lead", label: "Product change leads" },
  { role: "Quality", label: "Quality" },
  { role: "Regulatory Affairs", label: "Regulatory" },
];

// Where the demo story starts: Dana leads Binder X-17.
const START_HERE = "dana";

// Sign-in lives behind one button in the top bar. Opening it shows the team straight away, grouped by role,
// with how many cases wait on each person. Apex SSO is the production path, shown but off.
export function SignInMenu({ accounts, next, error }: { accounts: User[]; next: string; error: boolean }) {
  const [open, setOpen] = useState(error);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (!counts) waitingCounts().then(setCounts, () => setCounts({}));
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open, counts]);

  return <div className="signin-menu" ref={ref}>
    <button className="signin-trigger" aria-expanded={open} aria-controls="signin-panel" onClick={() => setOpen(!open)}>Sign in</button>
    {open && <div className="signin-panel" id="signin-panel" role="dialog" aria-labelledby="signin-title">
      <h2 id="signin-title">Sign in</h2>
      <p className="signin-lede">Pick a person to see their view.</p>
      {error && <p className="form-error" role="alert">That account isn't in the directory. Choose one below.</p>}
      <form action={signIn} className="account-list">
        <input type="hidden" name="next" value={next} />
        {groups.map(group => <fieldset key={group.role} className="account-group">
          <legend>{group.label}</legend>
          {accounts.filter(user => user.role === group.role).map(user => <Account key={user.id} user={user} count={counts?.[user.id]} />)}
        </fieldset>)}
      </form>
      <div className="sso-row">
        <button type="button" className="sso" disabled aria-describedby="sso-note"><ApexMark size={14} mono />Apex SSO</button>
        <span id="sso-note">Off in this demo</span>
      </div>
    </div>}
  </div>;
}

function Account({ user, count }: { user: User; count?: number }) {
  const { pending, data } = useFormStatus();
  const me = pending && data?.get("user") === user.id;
  return <button type="submit" name="user" value={user.id} className={`account ${me ? "is-pending" : ""}`} disabled={pending} aria-busy={me}>
    <span className={`avatar small tone-${user.id}`} aria-hidden="true">{user.initials}</span>
    <span className="account-text"><strong>{user.name}{user.id === START_HERE && <em className="start-here">Start here</em>}</strong><span>{me ? "Signing in…" : user.title}</span></span>
    {count ? <span className="account-waiting" title={`${count} open ${count === 1 ? "case is" : "cases are"} waiting on ${user.name.split(" ")[0]}`}>{count} waiting</span> : null}
  </button>;
}
