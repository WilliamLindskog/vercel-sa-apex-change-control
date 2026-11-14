import { revalidateTag } from "next/cache";

// Targeted invalidation. Apex's systems (or the case workflow, when a case is decided) call this with a
// shared secret when the underlying data changes, so the cached board and analytics refresh at once,
// without a rebuild and without making those pages dynamic. Production: a signed webhook from Apex's
// integration layer, over the same private connection as the reads.
const tags = new Set(["cases", "analytics"]);

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Not allowed." }, { status: 401 });
  const { tag } = await request.json().catch(() => ({}));
  if (!tags.has(tag)) return Response.json({ error: `Unknown tag. Use one of: ${[...tags].join(", ")}.` }, { status: 400 });
  // "max": serve the cached version once more while the fresh one renders in the background.
  revalidateTag(tag, "max");
  return Response.json({ revalidated: tag });
}
