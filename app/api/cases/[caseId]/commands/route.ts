import { NextResponse } from "next/server";
import { z } from "zod";
import { openCaseId } from "@/lib/cases";
import { restartCase, sendCommand } from "@/lib/case-store";
import { currentUser } from "@/lib/session";
import { userForRole } from "@/lib/users";

const body = z.discriminatedUnion("type", [
  z.object({ type: z.literal("assess") }),
  z.object({ type: z.literal("sign"), role: z.enum(["Quality", "Regulatory Affairs"]), note: z.string().trim().min(3).max(600) }),
  z.object({ type: z.literal("route") }),
  z.object({ type: z.literal("scenario"), scenario: z.enum(["normal", "missing-eu-qualification", "qms-outage"]) }),
]);

// Every action on a case comes through here. Identity comes from the session, never from the request body,
// and the workflow re-checks the case rules before it accepts anything.
export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to act on this case." }, { status: 401 });
  const { caseId } = await params;
  if (caseId !== openCaseId) return NextResponse.json({ error: "Case not found." }, { status: 404 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That action isn't valid. A decision note needs at least 3 characters." }, { status: 400 });
  const command = parsed.data;
  const at = new Date().toISOString();

  switch (command.type) {
    case "assess":
      await sendCommand(caseId, { type: "assess", by: user.name, at });
      break;
    case "sign":
      if (user.role !== command.role) return NextResponse.json({ error: `Only ${command.role} can record this sign-off.` }, { status: 403 });
      await sendCommand(caseId, { type: "sign", role: command.role, reviewer: user.name, note: command.note, at });
      break;
    case "route":
      await sendCommand(caseId, { type: "route", by: user.name, to: userForRole("Product Change Lead").name, at });
      break;
    case "scenario":
      await restartCase(caseId, command.scenario, user.name);
      break;
  }
  return NextResponse.json({ accepted: true });
}
