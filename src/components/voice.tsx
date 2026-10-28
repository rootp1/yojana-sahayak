"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n";

/* eslint-disable @typescript-eslint/no-explicit-any -- Web Speech API types are not in lib.dom */
type Recognition = any;

function getRecognition(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Mode = "browser" | "server" | "none";

/**
 * Voice input. Prefers the browser's built-in recognizer (free, works offline-ish on
 * Android Chrome with hi-IN / en-IN). Falls back to recording audio and sending it to
 * /api/stt when the server has a speech-to-text key.
 */
export function MicButton({
  lang,
  onInterim,
  onFinal,
  labels,
  onUnsupported,
}: {
  lang: Locale;
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  labels: { start: string; stop: string; listening: string };
  onUnsupported?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("browser");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    if (getRecognition()) return;
    fetch("/api/stt")
      .then((r) => r.json())
      .then((d: { enabled: boolean }) => setMode(d.enabled && "MediaRecorder" in window ? "server" : "none"))
      .catch(() => setMode("none"));
  }, []);

  useEffect(
    () => () => {
      recRef.current?.abort?.();
      mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  function startBrowser() {
    const Rec = getRecognition();
    if (!Rec) return;
    const rec = new Rec();
    // Hindi recognizer also understands most Hinglish; English (India) handles Indian accents.
    rec.lang = lang === "hi" ? "hi-IN" : "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      onInterim?.(finalText + interim);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) onFinal(finalText.trim());
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  async function startServer() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onUnsupported?.();
      return;
    }
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setListening(false);
      setBusy(true);
      try {
        const body = new FormData();
        body.append("audio", new Blob(chunks, { type: rec.mimeType }), "speech.webm");
        const res = await fetch("/api/stt", { method: "POST", body });
        const data = (await res.json()) as { text?: string };
        if (data.text?.trim()) onFinal(data.text.trim());
      } finally {
        setBusy(false);
      }
    };
    mediaRef.current = rec;
    rec.start();
    setListening(true);
    // Safety stop so a forgotten mic doesn't record forever.
    setTimeout(() => rec.state === "recording" && rec.stop(), 30000);
  }

  function toggle() {
    if (listening) {
      recRef.current?.stop?.();
      if (mediaRef.current?.state === "recording") mediaRef.current.stop();
      return;
    }
    if (mode === "browser") startBrowser();
    else if (mode === "server") void startServer();
    else onUnsupported?.();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={listening}
      aria-label={listening ? labels.stop : labels.start}
      className={`relative grid size-14 shrink-0 place-items-center rounded-full text-2xl text-brand-ink transition-transform active:scale-95 disabled:opacity-60 ${
        listening ? "bg-danger" : "bg-brand"
      }`}
    >
      {listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-danger/40 motion-reduce:hidden" />}
      <span aria-hidden className="relative">{busy ? "…" : listening ? "■" : "🎙️"}</span>
      <span className="sr-only" aria-live="polite">{listening ? labels.listening : ""}</span>
    </button>
  );
}

function plainText(md: string) {
  return md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_#>`]/g, "")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickVoice(langTag: string) {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase() === langTag.toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(langTag.slice(0, 2)))
  );
}

const noopSubscribe = () => () => {};

/** Reads text aloud with the device's own voice (no network, no cost). */
export function SpeakButton({ text, labels }: { text: string; labels: { listen: string; stop: string } }) {
  const [speaking, setSpeaking] = useState(false);
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => "speechSynthesis" in window,
    () => false,
  );

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  if (!supported) return null;

  function speak() {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const clean = plainText(text);
    const langTag = /[ऀ-ॿ]/.test(clean) ? "hi-IN" : "en-IN";
    const voice = pickVoice(langTag);
    // Chrome stops long utterances after ~15s, so speak sentence by sentence.
    const parts = clean.match(/[^.!?।]+[.!?।]?/g) ?? [clean];
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p.trim());
      u.lang = langTag;
      if (voice) u.voice = voice;
      u.rate = 0.95;
      if (i === parts.length - 1) u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      synth.speak(u);
    });
    setSpeaking(true);
  }

  return (
    <button
      type="button"
      onClick={speak}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-brand active:bg-surface-2"
    >
      <span aria-hidden>{speaking ? "⏹" : "🔊"}</span>
      {speaking ? labels.stop : labels.listen}
    </button>
  );
}
