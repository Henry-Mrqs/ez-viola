"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { AudioSynthesizer } from "@/audio/audio-synthesizer";

export interface AudioClockControls {
  getCurrentTime: () => number;
  start: (offsetSec?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setSpeed: (speed: number) => void;
  speed: number;
  isPlaying: boolean;
  isPaused: boolean;
  enableMetronome: boolean;
  setEnableMetronome: (enabled: boolean) => void;
}

export function useAudioClock(
  audioCtx: AudioContext | null,
  bpm: number = 60
): AudioClockControls {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeedState] = useState(1.0);
  const [enableMetronome, setEnableMetronome] = useState(true);

  // References for Zero-Drift timing
  const startCtxTimeRef = useRef<number>(0);
  const songElapsedRef = useRef<number>(0);
  const lastUpdateCtxTimeRef = useRef<number>(0);
  const speedRef = useRef<number>(1.0);
  const isPlayingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);

  // Metronome scheduler refs
  const nextMetronomeBeatRef = useRef<number>(0);
  const enableMetronomeRef = useRef<boolean>(true);
  const bpmRef = useRef<number>(bpm);

  bpmRef.current = bpm;
  enableMetronomeRef.current = enableMetronome;

  const getCurrentTime = useCallback((): number => {
    if (!isPlayingRef.current) return 0;
    if (!audioCtx) return songElapsedRef.current;

    if (isPausedRef.current) {
      return songElapsedRef.current;
    }

    const nowCtx = audioCtx.currentTime;
    const deltaCtx = Math.max(0, nowCtx - lastUpdateCtxTimeRef.current);
    const virtualDelta = deltaCtx * speedRef.current;
    return songElapsedRef.current + virtualDelta;
  }, [audioCtx]);

  const scheduleMetronome = useCallback(() => {
    if (!audioCtx || !isPlayingRef.current || isPausedRef.current) return;
    if (!enableMetronomeRef.current) return;

    const secondsPerBeat = 60 / (bpmRef.current * speedRef.current);
    const lookahead = 0.1; // Schedule 100ms ahead
    const currentSongTime = getCurrentTime();

    while (
      nextMetronomeBeatRef.current * secondsPerBeat <
      currentSongTime + lookahead
    ) {
      const beatNum = nextMetronomeBeatRef.current;
      const beatSongTime = beatNum * secondsPerBeat;
      const timeDiff = beatSongTime - currentSongTime;

      if (timeDiff >= -0.05) {
        const scheduleAudioTime = audioCtx.currentTime + Math.max(0, timeDiff);
        const isDownbeat = beatNum % 4 === 0;
        AudioSynthesizer.playMetronomeClick(audioCtx, scheduleAudioTime, isDownbeat);
      }

      nextMetronomeBeatRef.current++;
    }
  }, [audioCtx, getCurrentTime]);

  // Metronome scheduler timer
  useEffect(() => {
    if (!isPlaying || isPaused || !audioCtx) return;

    const interval = setInterval(() => {
      scheduleMetronome();
    }, 25);

    return () => clearInterval(interval);
  }, [isPlaying, isPaused, audioCtx, scheduleMetronome]);

  const start = useCallback(
    (offsetSec: number = 0) => {
      if (!audioCtx) return;

      const now = audioCtx.currentTime;
      startCtxTimeRef.current = now;
      lastUpdateCtxTimeRef.current = now;
      songElapsedRef.current = offsetSec;
      nextMetronomeBeatRef.current = Math.floor(
        offsetSec / (60 / (bpmRef.current * speedRef.current))
      );

      isPlayingRef.current = true;
      isPausedRef.current = false;
      setIsPlaying(true);
      setIsPaused(false);
    },
    [audioCtx]
  );

  const pause = useCallback(() => {
    if (!isPlayingRef.current || isPausedRef.current || !audioCtx) return;

    // Freeze virtual elapsed time
    const now = audioCtx.currentTime;
    const delta = (now - lastUpdateCtxTimeRef.current) * speedRef.current;
    songElapsedRef.current += delta;
    lastUpdateCtxTimeRef.current = now;

    isPausedRef.current = true;
    setIsPaused(true);
  }, [audioCtx]);

  const resume = useCallback(() => {
    if (!isPlayingRef.current || !isPausedRef.current || !audioCtx) return;

    lastUpdateCtxTimeRef.current = audioCtx.currentTime;
    isPausedRef.current = false;
    setIsPaused(false);
  }, [audioCtx]);

  const stop = useCallback(() => {
    isPlayingRef.current = false;
    isPausedRef.current = false;
    songElapsedRef.current = 0;
    nextMetronomeBeatRef.current = 0;

    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const setSpeed = useCallback(
    (newSpeed: number) => {
      if (!audioCtx) {
        speedRef.current = newSpeed;
        setSpeedState(newSpeed);
        return;
      }

      // Consolidate elapsed time before changing speed to prevent time jumps
      const now = audioCtx.currentTime;
      if (isPlayingRef.current && !isPausedRef.current) {
        const delta = (now - lastUpdateCtxTimeRef.current) * speedRef.current;
        songElapsedRef.current += delta;
      }
      lastUpdateCtxTimeRef.current = now;

      speedRef.current = newSpeed;
      setSpeedState(newSpeed);
    },
    [audioCtx]
  );

  return {
    getCurrentTime,
    start,
    pause,
    resume,
    stop,
    setSpeed,
    speed,
    isPlaying,
    isPaused,
    enableMetronome,
    setEnableMetronome,
  };
}
