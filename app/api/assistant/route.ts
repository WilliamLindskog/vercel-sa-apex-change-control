import { convertToModelMessages, createUIMessageStreamResponse, stepCountIs, streamText, tool, toUIMessageStream, type UIMessage } from "ai";
import type { GatewayProviderOptions } from "@ai-sdk/gateway";
import { z } from "zod";
import { aiAvailable, FALLBACK_MODELS, PRIMARY_MODEL } from "@/lib/assessment";
import { boardCards } from "@/lib/board";
import { stages } from "@/lib/cases";
import { currentUser } from "@/lib/session";
import { users } from "@/lib/users";

export const maxDuration = 30;

// Spend guards. The AI Gateway budget ($5/month) is the hard cap; these keep one person from using it up.
const MAX_HISTORY = 12;          // only the latest turns go to the model
const MAX_OUTPUT_TOKENS = 700;
const MAX_STEPS = 4;             // read the board, maybe draft a check-in, answer
const PER_USER_PER_HOUR = 30;    // best effort: counted per function instance
const recent = new Map<string, number[]>();

const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (!aiAvailable()) return Response.json({ error: "The assistant needs AI Gateway, which isn't set up in this environment." }, { status: 503 });

  const now = Date.now();
  const calls = (recent.get(user.id) ?? []).filter(t => now - t < 3_600_000);
  if (calls.length >= PER_USER_PER_HOUR) return Response.json({ error: "That's a lot of questions for one hour. Try again a little later." }, { status: 429 });
  recent.set(user.id, [...calls, now]);

  const { messages }: { messages: UIMessage[] } = await request.json();
  const nameOf = (id?: string) => users.find(u => u.id === id);

  const result = streamText({
    model: PRIMARY_MODEL,
    system: [
      `You help ${user.name} (${user.title}, ${user.role}) at Apex Additives keep supplier-change cases moving.`,
      `Today is ${new Date().toDateString()}.`,
      "Always call getBoard before talking about cases; never guess a case, person, stage or date.",
      "To prioritise: cases where isYourTurn is true come first, ordered by fewest daysLeft; then blocked cases; then other open cases by fewest daysLeft. Give at most 3 items, one line each: the material in bold, then the action and why.",
      "To check in with someone, call draftCheckIn with a short, friendly message (2-3 sentences) in the sender's voice. You only draft it; the person sends it. After drafting, reply with one short line at most and do not repeat the message.",
      "Be brief and plain. Use short bullet lists. No headings, no italics, no case IDs. Refer to cases by material name, e.g. 'Wax W-210'.",
    ].join("\n"),
    messages: await convertToModelMessages(messages.slice(-MAX_HISTORY)),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    stopWhen: stepCountIs(MAX_STEPS),
    abortSignal: AbortSignal.timeout(25_000),
    providerOptions: {
      gateway: { models: FALLBACK_MODELS, user: user.id, tags: ["assistant"] } satisfies GatewayProviderOptions,
    },
    tools: {
      // The same data the board shows, so the assistant and the board never disagree.
      getBoard: tool({
        description: "All supplier-change cases: stage, who it is waiting for, deadline and notes.",
        inputSchema: z.object({}),
        execute: async () => (await boardCards()).map(card => ({
          caseId: card.id,
          material: card.material,
          supplier: card.supplier,
          stage: stages.find(s => s.id === card.stage)?.label,
          waitingFor: card.waitingOn ? { id: card.waitingOn, name: nameOf(card.waitingOn)?.name, role: nameOf(card.waitingOn)?.role } : null,
          isYourTurn: card.waitingOn === user.id,
          daysLeft: card.stage === "done" ? null : daysUntil(card.due),
          blocked: card.blocked,
          note: card.note ?? null,
          liveWorkflow: Boolean(card.live),
        }))
          // Already in priority order (your turn, then blocked, then the rest; soonest first), so small models don't have to sort.
          .sort((a, b) => Number(b.isYourTurn) - Number(a.isYourTurn) || Number(b.blocked) - Number(a.blocked) || (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9)),
      }),
      // Drafts only. Sending would go through Apex's own messaging (e.g. Teams), outside Vercel.
      draftCheckIn: tool({
        description: "Draft a check-in message to a colleague about one case. Shown to the user as a card they can copy.",
        inputSchema: z.object({
          caseId: z.string().describe("Case ID from getBoard, e.g. SCC-2026-042"),
          personId: z.enum(users.map(u => u.id) as [string, ...string[]]).describe("Who to check in with"),
          message: z.string().max(600).describe("The message, written as the user"),
        }),
        execute: async ({ caseId, personId, message }) => {
          const card = (await boardCards()).find(c => c.id === caseId);
          const to = nameOf(personId);
          if (!card || !to) return { ok: false as const, error: "Unknown case or person." };
          return { ok: true as const, caseId, material: card.material, to: { id: to.id, name: to.name, role: to.role }, message };
        },
      }),
    },
  });

  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) });
}
