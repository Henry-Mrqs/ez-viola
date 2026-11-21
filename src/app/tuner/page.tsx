"use client";

import React, { useState } from "react";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useTuner } from "@/hooks/useTuner";
import { TunerGauge } from "@/components/canvas/tuner-gauge";
import { FrequencyDisplay } from "@/components/tuner/frequency-display";
import { StringSelector } from "@/components/tuner/string-selector";
import { NoiseGateModal } from "@/components/tuner/noise-gate-modal";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Sliders, Volume2, Sparkles, AlertCircle } from "lucide-react";

export default function TunerPage() {
  const { engine, isRunning, error, start, stop } = useAudioEngine();
  const { tunerResult, targetString, setTargetString } = useTuner(engine);
  const [calibrateModalOpen, setCalibrateModalOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col justify-between max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <Sliders className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white">Afinador Cromático</h1>
            <p className="text-xs text-slate-400">Precisão profissional de ±5 cents</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
            {/* Visual Arc Needle Gauge */}
            <TunerGauge
              cents={tunerResult.cents}
              inTune={tunerResult.inTune}
              isGateOpen={tunerResult.isGateOpen}
              hasPitch={tunerResult.frequency > 0}
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
    </div>
  );
}
