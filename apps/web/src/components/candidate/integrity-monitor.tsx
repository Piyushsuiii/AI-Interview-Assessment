"use client";

import { useEffect, useRef } from "react";
import { postIntegritySignals, type IntegritySignal } from "./public-api";

const DEDUPE_MS = 2_000;

export function IntegrityMonitor({ token, active }: { token: string; active: boolean }) {
  const queue = useRef<IntegritySignal[]>([]);
  const lastSent = useRef(new Map<string, number>());

  useEffect(() => {
    if (!active) return;
    let blurStarted: number | null = null;
    let hiddenStarted: number | null = null;
    let sending = false;

    const flush = async (keepalive = false) => {
      if (sending || queue.current.length === 0) return;
      sending = true;
      const batch = queue.current.splice(0, 20);
      try {
        await postIntegritySignals(token, batch, keepalive);
      } catch {
        queue.current.unshift(...batch);
      } finally {
        sending = false;
      }
    };

    const record = (signal: IntegritySignal) => {
      const metadataKey = signal.details ? JSON.stringify(signal.details) : "";
      const key = `${signal.type}:${metadataKey}`;
      const now = Date.now();
      if (now - (lastSent.current.get(key) ?? 0) < DEDUPE_MS) return;
      lastSent.current.set(key, now);
      queue.current.push(signal);
      if (queue.current.length >= 5) void flush();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenStarted = Date.now();
      record({
        type: "TAB_SWITCH",
        clientTimestamp: new Date().toISOString(),
        details: {
          state: document.visibilityState,
          ...(document.visibilityState === "visible" && hiddenStarted !== null ? { durationMs: Date.now() - hiddenStarted } : {}),
        },
      });
      if (document.visibilityState === "visible") hiddenStarted = null;
    };
    const onPaste = (event: ClipboardEvent) => record({
      type: "PASTE",
      clientTimestamp: new Date().toISOString(),
      details: {
        target: event.target instanceof HTMLTextAreaElement ? "textarea" : event.target instanceof HTMLInputElement ? "input" : "other",
        hasText: event.clipboardData?.types.includes("text/plain") ?? false,
        itemCount: event.clipboardData?.items.length ?? 0,
        hasFiles: Boolean(event.clipboardData?.files.length),
      },
    });
    const onBlur = () => { blurStarted = Date.now(); };
    const onFocus = () => {
      if (blurStarted === null) return;
      record({ type: "INACTIVITY", clientTimestamp: new Date().toISOString(), details: { durationMs: Date.now() - blurStarted, source: "window-blur" } });
      blurStarted = null;
    };
    const flushTimer = window.setInterval(() => void flush(), 10_000);
    const onPageHide = () => void flush(true);

    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("paste", onPaste);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("paste", onPaste);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(flushTimer);
      void flush(true);
    };
  }, [active, token]);

  return null;
}
