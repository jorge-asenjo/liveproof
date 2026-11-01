// Shared by the browser (MediaPipe) and the server (challenge + verification).
// Names match MediaPipe's canned gesture categories.
export const GESTURES = ["Open_Palm", "Thumb_Up", "Victory", "Closed_Fist", "Pointing_Up"] as const;
export type Gesture = (typeof GESTURES)[number];

export const GESTURE_INFO: Record<Gesture, { emoji: string; label: string }> = {
  Open_Palm: { emoji: "✋", label: "open palm" },
  Thumb_Up: { emoji: "👍", label: "thumbs up" },
  Victory: { emoji: "✌️", label: "peace sign" },
  Closed_Fist: { emoji: "✊", label: "closed fist" },
  Pointing_Up: { emoji: "☝️", label: "index finger up" },
};

export function isGesture(value: unknown): value is Gesture {
  return typeof value === "string" && (GESTURES as readonly string[]).includes(value);
}
