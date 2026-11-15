// The session cookie is "<user id>.<signature>", signed with HMAC-SHA256 and a server-only secret, so a
// visitor can't edit the cookie to become someone else. Production keeps this shape with SSO: Apex's
// identity provider says who you are, and this signed session carries it between requests.
const encoder = new TextEncoder();

function secret() {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.VERCEL) throw new Error("SESSION_SECRET is not set");
  return "local-development-only";
}

let key: Promise<CryptoKey> | undefined;
const hmacKey = () => key ??= crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

const toBase64Url = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (text: string) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

export async function signSession(userId: string) {
  return `${userId}.${toBase64Url(await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(userId)))}`;
}

// Returns the user ID if the signature is valid, otherwise undefined.
export async function readSession(value: string | undefined) {
  if (!value) return undefined;
  const dot = value.lastIndexOf(".");
  if (dot < 1) return undefined;
  const userId = value.slice(0, dot);
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(), fromBase64Url(value.slice(dot + 1)), encoder.encode(userId));
    return ok ? userId : undefined;
  } catch {
    return undefined;
  }
}
