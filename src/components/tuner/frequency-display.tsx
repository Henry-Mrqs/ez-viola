"use client";

import React from "react";
import { TunerResult } from "@/audio/types";
import { CheckCircle2, ArrowUp, ArrowDown, Mic } from "lucide-react";
import { clsx } from "clsx";

interface FrequencyDisplayProps {
  result: TunerResult;
  isRunning: boolean;
}

export function FrequencyDisplay({ result, isRunning }: FrequencyDisplayProps) {
  const hasPitch = isRunning && result.isGateOpen && result.frequency > 0;
  const inTune = hasPitch && result.inTune;

  // Beginner instruction
  let instructionText = "Toque uma corda no seu violão...";
  let instructionColor = "text-slate-400";
  let InstructionIcon = Mic;

  if (hasPitch) {
    if (inTune) {
      instructionText = "Afinado!";
      instructionColor = "text-emerald-400";
      InstructionIcon = CheckCircle2;
    } else if (result.cents < -5) {
      instructionText = "Aperte a corda (muito frouxa)";
      instructionColor = "text-sky-400";
      InstructionIcon = ArrowUp;
    } else {
      instructionText = "Afrouxe a corda (muito apertada)";
      instructionColor = "text-amber-400";
      InstructionIcon = ArrowDown;
    }
  }

  return (
    <div className="flex flex-col items-center justify-center text-center space-y-3 py-2">
      {/* Big Note Badge */}
      <div className="relative inline-flex items-baseline justify-center">
        <span
          className={clsx(
            "text-7xl sm:text-8xl font-black tracking-tighter transition-colors duration-150",
            inTune
              ? "text-emerald-400 drop-shadow-[0_0_24px_rgba(34,197,94,0.4)]"
              : hasPitch
              ? "text-white"
              : "text-slate-600"
          )}
        >
          {hasPitch ? result.noteName : "-"}
        </span>
        {hasPitch && (
          <span className="text-2xl sm:text-3xl font-bold text-slate-400 ml-1">
            {result.octave}
          </span>
        )}
      </div>

      {/* Target & Measured Frequency */}
      <div className="flex items-center gap-4 text-xs sm:text-sm font-mono text-slate-300 bg-slate-800/80 px-4 py-1.5 rounded-full border border-slate-700/80">
        <div>
          <span className="text-slate-500">Freq: </span>
          <span className="font-bold text-white">
            {hasPitch ? `${result.smoothedFrequency.toFixed(1)} Hz` : "--- Hz"}
          </span>
        </div>
        <div className="w-1 h-3 bg-slate-700 rounded-full" />
        <div>
          <span className="text-slate-500">Alvo: </span>
          <span className="font-bold text-slate-300">
            {hasPitch ? `${result.targetFrequency.toFixed(1)} Hz` : "--- Hz"}
          </span>
        </div>
        <div className="w-1 h-3 bg-slate-700 rounded-full" />
        <div>
          <span className="text-slate-500">Cents: </span>
          <span
            className={clsx(
              "font-bold",
              inTune
                ? "text-emerald-400"
                : Math.abs(result.cents) > 15
                ? "text-rose-400"
                : "text-amber-400"
            )}
          >
            {hasPitch
              ? `${result.cents > 0 ? "+" : ""}${result.cents.toFixed(1)}`
              : "0.0"}
          </span>
        </div>
      </div>

      {/* Action Guidance Message */}
      <div
        className={clsx(
          "inline-flex items-center gap-2 text-sm sm:text-base font-semibold transition-colors duration-150",
          instructionColor
        )}
      >
        <InstructionIcon className="w-5 h-5 animate-bounce" />
        <span>{instructionText}</span>
      </div>
    </div>
  );
}
