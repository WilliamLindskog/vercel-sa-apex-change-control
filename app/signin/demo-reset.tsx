"use client";

import { useActionState, useState } from "react";
import { resetDemo, type ResetResult } from "@/app/actions";

// Small footer control for whoever runs the demo: enter the reset code, and every case goes back to its start.
export function DemoReset() {
  const [open, setOpen] = useState(false);
  const [result, action, pending] = useActionState<ResetResult, FormData>(resetDemo, null);

  if (!open) return <button type="button" className="demo-reset-toggle" onClick={() => setOpen(true)}>Reset demo</button>;
  return <form action={action} className="demo-reset">
    <label htmlFor="reset-code">Reset code</label>
    <input id="reset-code" name="code" type="password" autoComplete="off" required disabled={pending} />
    <button type="submit" disabled={pending}>{pending ? "Resetting…" : "Reset all cases"}</button>
    <button type="button" className="demo-reset-cancel" onClick={() => setOpen(false)} disabled={pending}>Cancel</button>
    {result && <span role="status" className={result.ok ? "is-ok" : "is-bad"}>{result.message}</span>}
  </form>;
}
