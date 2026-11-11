// Labels for the evaluation set. Shared by the browser (the seller picks one before an
// attempt, only when eval capture is on for their account) and the server.
export const EVAL_LABELS = [
  { id: "genuine", label: "Genuine: the real item and the code on paper" },
  { id: "attack:no_code", label: "Attack: no code written" },
  { id: "attack:code_on_screen", label: "Attack: code shown on a phone or monitor" },
  { id: "attack:item_on_screen", label: "Attack: photo of the item on a screen" },
  { id: "attack:printed_photo", label: "Attack: printed photo of the item" },
  { id: "attack:other_item", label: "Attack: a different item than the listing" },
  { id: "attack:wrong_gesture", label: "Attack: wrong or late surprise gesture" },
  { id: "attack:other", label: "Attack: something else" },
] as const;

export type EvalLabelId = (typeof EVAL_LABELS)[number]["id"];

export type EvalLabel = { label: "genuine" | "attack"; attack: string | null };

export function parseEvalLabel(value: unknown): EvalLabel | null {
  if (typeof value !== "string" || !EVAL_LABELS.some((l) => l.id === value)) return null;
  if (value === "genuine") return { label: "genuine", attack: null };
  return { label: "attack", attack: value.slice("attack:".length) };
}
