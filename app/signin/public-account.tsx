import Link from "next/link";
import { Suspense } from "react";
import { currentUser } from "@/lib/session";
import { users } from "@/lib/users";
import { SignInMenu } from "./signin-menu";

// The account corner on public pages (news, brief). Signed out: the same sign-in menu as the landing.
// Signed in: a way back to the workspace. Reading the cookie is request-time, so it streams in.
export function PublicAccount() {
  return <Suspense fallback={<SignInMenu accounts={users} next="/cases" error={false} />}><Account /></Suspense>;
}

async function Account() {
  const user = await currentUser();
  if (user) return <Link className="signin-trigger" href="/cases">Open workspace</Link>;
  return <SignInMenu accounts={users} next="/cases" error={false} />;
}
