"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/session";
import { findUser } from "@/lib/users";

const safeNext = (value: FormDataEntryValue | null) =>
  typeof value === "string" && value.startsWith("/cases") ? value : "/cases";

async function setSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
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
