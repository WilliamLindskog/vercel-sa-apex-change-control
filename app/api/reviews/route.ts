import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { recordReviewRoute } from "@/workflows/review-route";

const reviewSchema = z.object({ role: z.enum(["Quality", "Regulatory Affairs"]), decision: z.string().min(3) });

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to record a review." }, { status: 401 });
  const parsed = reviewSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Add a decision note of at least 3 characters." }, { status: 400 });
  if (user.role !== parsed.data.role) return NextResponse.json({ error: `Only ${parsed.data.role} can record this review.` }, { status: 403 });
  const run = await start(recordReviewRoute, [{ caseId: "SCC-2026-041", reviewer: user.name, ...parsed.data }]);
  return NextResponse.json({ workflowRunId: run.runId, reviewer: user.name, recordedAt: new Date().toISOString(), status: "recorded" });
}
