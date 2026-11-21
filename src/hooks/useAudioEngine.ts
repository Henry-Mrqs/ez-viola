"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AudioEngine } from "@/audio/audio-engine";
import { AudioEngineStatus } from "@/audio/types";

export function useAudioEngine(autoCleanup: boolean = true) {
  const engineRef = useRef<AudioEngine | null>(null);
  const [status, setStatus] = useState<AudioEngineStatus>("uninitialized");
  const [error, setError] = useState<string | null>(null);

  if (!engineRef.current) {
    engineRef.current = new AudioEngine();
  }

  const engine = engineRef.current;

  useEffect(() => {
    engine.onStatusChange = (newStatus) => {
      setStatus(newStatus);
    };

    // Load saved noise gate calibration if present
    if (typeof window !== "undefined") {
      try {
        const savedThresh = localStorage.getItem("ezviola_noisegate_thresh");
        if (savedThresh) {
          const threshNum = parseFloat(savedThresh);
          if (!isNaN(threshNum) && threshNum > 0) {
            engine.getTunerEngine().getNoiseGate().setThreshold(threshNum);
          }
        }
      } catch {}
    }

    return () => {
      if (autoCleanup) {
        engine.stop().catch(() => {});
      }
    };
  }, [engine, autoCleanup]);

  const start = useCallback(async () => {
    setError(null);
    try {
      await engine.start();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Permissão de microfone negada ou dispositivo indisponível.";
      setError(msg);
      throw err;
    }
  }, [engine]);

  const stop = useCallback(async () => {
    try {
      await engine.stop();
    } catch (err) {
      console.warn("AudioEngine stop error:", err);
    }
  }, [engine]);

  return {
    engine,
    status,
    error,
    start,
    stop,
    isRunning: status === "running",
  };
}
