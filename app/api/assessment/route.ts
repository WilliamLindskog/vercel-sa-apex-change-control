import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assessSupplierChange } from "@/lib/assessment";

export const dynamic = "force-dynamic";

const requestSchema = z.object({ missingEuQualification: z.boolean().default(false) });

export async function POST(request: NextRequest) {
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid assessment request" }, { status: 400 });
  try {
    const result = await assessSupplierChange(body.data.missingEuQualification);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Apex evidence could not be verified. Retry the assessment." }, { status: 503 });
  }
}
