// Shared Claude settings. Models can be overridden with env vars to compare them in the eval.
export const VERIFY_MODEL = process.env.VERIFY_MODEL ?? "claude-opus-5-5";
export const LISTING_MODEL = process.env.LISTING_MODEL ?? "claude-opus-5-5";

// Server-side refusal fallback (beta) for models that support it. Claude Haiku has
// no server-side fallback, so nothing is added for it.
export function claudeExtras(model: string) {
  if (model.startsWith("claude-opus") || model.startsWith("claude-sonnet") || model.startsWith("claude-fable")) {
    return { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
  }
  return {};
}
