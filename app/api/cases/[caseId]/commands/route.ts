import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getChange } from "@/lib/case";
import { assignedActor } from "@/lib/case-rules";
import { isCase } from "@/lib/cases";
import { restartCase, sendCommand } from "@/lib/case-store";
import { PLAN_RECIPIENTS } from "@/workflows/supplier-change-case";
import { isScenario, SCENARIO_COOKIE } from "@/lib/demo-scenario";
import { currentUser } from "@/lib/session";
import { reviewOrder, type ReviewRole } from "@/lib/users";

const snapshot = { runId: z.string().min(1), version: z.number().int().positive() };

const body = z.discriminatedUnion("type", [
  z.object({ type: z.literal("assess") }),
  z.object({ type: z.literal("sign"), ...snapshot, role: z.enum(reviewOrder as [ReviewRole, ...ReviewRole[]]), note: z.string().trim().min(3).max(600) }),
  z.object({ type: z.literal("route"), ...snapshot }),
  z.object({ type: z.literal("scenario"), scenario: z.enum(["normal", "missing-eu-qualification", "qms-outage"]) }),
]);

// Every action on a case comes through here. Identity comes from the session, never from the request body,
// and the workflow re-checks the case rules before it accepts anything.
export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to act on this case." }, { status: 401 });
  const { caseId } = await params;
  if (!isCase(caseId)) return NextResponse.json({ error: "Case not found." }, { status: 404 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Refresh the case before acting. A sign-off also needs a note of 3 to 600 characters." }, { status: 400 });
  const command = parsed.data;
  if (user.id !== assignedActor(getChange(caseId).team, command)) {
    return NextResponse.json({ error: "This action belongs to another member of the assigned case team." }, { status: 403 });
  }
  const at = new Date().toISOString();

  switch (command.type) {
    case "assess":
      {
        const chosen = (await cookies()).get(SCENARIO_COOKIE)?.value;
        await sendCommand(caseId, { type: "assess", by: user.name, at, scenario: isScenario(chosen) ? chosen : "normal" });
      }
      break;
    case "sign":
      await sendCommand(caseId, { ...command, reviewer: user.name, at });
      break;
    case "route":
      await sendCommand(caseId, { ...command, by: user.name, to: PLAN_RECIPIENTS, at });
      break;
    case "scenario":
      await restartCase(caseId, command.scenario, user.name);
      break;
  }
  return NextResponse.json({ accepted: true });
}
