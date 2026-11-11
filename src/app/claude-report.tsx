// What Claude reported about the frames, shown next to the rules' verdict, so the seller and
// the buyer can see which part is AI and which part is fixed code. Works on the server and in
// the browser (no hooks).
import { GESTURE_INFO, isGesture } from "@/lib/gestures";
import type { Observation } from "@/lib/verify";

const MEDIUM: Record<Observation["moment1"]["code_medium"], string> = {
  handwritten_paper: "handwritten on paper",
  printed_paper: "printed on paper",
  screen: "on a screen",
  none: "no code in view",
  unclear: "unclear",
};

const PHYSICAL: Record<Observation["item_is_physical"], string> = {
  physical_object: "a real object",
  on_screen: "a picture on a screen",
  printed_photo: "a printed photo",
  unclear: "unclear",
};

function gesture(value: string) {
  return isGesture(value) ? `${GESTURE_INFO[value].emoji} ${GESTURE_INFO[value].label}` : value === "none" ? "no gesture" : "another gesture";
}

function moment(m: Observation["moment1"]) {
  const code = m.handwritten_code ? `code “${m.handwritten_code}”, ${MEDIUM[m.code_medium]}` : `no legible code (${MEDIUM[m.code_medium]})`;
  return `${code}; ${gesture(m.gesture)}; item ${m.item_visible ? "in view" : "not in view"}`;
}

export default function ClaudeReport({ observation, model }: { observation: Observation; model: string }) {
  const o = observation;
  const rows: [string, string][] = [
    ["First moment", moment(o.moment1)],
    ["Surprise moment", `${moment(o.moment2)}; ${o.same_scene_both_moments ? "same scene" : "a different scene"}`],
    ["Item on camera", `${o.item_description.replace(/[.\s]+$/, "")}. Looks like ${PHYSICAL[o.item_is_physical]}.`],
    ["Compared with the listing", o.item_matches_listing === "yes" ? "matches" : o.item_matches_listing === "no" ? "does not match" : "same kind of item, exact model not confirmed"],
  ];
  if (o.model_label_text) rows.splice(3, 0, ["Model label", `“${o.model_label_text}”`]);
  if (o.tampering_signs.length) rows.push(["Warnings", o.tampering_signs.join("; ")]);
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-ink-soft p-4">
      <div>
        <p className="font-medium">What Claude reported</p>
        <p className="text-sm text-muted">
          {model} was not told the code or the gestures. It only describes the frames; the rules compare its report with the challenge.
        </p>
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[11rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
