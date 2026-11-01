// Live challenge state machine (server-only). The random code and gestures come from
// crypto, never from the model. State lives in memory: Render's free plan runs one
// instance, and a challenge only lives a few minutes.
import { randomBytes, randomInt } from "node:crypto";
import { GESTURES, type Gesture } from "./gestures";
import type { Listing } from "./listing";
import type { Seller } from "./session";
import type { Decision, Observation } from "./verify";

// No look-alike characters (0/O, 1/I/L, 2/Z, 5/S, 6/G, 8/B, Q).
const CODE_ALPHABET = "ACDEFHJKMNPRTUVWXY34679";
export const CODE_LENGTH = 5;
export const WRITE_WINDOW_MS = 3 * 60_000; // from showing the code to moment 1
export const GESTURE_B_WINDOW_MS = 10_000; // from revealing the surprise gesture to moment 2
export const MAX_FRAMES_PER_MOMENT = 3;
export const MAX_FRAME_CHARS = 1_500_000; // ~1.1 MB of JPEG per frame

export type Draft = { id: string; sellerId: string; listingText: string; listing: Listing; createdAt: number };

export type ChallengeStatus = "open" | "awaiting_gesture_b" | "verifying" | "passed" | "failed" | "expired";

export type Challenge = {
  id: string;
  draftId: string;
  seller: Seller;
  listing: Listing;
  code: string;
  gestureA: Gesture;
  gestureB?: Gesture;
  createdAt: number;
  moment1At?: number;
  gestureBIssuedAt?: number;
  moment2At?: number;
  moment1?: string[];
  moment2?: string[];
  status: ChallengeStatus;
  observation?: Observation;
  decision?: Decision;
  verify?: { model: string; latencyMs: number; costUsd: number | null };
  error?: string;
};

type Store = { drafts: Map<string, Draft>; challenges: Map<string, Challenge> };
const g = globalThis as typeof globalThis & { __liveproofStore?: Store };
export const store: Store = (g.__liveproofStore ??= { drafts: new Map(), challenges: new Map() });

export function newId(bytes = 9) {
  return randomBytes(bytes).toString("base64url");
}

export function sellerId(seller: Seller) {
  return seller.payer_id ?? seller.user_id ?? seller.email ?? "unknown";
}

function randomCode() {
  return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

function randomGesture(except?: Gesture): Gesture {
  const options = GESTURES.filter((x) => x !== except);
  return options[randomInt(options.length)];
}

export function createChallenge(draft: Draft, seller: Seller): Challenge {
  const challenge: Challenge = {
    id: newId(),
    draftId: draft.id,
    seller,
    listing: draft.listing,
    code: randomCode(),
    gestureA: randomGesture(),
    createdAt: Date.now(),
    status: "open",
  };
  store.challenges.set(challenge.id, challenge);
  return challenge;
}

export class ChallengeError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function validateFrames(frames: unknown): string[] {
  if (!Array.isArray(frames) || frames.length < 1 || frames.length > MAX_FRAMES_PER_MOMENT) {
    throw new ChallengeError(`Send between 1 and ${MAX_FRAMES_PER_MOMENT} frames`);
  }
  for (const f of frames) {
    if (typeof f !== "string" || !f.startsWith("data:image/") || f.length > MAX_FRAME_CHARS) {
      throw new ChallengeError("Invalid frame");
    }
  }
  return frames as string[];
}

export function getOwnedChallenge(id: string, seller: Seller): Challenge {
  const challenge = store.challenges.get(id);
  if (!challenge || sellerId(challenge.seller) !== sellerId(seller)) throw new ChallengeError("Challenge not found", 404);
  return challenge;
}

// Moment 1: code + gesture A captured. Reveals the surprise gesture B and starts its clock.
export function recordMoment1(challenge: Challenge, frames: string[]): Gesture {
  const now = Date.now();
  if (challenge.status !== "open") throw new ChallengeError("This challenge was already used", 409);
  if (now - challenge.createdAt > WRITE_WINDOW_MS) {
    challenge.status = "expired";
    throw new ChallengeError("The challenge expired. Start a new one.", 410);
  }
  challenge.moment1 = frames;
  challenge.moment1At = now;
  challenge.gestureB = randomGesture(challenge.gestureA);
  challenge.gestureBIssuedAt = now;
  challenge.status = "awaiting_gesture_b";
  return challenge.gestureB;
}

// Moment 2: surprise gesture captured. The time limit is checked later, in decide().
export function recordMoment2(challenge: Challenge, frames: string[]) {
  if (challenge.status !== "awaiting_gesture_b") throw new ChallengeError("This challenge is not waiting for the second gesture", 409);
  challenge.moment2 = frames;
  challenge.moment2At = Date.now();
  challenge.status = "verifying";
}

export function gestureBDelayMs(challenge: Challenge) {
  return (challenge.moment2At ?? Date.now()) - (challenge.gestureBIssuedAt ?? 0);
}
