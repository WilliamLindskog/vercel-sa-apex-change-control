import { NextResponse } from "next/server";
import { openCaseId } from "@/lib/cases";
import { latestState, openCase } from "@/lib/case-store";
import { currentUser } from "@/lib/session";

// The latest snapshot of the durable case. Always dynamic: it reflects the workflow, never a cache.
export async function GET(_request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  if (!(await currentUser())) return NextResponse.json({ error: "Sign in to view this case." }, { status: 401 });
  const { caseId } = await params;
  if (caseId !== openCaseId) return NextResponse.json({ error: "Case not found." }, { status: 404 });

  const runId = await openCase(caseId);
  const state = await latestState(runId);
  if (!state) return NextResponse.json({ error: "The case is starting. Try again in a moment." }, { status: 503 });
  return NextResponse.json(state, { headers: { "cache-control": "no-store" } });
}
