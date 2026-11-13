"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { signOut, switchAccount } from "@/app/actions";
import type { User } from "@/lib/users";

export function AccountMenu({ user, accounts }: { user: User; accounts: User[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
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

  const choose = (id: string) => startTransition(async () => { await switchAccount(id); setOpen(false); router.refresh(); });

  return <div className="account-menu" ref={ref}>
    {open && <div className="account-popover" role="menu" aria-label="Account">
      <p className="popover-heading">Switch account</p>
      {accounts.map(account => <button key={account.id} role="menuitemradio" aria-checked={account.id === user.id} disabled={pending} onClick={() => account.id === user.id ? setOpen(false) : choose(account.id)}>
        <span className={`avatar small tone-${account.id}`} aria-hidden="true">{account.initials}</span>
        <span><strong>{account.name}</strong><span>{account.role}</span></span>
      </button>)}
      <form action={signOut}><button type="submit" role="menuitem" className="sign-out">Sign out</button></form>
    </div>}
    <button className="account-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span className={`avatar tone-${user.id}`} aria-hidden="true">{user.initials}</span>
      <span className="account-trigger-text"><strong>{user.name}</strong><span>{user.title}</span></span>
    </button>
  </div>;
}
