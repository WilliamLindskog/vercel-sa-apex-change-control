"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { boardCards } from "@/lib/board";
import { supplierChanges } from "@/lib/case";
import { restartCase } from "@/lib/case-store";
import { SESSION_COOKIE } from "@/lib/session";
import { signSession } from "@/lib/session-token";
import { findUser } from "@/lib/users";

const safeNext = (value: FormDataEntryValue | null) =>
  typeof value === "string" && /^\/(cases|analytics|connections|products)(\/|\?|$)/.test(value) ? value : "/cases";

async function setSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, await signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

// For the sign-in menu: how many open cases are waiting on each person right now. Read live from the
// same board data, only when someone opens the menu. Numbers only, nothing about the cases themselves.
export async function waitingCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const card of await boardCards()) if (card.stage !== "done" && card.waitingOn) counts[card.waitingOn] = (counts[card.waitingOn] ?? 0) + 1;
  return counts;
}

export async function signIn(formData: FormData) {
  const user = findUser(String(formData.get("user") ?? ""));
  if (!user) redirect("/signin?error=unknown");
  await setSession(user.id);
  redirect(safeNext(formData.get("next")));
}

// Switches accounts without leaving the page, so in-progress case state is kept.
export async function switchAccount(userId: string) {
  if (!findUser(userId)) throw new Error("Unknown account");
  await setSession(userId);
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/signin");
}

// Demo reset, from the landing footer: puts every case back where its story starts, so a reviewer
// (or a rehearsal) begins fresh. Needs the reset code (DEMO_RESET_CODE), so visitors can't wipe each other's work.
export type ResetResult = { ok: boolean; message: string } | null;

function resetCodeMatches(given: string) {
  const code = process.env.DEMO_RESET_CODE ?? (process.env.VERCEL ? "" : "local-reset");
  const a = Buffer.from(given), b = Buffer.from(code);
  return code.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export async function resetDemo(_previous: ResetResult, formData: FormData): Promise<ResetResult> {
  if (!resetCodeMatches(String(formData.get("code") ?? ""))) return { ok: false, message: "That code isn't right." };
  const results = await Promise.allSettled(supplierChanges.map(change => restartCase(change.id, change.start.scenario ?? "normal", "Demo reset")));
  const failed = results.filter(r => r.status === "rejected").length;
  return failed
    ? { ok: false, message: `${supplierChanges.length - failed} of ${supplierChanges.length} cases reset. Try again for the rest.` }
    : { ok: true, message: `All ${supplierChanges.length} cases are back at their start.` };
}
