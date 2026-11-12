import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { z } from "zod";
import { recordReviewRoute } from "@/workflows/review-route";

const reviewSchema = z.object({ role: z.enum(["Quality", "Regulatory Affairs"]), decision: z.string().min(3) });

export async function POST(request: NextRequest) {
  const parsed = reviewSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid review" }, { status: 400 });
  const run = await start(recordReviewRoute, [{ caseId: "SCC-2026-041", ...parsed.data }]);
  return NextResponse.json({ workflowRunId: run.runId, status: "recorded" });
}
