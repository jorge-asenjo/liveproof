"use client";

import { useSyncExternalStore } from "react";

// Phone or tablet (touch screen) versus a computer with a mouse. The instructions and the
// default camera depend on it: a phone's back camera can look down at the table, a
// webcam cannot. null while rendering on the server.
const QUERY = "(pointer: coarse)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function useDevice(): "phone" | "computer" | null {
  return useSyncExternalStore(
    subscribe,
    () => (window.matchMedia(QUERY).matches ? "phone" : "computer"),
    () => null,
  );
}
