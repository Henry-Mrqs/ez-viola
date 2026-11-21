"use client";

import { useState, useEffect, useCallback } from "react";
import { AudioEngine } from "@/audio/audio-engine";
import { TunerResult } from "@/audio/types";

const INITIAL_TUNER_RESULT: TunerResult = {
  frequency: -1,
  smoothedFrequency: -1,
  targetFrequency: 0,
  noteName: "-",
  octave: 0,
  midiNote: 0,
  cents: 0,
  inTune: false,
  clarity: 0,
  rms: 0,
  isGateOpen: false,
  stringIndex: -1,
};

export function useTuner(engine: AudioEngine) {
  const [tunerResult, setTunerResult] = useState<TunerResult>(INITIAL_TUNER_RESULT);
  const [targetString, setTargetStringState] = useState<number | null>(null);

  useEffect(() => {
    engine.onTunerUpdate = (res) => {
      // Create a shallow copy for React state update
      setTunerResult({ ...res });
    };

    return () => {
      engine.onTunerUpdate = undefined;
    };
  }, [engine]);

  const setTargetString = useCallback(
    (strNum: number | null) => {
      setTargetStringState(strNum);
      engine.getTunerEngine().setTargetString(strNum);
    },
    [engine]
  );

  return {
    tunerResult,
    targetString,
    setTargetString,
  };
}
