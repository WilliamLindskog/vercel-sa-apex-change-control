import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "@/lib/session-token";
import { findUser } from "@/lib/users";

// Sign-in gate, before any page renders. Doing this here (not in each page) is what lets the workspace
// pages prerender a static shell: the pages no longer need the cookie just to decide whether to redirect.
// Pages still read the session for who you are; this is the optimistic check, and the case API re-checks.
// Production: Apex SSO (OIDC) would set the session; the check here stays the same shape.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = Boolean(findUser(await readSession(request.cookies.get("apex_session")?.value)));
  if (signedIn && (pathname === "/" || pathname === "/signin")) return NextResponse.redirect(new URL("/cases", request.url));
  if (!signedIn && pathname !== "/signin") {
    const to = new URL("/signin", request.url);
    if (pathname !== "/") to.searchParams.set("next", pathname + search);
    return NextResponse.redirect(to);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/signin", "/cases/:path*", "/analytics/:path*", "/connections/:path*", "/products/:path*"] };
