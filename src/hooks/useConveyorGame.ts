"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { SongSchema, TimelineEvent } from "@/songs/song-schema";
import { TunerResult, ChordResult } from "@/audio/types";
import { AudioClockControls } from "./useAudioClock";
import { AudioSynthesizer } from "@/audio/audio-synthesizer";
import { isSingleNoteMatch } from "@/audio/pitch-helper";

export interface GameScoreState {
  score: number;
  combo: number;
  maxCombo: number;
  multiplier: number;
  isFeverMode: boolean;
  perfectCount: number;
  goodCount: number;
  missCount: number;
  totalEvents: number;
  accuracy: number;
  stars: number;
  isFinished: boolean;
}

export function evaluateHit(
  timeDeltaSec: number,
  isHarmonicMatch: boolean,
  matchConfidence: number = 1.0
): "perfect" | "good" | "miss" {
  const absDelta = Math.abs(timeDeltaSec);

  if (isHarmonicMatch) {
    if (absDelta <= 0.05 && matchConfidence >= 0.85) {
      return "perfect";
    }
    if (absDelta <= 0.12 && matchConfidence >= 0.7) {
      return "good";
    }
  }

  return "miss";
}

export function calculateStars(accuracy: number): number {
  if (accuracy >= 95) return 3;
  if (accuracy >= 80) return 2;
  if (accuracy >= 60) return 1;
  return 0;
}

export function useConveyorGame(
  song: SongSchema,
  clock: AudioClockControls,
  audioCtx: AudioContext | null
) {
  const [scoreState, setScoreState] = useState<GameScoreState>({
    score: 0,
    combo: 0,
    maxCombo: 0,
    multiplier: 1.0,
    isFeverMode: false,
    perfectCount: 0,
    goodCount: 0,
    missCount: 0,
    totalEvents: song.timeline.length,
    accuracy: 0,
    stars: 0,
    isFinished: false,
  });

  const [enableWaitMode, setEnableWaitModeState] = useState<boolean>(true);
  const [isWaiting, setIsWaiting] = useState<boolean>(false);
  const [activeWaitEvent, setActiveWaitEvent] = useState<TimelineEvent | null>(null);

  const [lastFeedback, setLastFeedback] = useState<"perfect" | "good" | "miss" | null>(null);
  const [feedbackTimestamp, setFeedbackTimestamp] = useState<number>(0);

  // Synchronous refs for 60 FPS animation loop
  const isWaitingRef = useRef<boolean>(false);
  const activeWaitEventRef = useRef<TimelineEvent | null>(null);
  const enableWaitModeRef = useRef<boolean>(true);

  // Tracking processed events
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  const waitResumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFinishedRef = useRef<boolean>(false);

  // Latest DSP results refs for zero-latency checks
  const latestTunerRef = useRef<TunerResult | null>(null);
  const latestChordRef = useRef<ChordResult | null>(null);

  const setEnableWaitMode = useCallback((val: boolean) => {
    enableWaitModeRef.current = val;
    setEnableWaitModeState(val);
  }, []);

  const onTunerUpdate = useCallback((res: TunerResult) => {
    latestTunerRef.current = res;
  }, []);

  const onChordUpdate = useCallback((res: ChordResult) => {
    latestChordRef.current = res;
  }, []);

  const resetGame = useCallback(() => {
    processedEventIdsRef.current.clear();
    isFinishedRef.current = false;
    isWaitingRef.current = false;
    activeWaitEventRef.current = null;
    setIsWaiting(false);
    setActiveWaitEvent(null);
    setLastFeedback(null);

    setScoreState({
      score: 0,
      combo: 0,
      maxCombo: 0,
      multiplier: 1.0,
      isFeverMode: false,
      perfectCount: 0,
      goodCount: 0,
      missCount: 0,
      totalEvents: song.timeline.length,
      accuracy: 0,
      stars: 0,
      isFinished: false,
    });

    clock.stop();
  }, [song, clock]);

  // Main evaluation ticker running continuously on requestAnimationFrame
  useEffect(() => {
    if (!clock.isPlaying) return;

    let animId: number;

    const gameLoop = () => {
      const currentSongTime = clock.getCurrentTime();

      // Check for song completion
      if (
        currentSongTime >= song.durationSec + 0.5 &&
        !isFinishedRef.current
      ) {
        isFinishedRef.current = true;
        clock.pause();

        setScoreState((prev) => {
          const totalHits = prev.perfectCount + prev.goodCount + prev.missCount;
          const effectiveTotal = Math.max(1, Math.max(totalHits, prev.totalEvents));
          const acc = Math.min(
            100,
            ((prev.perfectCount * 1.0 + prev.goodCount * 0.6) / effectiveTotal) * 100
          );
          const stars = calculateStars(acc);

          // Save progress in localStorage
          if (typeof window !== "undefined") {
            try {
              const prevSaved = localStorage.getItem("ezviola_progress");
              const parsed = prevSaved ? JSON.parse(prevSaved) : {};
              const songProgress = parsed[song.id] || { bestScore: 0, bestStars: 0 };

              if (prev.score > songProgress.bestScore || stars > songProgress.bestStars) {
                parsed[song.id] = {
                  bestScore: Math.max(prev.score, songProgress.bestScore),
                  bestStars: Math.max(stars, songProgress.bestStars),
                  completedAt: new Date().toISOString(),
                };
                localStorage.setItem("ezviola_progress", JSON.stringify(parsed));
              }
            } catch {}
          }

          return {
            ...prev,
            accuracy: Math.round(acc),
            stars,
            isFinished: true,
          };
        });
        return;
      }

      // Check timeline events near Hit Zone
      const timeline = song.timeline;

      for (let i = 0; i < timeline.length; i++) {
        const ev = timeline[i];
        if (processedEventIdsRef.current.has(ev.id)) continue;

        const timeDelta = currentSongTime - ev.timeSec;

        // 1. If currently in Wait Mode for this event:
        if (isWaitingRef.current && activeWaitEventRef.current?.id === ev.id) {
          // Continuously listen to microphone for target chord/note
          let matched = false;

          if (ev.type === "chord" && ev.chordId) {
            const chord = latestChordRef.current;
            if (
              chord &&
              chord.isGateOpen &&
              chord.chordId === ev.chordId &&
              chord.confidence >= 0.58
            ) {
              matched = true;
            }
          } else if (ev.type === "single-note" && ev.notes && ev.notes.length > 0) {
            const tuner = latestTunerRef.current;
            const targetNote = ev.notes[0];
            if (tuner && tuner.isGateOpen && tuner.frequency > 0) {
              const noteCheck = isSingleNoteMatch(
                targetNote.pitch,
                tuner.noteName,
                tuner.midiNote,
                tuner.cents,
                65
              );
              if (noteCheck.isMatch) {
                matched = true;
              }
            }
          }

          if (matched && !waitResumeTimeoutRef.current) {
            // Success in Wait Mode!
            if (audioCtx) {
              AudioSynthesizer.playConfirmationTing(audioCtx, audioCtx.currentTime);
            }
            setLastFeedback("perfect");
            setFeedbackTimestamp(performance.now());
            processedEventIdsRef.current.add(ev.id);

            // Award score and increment combo
            setScoreState((prev) => {
              const newCombo = prev.combo + 1;
              const mult =
                newCombo >= 40 ? 3.0 : newCombo >= 20 ? 2.0 : newCombo >= 10 ? 1.5 : 1.0;
              return {
                ...prev,
                score: prev.score + Math.round(100 * mult),
                combo: newCombo,
                maxCombo: Math.max(prev.maxCombo, newCombo),
                multiplier: mult,
                isFeverMode: newCombo >= 40,
                perfectCount: prev.perfectCount + 1,
              };
            });

            // 350ms stabilization buffer before resuming conveyor
            waitResumeTimeoutRef.current = setTimeout(() => {
              isWaitingRef.current = false;
              activeWaitEventRef.current = null;
              setIsWaiting(false);
              setActiveWaitEvent(null);
              clock.resume();
              waitResumeTimeoutRef.current = null;
            }, 350);
          }
          break; // Stop evaluating further events while waiting
        }

        // 2. Normal Conveyor Evaluation
        // Active Hit Window: [-140ms, +140ms]
        if (timeDelta >= -0.14 && timeDelta <= 0.14) {
          let isHarmonicMatch = false;
          let confidence = 0;

          if (ev.type === "chord" && ev.chordId) {
            const chord = latestChordRef.current;
            if (chord && chord.isGateOpen && chord.chordId === ev.chordId && chord.confidence >= 0.58) {
              isHarmonicMatch = true;
              confidence = chord.confidence;
            }
          } else if (ev.type === "single-note" && ev.notes && ev.notes.length > 0) {
            const tuner = latestTunerRef.current;
            const targetNote = ev.notes[0];
            if (tuner && tuner.isGateOpen && tuner.frequency > 0) {
              const noteCheck = isSingleNoteMatch(
                targetNote.pitch,
                tuner.noteName,
                tuner.midiNote,
                tuner.cents,
                55
              );
              if (noteCheck.isMatch) {
                isHarmonicMatch = true;
                confidence = noteCheck.confidence;
              }
            }
          }

          if (isHarmonicMatch) {
            const hitResult = evaluateHit(timeDelta, isHarmonicMatch, confidence);

            if (hitResult === "perfect" || hitResult === "good") {
              processedEventIdsRef.current.add(ev.id);
              setLastFeedback(hitResult);
              setFeedbackTimestamp(performance.now());

              if (hitResult === "perfect" && audioCtx) {
                AudioSynthesizer.playConfirmationTing(audioCtx, audioCtx.currentTime);
              }

              const pts = hitResult === "perfect" ? 100 : 50;

              setScoreState((prev) => {
                const newCombo = prev.combo + 1;
                const mult =
                  newCombo >= 40 ? 3.0 : newCombo >= 20 ? 2.0 : newCombo >= 10 ? 1.5 : 1.0;
                return {
                  ...prev,
                  score: prev.score + Math.round(pts * mult),
                  combo: newCombo,
                  maxCombo: Math.max(prev.maxCombo, newCombo),
                  multiplier: mult,
                  isFeverMode: newCombo >= 40,
                  perfectCount:
                    hitResult === "perfect" ? prev.perfectCount + 1 : prev.perfectCount,
                  goodCount: hitResult === "good" ? prev.goodCount + 1 : prev.goodCount,
                };
              });
              break;
            }
          }
        }

        // 3. Trigger Wait Mode or Miss
        // If event reached Hit Zone and passed by more than 60ms without being hit:
        if (timeDelta > 0.06) {
          if (enableWaitModeRef.current && !isWaitingRef.current) {
            // Trigger Wait Mode! Pause conveyor right on the hit line!
            clock.pause();
            isWaitingRef.current = true;
            activeWaitEventRef.current = ev;
            setIsWaiting(true);
            setActiveWaitEvent(ev);
            break;
          } else if (!enableWaitModeRef.current && timeDelta > 0.14) {
            // Wait Mode is OFF: record Miss
            processedEventIdsRef.current.add(ev.id);
            setLastFeedback("miss");
            setFeedbackTimestamp(performance.now());

            if (audioCtx) {
              AudioSynthesizer.playDampedMissSound(audioCtx, audioCtx.currentTime);
            }

            setScoreState((prev) => ({
              ...prev,
              combo: 0,
              multiplier: 1.0,
              isFeverMode: false,
              missCount: prev.missCount + 1,
            }));
            break;
          }
        }
      }

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      if (waitResumeTimeoutRef.current) {
        clearTimeout(waitResumeTimeoutRef.current);
        waitResumeTimeoutRef.current = null;
      }
    };
  }, [clock.isPlaying, song, audioCtx, clock]);

  return {
    scoreState,
    enableWaitMode,
    setEnableWaitMode,
    isWaiting,
    activeWaitEvent,
    lastFeedback,
    feedbackTimestamp,
    onTunerUpdate,
    onChordUpdate,
    resetGame,
  };
}
