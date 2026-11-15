"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { boardCards } from "@/lib/board";
import { SESSION_COOKIE } from "@/lib/session";
import { signSession } from "@/lib/session-token";
import { findUser } from "@/lib/users";

const safeNext = (value: FormDataEntryValue | null) =>
  typeof value === "string" && /^\/(cases|analytics|connections)(\/|\?|$)/.test(value) ? value : "/cases";

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
