"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AudioEngine } from "@/audio/audio-engine";
import { AudioEngineStatus } from "@/audio/types";

export function useAudioEngine(autoCleanup: boolean = true) {
  const engineRef = useRef<AudioEngine | null>(null);
  const [status, setStatus] = useState<AudioEngineStatus>("uninitialized");
  const [error, setError] = useState<string | null>(null);
  const [isLoopback, setIsLoopback] = useState<boolean>(false);
  const [loopbackVolume, setLoopbackVolumeState] = useState<number>(1.0);

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
      setIsLoopback(false);
    } catch (err) {
      console.warn("AudioEngine stop error:", err);
    }
  }, [engine]);

  const setLoopbackVolume = useCallback(
    (vol: number) => {
      const clamped = Math.max(0, Math.min(1.0, vol));
      setLoopbackVolumeState(clamped);
      engine.setLoopback(engine.isLoopbackEnabled(), clamped);
    },
    [engine]
  );

  const toggleLoopback = useCallback(() => {
    const next = !engine.isLoopbackEnabled();
    engine.setLoopback(next, loopbackVolume);
    setIsLoopback(next);
  }, [engine, loopbackVolume]);

  const setLoopback = useCallback(
    (enabled: boolean, volume?: number) => {
      const vol = volume !== undefined ? Math.max(0, Math.min(1.0, volume)) : loopbackVolume;
      if (volume !== undefined) {
        setLoopbackVolumeState(vol);
      }
      engine.setLoopback(enabled, vol);
      setIsLoopback(enabled);
    },
    [engine, loopbackVolume]
  );

  return {
    engine,
    status,
    error,
    start,
    stop,
    isRunning: status === "running",
    isLoopback,
    loopbackVolume,
    toggleLoopback,
    setLoopback,
    setLoopbackVolume,
  };
}
