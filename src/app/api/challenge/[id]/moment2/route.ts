import type { NextRequest } from "next/server";
import { saveAttempt } from "@/lib/attempts";
import {
  ChallengeError,
  GESTURE_B_WINDOW_MS,
  gestureBDelayMs,
  getOwnedChallenge,
  recordMoment2,
  validateFrames,
} from "@/lib/challenge";
import { getSeller } from "@/lib/session";
import { decide, observe } from "@/lib/verify";

export const maxDuration = 60;

// Moment 2 frames (surprise gesture). Claude reports what it sees; fixed rules decide.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/challenge/[id]/moment2">) {
  const seller = await getSeller();
  if (!seller) return Response.json({ error: "Log in with PayPal first" }, { status: 401 });
  const { id } = await ctx.params;

  let challenge;
  try {
    challenge = getOwnedChallenge(id, seller);
    const body = await request.json().catch(() => null);
    recordMoment2(challenge, validateFrames(body?.frames));
  } catch (err) {
    if (err instanceof ChallengeError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const delayMs = gestureBDelayMs(challenge);
  try {
    const result = await observe({ listing: challenge.listing, moment1: challenge.moment1!, moment2: challenge.moment2! });
    const decision = decide(
      {
        code: challenge.code,
        gestureA: challenge.gestureA,
        gestureB: challenge.gestureB!,
        gestureBDelayMs: delayMs,
        gestureBWindowMs: GESTURE_B_WINDOW_MS,
      },
      result.observation,
    );
    challenge.observation = result.observation;
    challenge.decision = decision;
    challenge.verify = { model: result.model, latencyMs: result.latencyMs, costUsd: result.costUsd };
    challenge.status = decision.passed ? "passed" : "failed";
    void saveAttempt(challenge).catch((e) => console.error("saveAttempt failed", e));
    return Response.json({
      passed: decision.passed,
      checks: decision.checks,
      item: result.observation.item_description,
      tamperingSigns: result.observation.tampering_signs,
      verifyMs: result.latencyMs,
      model: result.model,
    });
  } catch (err) {
    console.error("verification failed", err);
    challenge.status = "failed";
    challenge.error = String(err);
    void saveAttempt(challenge).catch((e) => console.error("saveAttempt failed", e));
    return Response.json({ error: "Verification is unavailable right now. Start a new challenge." }, { status: 502 });
  }
}
