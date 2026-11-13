import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUser } from "./users";

export const SESSION_COOKIE = "apex_session";

// Demo session: the cookie holds a directory user ID. Production would use Apex SSO (OIDC) instead.
export async function currentUser() {
  return findUser((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/signin");
  return user;
}
