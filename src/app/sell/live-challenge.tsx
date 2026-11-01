"use client";

// The live camera challenge. MediaPipe runs in the browser only to guide the seller and
// pick the moment to capture frames; the server and Claude make the actual decision.
import type { GestureRecognizer } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useRef, useState } from "react";
import { GESTURE_INFO, isGesture, type Gesture } from "@/lib/gestures";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm";
const GESTURE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";
const MIN_SCORE = 0.6;
const HOLD_MS_MOMENT1 = 700;
const HOLD_MS_MOMENT2 = 300;
const FRAMES_PER_MOMENT = 2;
const FRAME_GAP_MS = 250;
const MAX_WIDTH = 1280;
const UPLOAD_MARGIN_MS = 1500; // shown countdown ends a bit early to leave time for the upload
const MANUAL_CAPTURE_AFTER_MS = 8000;

export type VerifyResult = {
  passed: boolean;
  checks: { id: string; label: string; ok: boolean; hard: boolean; detail?: string }[];
  item: string;
  tamperingSigns: string[];
  verifyMs: number;
  model: string;
};

type Phase =
  | { name: "starting" }
  | { name: "ready" }
  | { name: "moment1"; challengeId: string; code: string; gestureA: Gesture; proofDetail: string; since: number }
  | { name: "moment2"; challengeId: string; code: string; gestureB: Gesture; deadline: number; windowMs: number }
  | { name: "verifying"; since: number }
  | { name: "error"; message: string };

export default function LiveChallenge({ draftId, onResult }: { draftId: string; onResult: (r: VerifyResult) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const phaseRef = useRef<Phase>({ name: "starting" });
  const busyRef = useRef(false);
  const holdRef = useRef<{ gesture: Gesture | null; since: number }>({ gesture: null, since: 0 });
  const seenRef = useRef<Gesture | null>(null);
  const actionsRef = useRef<{ submit1: () => void; submit2: () => void }>({ submit1: () => {}, submit2: () => {} });

  const [phase, setPhase] = useState<Phase>({ name: "starting" });
  const [seen, setSeen] = useState<Gesture | null>(null);
  const [tracker, setTracker] = useState<"loading" | "ready" | "failed">("loading");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [now, setNow] = useState(0);

  const go = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const fail = useCallback((err: unknown) => go({ name: "error", message: err instanceof Error ? err.message : String(err) }), [go]);

  // Camera
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        if (phaseRef.current.name === "starting") go({ name: "ready" });
      } catch {
        if (!cancelled) fail(new Error("The live proof needs your camera. Allow camera access and try again."));
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing, go, fail]);

  // Hand tracking (MediaPipe Gesture Recognizer, in the browser)
  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let recognizer: GestureRecognizer | null = null;
    let lastVideoTime = -1;

    const onGesture = (gesture: Gesture | null) => {
      if (gesture !== seenRef.current) {
        seenRef.current = gesture;
        setSeen(gesture);
      }
      const p = phaseRef.current;
      const target = p.name === "moment1" ? p.gestureA : p.name === "moment2" ? p.gestureB : null;
      const t = performance.now();
      if (gesture !== holdRef.current.gesture) holdRef.current = { gesture, since: t };
      if (!target || busyRef.current || gesture !== target) return;
      const needed = p.name === "moment1" ? HOLD_MS_MOMENT1 : HOLD_MS_MOMENT2;
      if (t - holdRef.current.since < needed) return;
      if (p.name === "moment1") actionsRef.current.submit1();
      else actionsRef.current.submit2();
    };

    (async () => {
      const { FilesetResolver, GestureRecognizer } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      const options = (delegate: "GPU" | "CPU") => ({
        baseOptions: { modelAssetPath: GESTURE_MODEL, delegate },
        runningMode: "VIDEO" as const,
        numHands: 2,
      });
      try {
        recognizer = await GestureRecognizer.createFromOptions(fileset, options("GPU"));
      } catch {
        recognizer = await GestureRecognizer.createFromOptions(fileset, options("CPU"));
      }
      if (cancelled) return recognizer.close();
      setTracker("ready");
      const loop = () => {
        raf = requestAnimationFrame(loop);
        const video = videoRef.current;
        if (!recognizer || !video || video.readyState < 2 || video.currentTime === lastVideoTime) return;
        lastVideoTime = video.currentTime;
        const result = recognizer.recognizeForVideo(video, performance.now());
        let best: Gesture | null = null;
        let bestScore = MIN_SCORE;
        for (const hand of result.gestures) {
          const top = hand[0];
          if (top && top.score >= bestScore && isGesture(top.categoryName)) {
            best = top.categoryName;
            bestScore = top.score;
          }
        }
        onGesture(best);
      };
      raf = requestAnimationFrame(loop);
    })().catch((err) => {
      console.error("hand tracking failed", err);
      if (!cancelled) setTracker("failed");
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      recognizer?.close();
    };
  }, []);

  const captureFrames = useCallback(async () => {
    const video = videoRef.current!;
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d")!;
    const frames: string[] = [];
    for (let i = 0; i < FRAMES_PER_MOMENT; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, FRAME_GAP_MS));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.85));
    }
    return frames;
  }, []);

  async function postJson(url: string, payload: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
    return body;
  }

  const startChallenge = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const body = await postJson("/api/challenge", { draftId });
      go({ name: "moment1", challengeId: body.id, code: body.code, gestureA: body.gestureA, proofDetail: body.proofDetail, since: Date.now() });
    } catch (err) {
      fail(err);
    } finally {
      busyRef.current = false;
    }
  }, [draftId, go, fail]);

  const submit1 = useCallback(async () => {
    const p = phaseRef.current;
    if (p.name !== "moment1" || busyRef.current) return;
    busyRef.current = true;
    try {
      const frames = await captureFrames();
      const body = await postJson(`/api/challenge/${p.challengeId}/moment1`, { frames });
      go({
        name: "moment2",
        challengeId: p.challengeId,
        code: p.code,
        gestureB: body.gestureB,
        windowMs: body.windowMs - UPLOAD_MARGIN_MS,
        deadline: Date.now() + body.windowMs - UPLOAD_MARGIN_MS,
      });
    } catch (err) {
      fail(err);
    } finally {
      busyRef.current = false;
    }
  }, [captureFrames, go, fail]);

  const submit2 = useCallback(async () => {
    const p = phaseRef.current;
    if (p.name !== "moment2" || busyRef.current) return;
    busyRef.current = true;
    try {
      const frames = await captureFrames();
      go({ name: "verifying", since: Date.now() });
      const body = await postJson(`/api/challenge/${p.challengeId}/moment2`, { frames });
      onResult(body as VerifyResult);
    } catch (err) {
      fail(err);
    } finally {
      busyRef.current = false;
    }
  }, [captureFrames, go, fail, onResult]);

  useEffect(() => {
    actionsRef.current = { submit1: () => void submit1(), submit2: () => void submit2() };
  }, [submit1, submit2]);

  // Clock for countdowns; when the surprise gesture's time runs out, send what the camera sees.
  useEffect(() => {
    if (phase.name !== "moment1" && phase.name !== "moment2" && phase.name !== "verifying") return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const p = phaseRef.current;
      if (p.name === "moment2" && t >= p.deadline) void submit2();
    }, 100);
    return () => clearInterval(timer);
  }, [phase.name, submit2]);

  const seenInfo = seen ? GESTURE_INFO[seen] : null;

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200 sm:p-6">
      <div className="relative overflow-hidden rounded-xl bg-neutral-900">
        <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
        <div className="absolute left-3 top-3 flex gap-2 text-xs">
          <span className="rounded-full bg-black/60 px-3 py-1 text-white">
            {tracker === "ready" ? `Hand: ${seenInfo ? `${seenInfo.emoji} ${seenInfo.label}` : "—"}` : tracker === "loading" ? "Loading hand tracking…" : "Hand tracking unavailable"}
          </span>
          <span className="rounded-full bg-red-600 px-3 py-1 font-medium text-white">LIVE</span>
        </div>
        <button
          onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white"
        >
          Switch camera
        </button>
        {phase.name === "moment2" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0070e0]/30 text-white">
            <span className="text-8xl drop-shadow-lg">{GESTURE_INFO[phase.gestureB].emoji}</span>
            <span className="mt-2 rounded-full bg-black/60 px-4 py-2 text-xl font-semibold">
              Now: {GESTURE_INFO[phase.gestureB].label}! {(Math.max(0, Math.min(phase.windowMs, phase.deadline - now)) / 1000).toFixed(1)} s
            </span>
          </div>
        )}
      </div>

      {phase.name === "starting" && <p className="text-neutral-600">Starting the camera…</p>}

      {phase.name === "ready" && (
        <div className="flex flex-col gap-3">
          <p className="text-neutral-700">
            Get your pen and paper ready and frame the item. The code appears when you press the button and is valid for 3 minutes.
          </p>
          <button onClick={startChallenge} className="w-fit rounded-full bg-[#0070e0] px-6 py-3 font-medium text-white">
            Show my code
          </button>
        </div>
      )}

      {phase.name === "moment1" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm uppercase tracking-widest text-neutral-500">Write this code on the paper</p>
          <p className="font-mono text-5xl font-bold tracking-[0.3em]">{phase.code}</p>
          <p className="text-lg">
            Put the paper next to the item, then show {GESTURE_INFO[phase.gestureA].emoji}{" "}
            <strong>{GESTURE_INFO[phase.gestureA].label}</strong>. Also show: {phase.proofDetail}.
          </p>
          {(tracker !== "ready" || now - phase.since > MANUAL_CAPTURE_AFTER_MS) && (
            <button onClick={() => void submit1()} className="w-fit text-sm text-neutral-500 underline">
              My hand is not detected: capture now
            </button>
          )}
        </div>
      )}

      {phase.name === "moment2" && (
        <p className="text-lg">
          Surprise gesture: keep the code and the item in frame and show {GESTURE_INFO[phase.gestureB].emoji}{" "}
          <strong>{GESTURE_INFO[phase.gestureB].label}</strong>.
        </p>
      )}

      {phase.name === "verifying" && (
        <p className="text-lg text-neutral-700">
          Checking the frames with Claude… {now > phase.since ? `${((now - phase.since) / 1000).toFixed(0)} s` : ""}
        </p>
      )}

      {phase.name === "error" && (
        <div className="flex flex-col gap-3">
          <p className="text-red-700">{phase.message}</p>
          <button onClick={() => go({ name: "ready" })} className="w-fit rounded-full bg-neutral-900 px-6 py-3 font-medium text-white">
            Start a new challenge
          </button>
        </div>
      )}
    </section>
  );
}
