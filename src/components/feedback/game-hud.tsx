"use client";

import React from "react";
import { SongSchema, TimelineEvent } from "@/songs/song-schema";
import { GameScoreState } from "@/hooks/useConveyorGame";
import { GuitarChordDiagram } from "@/components/chord-diagram/chord-diagram";
import { Zap, Flame, Sparkles } from "lucide-react";
import { clsx } from "clsx";

interface GameHudProps {
  song: SongSchema;
  scoreState: GameScoreState;
  currentTime: number;
  isWaiting: boolean;
  activeWaitEvent: TimelineEvent | null;
}

export function GameHud({
  song,
  scoreState,
  currentTime,
  isWaiting,
  activeWaitEvent,
}: GameHudProps) {
  const progressPct = Math.min(100, Math.floor((currentTime / song.durationSec) * 100));

  // Multiplier pill styling
  const mult = scoreState.multiplier;
  const isFever = scoreState.isFeverMode;

  const multiplierBadgeClass = isFever
    ? "bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white animate-pulse shadow-lg shadow-rose-900/40"
    : mult >= 2.0
    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
    : mult >= 1.5
    ? "bg-purple-500/20 text-purple-400 border border-purple-500/40"
    : "bg-slate-800 text-slate-400 border border-slate-700";

  const activeChordDef =
    isWaiting && activeWaitEvent?.chordId ? song.chordsUsed[activeWaitEvent.chordId] : null;

  return (
    <div className="relative w-full flex flex-col gap-2">
      {/* Top Progress Bar */}
      <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-150"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Main HUD Row */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-1">
        {/* Left: Song Info */}
        <div className="flex flex-col">
          <span className="font-bold text-sm sm:text-base text-white truncate max-w-[180px] sm:max-w-xs">
            {song.title}
          </span>
          <span className="text-xs text-slate-400 truncate max-w-[150px]">{song.artist}</span>
        </div>

        {/* Center: Combo & Multiplier */}
        <div className="flex items-center gap-2">
          {scoreState.combo > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-sm sm:text-lg font-black text-white">
                {scoreState.combo}
              </span>
              <span className="text-[10px] sm:text-xs text-emerald-400 font-bold uppercase tracking-wider">
                COMBO
              </span>
            </div>
          )}

          <div
            className={clsx(
              "px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1 transition-all",
              multiplierBadgeClass
            )}
          >
            {isFever ? <Flame className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
            <span>{mult.toFixed(1)}x</span>
          </div>
        </div>

        {/* Right: Score */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
            Pontuação
          </span>
          <span className="font-mono font-black text-lg sm:text-2xl text-emerald-400 tracking-tight">
            {scoreState.score.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Wait Mode Floating Overlay / Assistant */}
      {isWaiting && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 w-full max-w-sm px-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-slate-900/95 border-2 border-sky-400 rounded-3xl p-4 shadow-2xl backdrop-blur-md flex flex-col items-center text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-xs font-extrabold">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>WAIT MODE ATIVADO</span>
            </div>

            <p className="text-xs text-slate-300">
              Posicione seus dedos e toque{" "}
              <strong className="text-white text-sm">
                {activeChordDef?.displayName || activeWaitEvent?.chordId || "a nota"}
              </strong>{" "}
              no violão:
            </p>

            {/* Chord Diagram */}
            {activeChordDef && (
              <div className="p-2 bg-slate-950/80 rounded-2xl border border-slate-800">
                <GuitarChordDiagram
                  chord={activeChordDef}
                  width={140}
                  height={160}
                  showTitle={false}
                />
              </div>
            )}

            <span className="text-[11px] text-sky-400 font-semibold animate-pulse">
              A esteira retomará automaticamente ao detectar o som correto.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
