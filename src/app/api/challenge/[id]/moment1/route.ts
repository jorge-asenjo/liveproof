import type { NextRequest } from "next/server";
import { ChallengeError, GESTURE_B_WINDOW_MS, getOwnedChallenge, recordMoment1, validateFrames } from "@/lib/challenge";
import { getSeller } from "@/lib/session";

// Moment 1 frames (code + first gesture). Answers at once with the surprise gesture;
// the model is not called here, so the clock for gesture B starts without delay.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/challenge/[id]/moment1">) {
  const seller = await getSeller();
  if (!seller) return Response.json({ error: "Log in with PayPal first" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const challenge = getOwnedChallenge(id, seller);
    const body = await request.json().catch(() => null);
    const frames = validateFrames(body?.frames);
    const gestureB = recordMoment1(challenge, frames);
    return Response.json({ gestureB, windowMs: GESTURE_B_WINDOW_MS });
  } catch (err) {
    if (err instanceof ChallengeError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
