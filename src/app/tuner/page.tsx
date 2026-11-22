"use client";

import React, { useState } from "react";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useTuner } from "@/hooks/useTuner";
import { TunerGauge } from "@/components/canvas/tuner-gauge";
import { FrequencyDisplay } from "@/components/tuner/frequency-display";
import { StringSelector } from "@/components/tuner/string-selector";
import { NoiseGateModal } from "@/components/tuner/noise-gate-modal";
import { MicMonitor } from "@/components/tuner/mic-monitor";
import { GuitarCalibrationWizard } from "@/components/calibration/guitar-calibration-wizard";
import { Button } from "@/components/ui/button";
import {
  Mic,
  MicOff,
  Sliders,
  Volume2,
  Sparkles,
  AlertCircle,
  Activity,
  ChevronDown,
  ChevronUp,
  Disc,
} from "lucide-react";
import { clsx } from "clsx";

export default function TunerPage() {
  const {
    engine,
    isRunning,
    error,
    start,
    stop,
    isLoopback,
    loopbackVolume,
    toggleLoopback,
    setLoopbackVolume,
  } = useAudioEngine();

  const {
    tunerResult,
    targetString,
    setTargetString,
    guitarMode,
    setGuitarMode,
  } = useTuner(engine);

  const [calibrateModalOpen, setCalibrateModalOpen] = useState(false);
  const [guitarCalibrateOpen, setGuitarCalibrateOpen] = useState(false);
  const [showMonitor, setShowMonitor] = useState(false);

  return (
    <div className="flex-1 flex flex-col justify-between max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <Sliders className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white">Afinador</h1>
            <p className="text-xs text-slate-400">
              {guitarMode
                ? "Modo Violão Inteligente • ±5 cents"
                : "Modo Cromático Livre • ±5 cents"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Test / Monitor Microphone Panel Toggle */}
          <Button
            variant={showMonitor ? "secondary" : isLoopback ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowMonitor(!showMonitor)}
            className={clsx(
              "text-xs gap-1.5 transition-all",
              isLoopback
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30 ring-2 ring-emerald-500/30 animate-pulse"
                : showMonitor
                ? "bg-slate-700 text-white border-slate-600"
                : "text-slate-300 hover:text-white"
            )}
            title="Testar e Monitorar Microfone (Osciloscópio, VU meter e Retorno)"
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Testar / Monitorar Mic</span>
            {isLoopback && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-0.5" />
            )}
            {showMonitor ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!isRunning) {
                try {
                  await start();
                } catch {}
              }
              setGuitarCalibrateOpen(true);
            }}
            className="text-xs gap-1.5 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 px-2 sm:px-3"
            title="Calibrar cordas e acordes com o seu violão"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Calibrar Violão</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCalibrateModalOpen(true)}
            className="text-xs gap-1.5"
            title="Calibrar Ruído de Fundo"
          >
            <Volume2 className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">Calibrar Mic</span>
          </Button>

          {isRunning ? (
            <Button
              variant="danger"
              size="sm"
              onClick={stop}
              className="gap-1.5 text-xs"
            >
              <MicOff className="w-4 h-4" />
              Desligar
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={start}
              className="gap-1.5 text-xs shadow-emerald-500/20"
            >
              <Mic className="w-4 h-4" />
              Ligar Mic
            </Button>
          )}
        </div>
      </div>

      {/* Expandable Mic Monitor & Test Panel */}
      {showMonitor && (
        <div className="w-full my-4 animate-in fade-in slide-in-from-top-3 duration-300">
          <MicMonitor
            engine={engine}
            isRunning={isRunning}
            isLoopback={isLoopback}
            loopbackVolume={loopbackVolume}
            onToggleLoopback={toggleLoopback}
            onVolumeChange={setLoopbackVolume}
            onStartMic={start}
          />
        </div>
      )}

      {/* Mode Selector Toolbar */}
      <div className="flex flex-col items-center gap-1.5 w-full max-w-lg mx-auto pt-3">
        <div className="flex items-center p-1 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-inner w-full">
          <button
            type="button"
            onClick={() => setGuitarMode(true)}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all",
              guitarMode
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/40"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <span>Modo Violão Inteligente</span>
          </button>
          <button
            type="button"
            onClick={() => setGuitarMode(false)}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all",
              !guitarMode
                ? "bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-950/40"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Disc className="w-4 h-4 text-sky-300" />
            <span>Modo Cromático Livre</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-400 text-center">
          {guitarMode
            ? "Filtro harmônico anti-pulos de oitava, atração para as 6 cordas E2..E4 e estabilizador de palheta."
            : "Afinação cromática livre sem restrições para qualquer nota ou instrumento."}
        </p>
      </div>

      {/* Main Tuner Area */}
      <div className="flex-1 flex flex-col items-center justify-center py-4 my-auto space-y-4">
        {error && (
          <div className="w-full max-w-md p-4 rounded-2xl bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs sm:text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {!isRunning && !error && (
          <div className="text-center py-6 space-y-4">
            <div className="inline-flex p-4 rounded-2xl bg-slate-800/80 border border-slate-700">
              <Mic className="w-10 h-10 text-emerald-400 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">Microfone Desconectado</h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xs mx-auto">
                Clique abaixo para permitir o microfone e iniciar a afinação em tempo real.
              </p>
            </div>
            <Button size="lg" onClick={start} className="gap-2 shadow-emerald-500/30">
              <Sparkles className="w-5 h-5" />
              Iniciar Afinador
            </Button>
          </div>
        )}

        {isRunning && (
          <div className="w-full flex flex-col items-center space-y-4 animate-in fade-in duration-300">
            {/* Visual Arc Needle Gauge with String Lock Badge */}
            <TunerGauge
              cents={tunerResult.cents}
              inTune={tunerResult.inTune}
              isGateOpen={tunerResult.isGateOpen}
              hasPitch={tunerResult.frequency > 0}
              stringIndex={tunerResult.stringIndex}
              noteName={tunerResult.noteName}
              octave={tunerResult.octave}
              frequency={tunerResult.smoothedFrequency}
              targetFrequency={tunerResult.targetFrequency}
            />

            {/* Note & Numerical Values */}
            <FrequencyDisplay result={tunerResult} isRunning={isRunning} />
          </div>
        )}
      </div>

      {/* String Selector Toolbar */}
      <div className="w-full pt-4 border-t border-slate-800/80">
        <StringSelector
          selectedString={targetString}
          onSelectString={setTargetString}
          detectedStringIndex={tunerResult.stringIndex}
        />
      </div>

      <NoiseGateModal
        isOpen={calibrateModalOpen}
        onClose={() => setCalibrateModalOpen(false)}
        engine={engine}
      />

      <GuitarCalibrationWizard
        isOpen={guitarCalibrateOpen}
        onClose={() => setGuitarCalibrateOpen(false)}
        engine={engine}
      />
    </div>
  );
}
