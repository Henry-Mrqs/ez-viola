"use client";

import React, { useState, useEffect, useRef } from "react";
import { AudioEngine } from "@/audio/audio-engine";
import { Button } from "@/components/ui/button";
import { Check, Mic, Music, Volume2, X } from "lucide-react";

interface NoiseGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: AudioEngine;
}

export function NoiseGateModal({ isOpen, onClose, engine }: NoiseGateModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [progress, setProgress] = useState(0);
  const [floorRms, setFloorRms] = useState(0.005);
  const [peakRms, setPeakRms] = useState(0.08);
  const [thresholdOpen, setThresholdOpen] = useState(0.02);
  const [currentRms, setCurrentRms] = useState(0);

  const samplesRef = useRef<number[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor real-time RMS
  useEffect(() => {
    if (!isOpen) return;

    let animId: number;
    const checkRms = () => {
      const gate = engine.getTunerEngine().getNoiseGate();
      const rms = gate.getLastRms();
      setCurrentRms(rms);
      animId = requestAnimationFrame(checkRms);
    };

    animId = requestAnimationFrame(checkRms);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, engine]);

  // Step 1: Record 3 seconds of room silence
  const startStep1 = () => {
    setStep(1);
    setProgress(0);
    samplesRef.current = [];

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.floor((elapsed / 3000) * 100));
      setProgress(pct);

      const rms = engine.getTunerEngine().getNoiseGate().getLastRms();
      if (rms > 0) samplesRef.current.push(rms);

      if (elapsed >= 3000) {
        clearInterval(interval);
        // Calculate average room floor RMS
        const avg =
          samplesRef.current.length > 0
            ? samplesRef.current.reduce((a, b) => a + b, 0) / samplesRef.current.length
            : 0.008;
        setFloorRms(avg);
        setStep(2);
      }
    }, 50);

    timerRef.current = interval;
  };

  // Step 2: Record peak guitar strum
  const startStep2 = () => {
    setProgress(0);
    samplesRef.current = [];

    const startTime = Date.now();
    let maxRms = 0;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.floor((elapsed / 3000) * 100));
      setProgress(pct);

      const rms = engine.getTunerEngine().getNoiseGate().getLastRms();
      if (rms > maxRms) maxRms = rms;

      if (elapsed >= 3000) {
        clearInterval(interval);
        const resolvedPeak = Math.max(maxRms, floorRms + 0.03);
        setPeakRms(resolvedPeak);

        // Calculate formula: Threshold_Open = N_floor + 0.35 * (S_peak - N_floor)
        const calculatedThresh = floorRms + 0.35 * (resolvedPeak - floorRms);
        const finalThresh = Math.max(0.005, Math.min(0.1, calculatedThresh));
        setThresholdOpen(finalThresh);
        engine.getTunerEngine().getNoiseGate().setThreshold(finalThresh);
        setStep(3);
      }
    }, 50);

    timerRef.current = interval;
  };

  const handleSaveAndClose = () => {
    try {
      localStorage.setItem("ezviola_noisegate_thresh", thresholdOpen.toString());
    } catch {}
    engine.getTunerEngine().getNoiseGate().setThreshold(thresholdOpen);
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      startStep1();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <Volume2 className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Calibração de Ruído Ambiente</h3>
              <p className="text-xs text-slate-400">Passo {step} de 3</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Steps */}
        {step === 1 && (
          <div className="flex flex-col items-center text-center space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-sky-500 flex items-center justify-center animate-pulse">
              <Mic className="w-8 h-8 text-sky-400" />
            </div>
            <h4 className="text-xl font-bold text-white">Fique em silêncio por 3 segundos...</h4>
            <p className="text-sm text-slate-400 max-w-sm">
              Estamos medindo o nível de ruído de fundo da sua sala (ventiladores, eco, respiração) para eliminá-lo.
            </p>
            <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden mt-2">
              <div
                className="bg-sky-500 h-full transition-all duration-75"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col items-center text-center space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-emerald-500 flex items-center justify-center animate-bounce">
              <Music className="w-8 h-8 text-emerald-400" />
            </div>
            <h4 className="text-xl font-bold text-white">Toque um acorde forte no seu violão!</h4>
            <p className="text-sm text-slate-400 max-w-sm">
              Dedilhe ou toque com firmeza para que possamos detectar a intensidade do seu instrumento.
            </p>
            <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden mt-2">
              <div
                className="bg-emerald-500 h-full transition-all duration-75"
                style={{ width: `${progress}%` }}
              />
            </div>
            <Button onClick={startStep2} variant="secondary" size="sm">
              Iniciar Captura de Acorde
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col space-y-5 py-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <Check className="w-4 h-4" />
                <span>Calibração concluída!</span>
              </div>
              <span className="font-mono">Pico violão: {(peakRms * 100).toFixed(1)}%</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>VU Meter em Tempo Real:</span>
                <span className="font-mono text-white">
                  RMS: {(currentRms * 100).toFixed(1)}% | Limiar: {(thresholdOpen * 100).toFixed(1)}%
                </span>
              </div>

              {/* VU Meter Bar */}
              <div className="relative w-full h-8 bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                {/* Gate Cut Zone (Red/Gray) */}
                <div
                  className="absolute top-0 bottom-0 left-0 bg-rose-950/40 border-r-2 border-rose-500/80"
                  style={{ width: `${Math.min(100, thresholdOpen * 500)}%` }}
                />
                {/* Signal Bar */}
                <div
                  className={`h-full transition-all duration-75 ${
                    currentRms >= thresholdOpen ? "bg-emerald-500" : "bg-slate-600"
                  }`}
                  style={{ width: `${Math.min(100, currentRms * 500)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 px-1">
                <span>Ruído Bloqueado</span>
                <span>Sinal do Violão Aceito</span>
              </div>
            </div>

            {/* Threshold Slider */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Ajuste Fino do Limiar:</span>
                <span className="font-mono text-emerald-400">{thresholdOpen.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.005"
                max="0.08"
                step="0.002"
                value={thresholdOpen}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setThresholdOpen(val);
                  engine.getTunerEngine().getNoiseGate().setThreshold(val);
                }}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Button variant="ghost" onClick={startStep1}>
                Recalibrar
              </Button>
              <Button onClick={handleSaveAndClose}>Salvar e Concluir</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
