"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "@/app/actions";
import { ApexMark } from "@/app/ui/apex-mark";
import type { User } from "@/lib/users";

// Sign-in lives behind one button in the top bar. Demo accounts stay folded away until asked for.
export function SignInMenu({ accounts, next, error }: { accounts: User[]; next: string; error: boolean }) {
  const [open, setOpen] = useState(error);
  const [showDemo, setShowDemo] = useState(error);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  return <div className="signin-menu" ref={ref}>
    <button className="signin-trigger" aria-expanded={open} aria-controls="signin-panel" onClick={() => setOpen(!open)}>Sign in</button>
    {open && <div className="signin-panel" id="signin-panel" role="dialog" aria-labelledby="signin-title">
      <h2 id="signin-title">Sign in</h2>
      <button type="button" className="sso" disabled aria-describedby="sso-note"><ApexMark size={18} />Continue with Apex SSO</button>
      <p className="sso-note" id="sso-note">Single sign-on is off in this demo.</p>
      {error && <p className="form-error" role="alert">That account isn't in the directory. Choose one below.</p>}
      {showDemo
        ? <form action={signIn} className="account-list">
            <input type="hidden" name="next" value={next} />
            {accounts.map(user => <button key={user.id} type="submit" name="user" value={user.id} className="account">
              <span className={`avatar small tone-${user.id}`} aria-hidden="true">{user.initials}</span>
              <span className="account-text"><strong>{user.name}</strong><span>{user.role}</span></span>
            </button>)}
          </form>
        : <button type="button" className="demo-toggle" onClick={() => setShowDemo(true)}>Use a demo account</button>}
    </div>}
  </div>;
}
