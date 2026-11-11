// Results of the evaluation set (scripts/eval.ts), shown on the landing page.
// null until the set is recorded; update it by hand from the eval output.
export const EVAL_SUMMARY: {
  cases: number;
  model: string;
  genuine: string; // e.g. "14/15"
  attacks: string; // e.g. "41/42"
  medianSeconds: string; // e.g. "4.1 s"
  note: string;
} | null = null;
