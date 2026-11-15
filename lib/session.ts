import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession } from "./session-token";
import { findUser } from "./users";

export const SESSION_COOKIE = "apex_session";

// Demo session: a signed cookie holding a directory user ID (see session-token.ts). Production: Apex SSO (OIDC) sets it.
export async function currentUser() {
  return findUser(await readSession((await cookies()).get(SESSION_COOKIE)?.value));
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/signin");
  return user;
}
