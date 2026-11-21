"use client";

import React from "react";
import { Gauge, Volume2, VolumeX, Pause, Play, RotateCcw } from "lucide-react";
import { clsx } from "clsx";

interface SpeedControlsProps {
  speed: number;
  onSetSpeed: (speed: number) => void;
  enableMetronome: boolean;
  onToggleMetronome: () => void;
  isPlaying: boolean;
  isPaused: boolean;
  onTogglePause: () => void;
  onRestart: () => void;
  enableWaitMode: boolean;
  onToggleWaitMode: () => void;
}

export function SpeedControls({
  speed,
  onSetSpeed,
  enableMetronome,
  onToggleMetronome,
  isPlaying,
  isPaused,
  onTogglePause,
  onRestart,
  enableWaitMode,
  onToggleWaitMode,
}: SpeedControlsProps) {
  const speedOptions = [
    { label: "50%", value: 0.5, desc: "Lento" },
    { label: "75%", value: 0.75, desc: "Estudo" },
    { label: "100%", value: 1.0, desc: "Normal" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/95 border border-slate-800 rounded-2xl w-full">
      {/* Playback Controls */}
      <div className="flex items-center gap-2">
        {isPlaying && (
          <button
            onClick={onTogglePause}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 flex items-center gap-1.5 text-xs font-semibold"
            title={isPaused ? "Continuar" : "Pausar"}
          >
            {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4" />}
            <span className="hidden sm:inline">{isPaused ? "Continuar" : "Pausar"}</span>
          </button>
        )}

        <button
          onClick={onRestart}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 text-xs font-semibold"
          title="Reiniciar Música"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="hidden sm:inline">Reiniciar</span>
        </button>
      </div>

      {/* Speed Multiplier Pill Buttons */}
      <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
        <div className="flex items-center gap-1 px-2 text-slate-400 text-xs font-medium">
          <Gauge className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Velocidade:</span>
        </div>

        {speedOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSetSpeed(opt.value)}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              speed === opt.value
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-950"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Toggles: Wait Mode & Metronome */}
      <div className="flex items-center gap-2">
        {/* Wait Mode Toggle */}
        <button
          onClick={onToggleWaitMode}
          className={clsx(
            "px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
            enableWaitMode
              ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
              : "bg-slate-800/80 text-slate-400 border-slate-700"
          )}
          title="Wait Mode pausa a esteira até você posicionar e tocar o acorde correto"
        >
          <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
          Wait Mode {enableWaitMode ? "ON" : "OFF"}
        </button>

        {/* Metronome Toggle */}
        <button
          onClick={onToggleMetronome}
          className={clsx(
            "p-2.5 rounded-xl border transition-all",
            enableMetronome
              ? "bg-slate-800 text-emerald-400 border-emerald-500/40"
              : "bg-slate-800/60 text-slate-500 border-slate-700"
          )}
          title={enableMetronome ? "Desativar Metrônomo" : "Ativar Metrônomo"}
        >
          {enableMetronome ? (
            <Volume2 className="w-4 h-4" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
