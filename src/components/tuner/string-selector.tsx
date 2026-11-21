"use client";

import React from "react";
import { GUITAR_STRINGS } from "@/audio/types";
import { clsx } from "clsx";

interface StringSelectorProps {
  selectedString: number | null; // stringNumber 6..1 or null for Auto
  onSelectString: (stringNumber: number | null) => void;
  detectedStringIndex: number; // 0..5 index into GUITAR_STRINGS
}

export function StringSelector({
  selectedString,
  onSelectString,
  detectedStringIndex,
}: StringSelectorProps) {
  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
        {/* Auto Chromatic Button */}
        <button
          onClick={() => onSelectString(null)}
          className={clsx(
            "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all",
            selectedString === null
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-500 scale-105"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
          )}
        >
          Auto
        </button>

        {/* 6 Guitar Strings: 6 (E2) down to 1 (E4) */}
        {GUITAR_STRINGS.map((str, index) => {
          const isSelected = selectedString === str.stringNumber;
          const isDetected = detectedStringIndex === index;

          return (
            <button
              key={str.stringNumber}
              onClick={() => onSelectString(str.stringNumber)}
              className={clsx(
                "relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl font-black text-sm flex flex-col items-center justify-center transition-all duration-150 focus:outline-none",
                isSelected
                  ? "ring-2 ring-white scale-110 shadow-lg text-white"
                  : "bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700",
                isDetected && !isSelected && "animate-pulse border-emerald-400 text-emerald-400"
              )}
              style={{
                backgroundColor: isSelected ? str.color : undefined,
              }}
              title={`Corda ${str.stringNumber}: ${str.name} (${str.targetFrequency} Hz)`}
            >
              <span className="text-xs leading-none font-extrabold">{str.name}</span>
              <span className="text-[10px] font-normal opacity-75 leading-none mt-0.5">
                {str.stringNumber}ª
              </span>

              {/* Pulsing glow dot if detected */}
              {isDetected && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
