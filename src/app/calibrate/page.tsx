"use client";

import React, { useState, useEffect } from "react";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { NoiseGateModal } from "@/components/tuner/noise-gate-modal";
import { HandsFreeCalibrationWizard } from "@/components/calibration/hands-free-calibration-wizard";
import { HandsFreeCalibrationEngine } from "@/audio/hands-free-calibration-engine";
import { Button } from "@/components/ui/button";
import { Volume2, Mic, ArrowLeft, CheckCircle2, Sparkles, Music } from "lucide-react";
import Link from "next/link";

export default function CalibratePage() {
  const { engine, isRunning, start } = useAudioEngine();
  const [noiseGateModalOpen, setNoiseGateModalOpen] = useState(false);
  const [handsFreeEngine, setHandsFreeEngine] = useState<HandsFreeCalibrationEngine | null>(null);
  const [handsFreeWizardOpen, setHandsFreeWizardOpen] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleStartNoiseGate = async () => {
    if (!isRunning) {
      try {
        await start();
      } catch {}
    }
    setNoiseGateModalOpen(true);
  };

  const handleStartHandsFreeWizard = async () => {
    // 1. Ensure AudioContext is started inside synchronous click handler for iOS/Safari autoplay
    if (!isRunning) {
      try {
        await start();
      } catch (e) {
        console.error("Failed to start AudioEngine on user gesture:", e);
      }
    }

    // 2. Instantiate and attach hands-free engine
    const hf = new HandsFreeCalibrationEngine(engine);
    engine.onFrame = (deltaMs: number) => {
      hf.onFrame(deltaMs);
    };

    setHandsFreeEngine(hf);
    setHandsFreeWizardOpen(true);
    hf.startWizard();
  };

  const handleCloseHandsFreeWizard = () => {
    if (handsFreeEngine) {
      handsFreeEngine.stopWizard();
    }
    engine.onFrame = undefined;
    setHandsFreeWizardOpen(false);
    setHandsFreeEngine(null);
    setSavedSuccess(true);
  };

  const handleNoiseGateClose = () => {
    setNoiseGateModalOpen(false);
    setSavedSuccess(true);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      engine.onFrame = undefined;
    };
  }, [engine]);

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col justify-between">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Início
        </Link>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Central de Calibração Acústica
            </h1>
            <p className="text-sm text-slate-400">
              Adapte o EzViola ao som do seu violão e ao microfone do seu ambiente com calibração mãos livres
            </p>
          </div>
        </div>
      </div>

      <div className="my-auto py-6">
        {handsFreeWizardOpen && handsFreeEngine ? (
          <div className="w-full flex justify-center animate-in fade-in zoom-in duration-300">
            <HandsFreeCalibrationWizard
              engine={handsFreeEngine}
              onComplete={handleCloseHandsFreeWizard}
              onCancel={handleCloseHandsFreeWizard}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Card 1: Calibração Mãos Livres (Zero Cliques) */}
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-800/50 border border-slate-700/80 flex flex-col justify-between space-y-6 hover:border-emerald-500/40 transition-colors">
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Music className="w-7 h-7 text-emerald-400" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">
                    Regra Mãos Livres • Zero Cliques
                  </span>
                  <h2 className="text-xl font-bold text-white">
                    Calibração Hands-Free do Violão
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Você não precisa largar o violão para tocar na tela. Toque <strong>3 vezes cada corda</strong>; o EzViola detecta o ataque, descarta ruídos espúrios e avança sozinho em 1200ms.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Elimina saltos de oitava na 6ª corda (E2)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sky-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Rejeição de outliers estatísticos e ruídos de manuseio</span>
                  </div>
                </div>
              </div>

              <Button
                size="lg"
                onClick={handleStartHandsFreeWizard}
                className="gap-2 shadow-emerald-500/20 w-full"
              >
                <Sparkles className="w-5 h-5" />
                <span>Iniciar Calibração Mãos Livres</span>
              </Button>
            </div>

            {/* Card 2: Calibração de Ruído de Fundo (Noise Gate) */}
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-800/50 border border-slate-700/80 flex flex-col justify-between space-y-6 hover:border-sky-500/40 transition-colors">
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                  <Volume2 className="w-7 h-7 text-sky-400" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-sky-400 uppercase tracking-widest">
                    Filtro de Eco & Ruído
                  </span>
                  <h2 className="text-xl font-bold text-white">
                    Limiar de Silêncio (Schmitt Trigger)
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Em menos de 10 segundos, o app mede o ruído ambiente da sua sala (ventilador, digitação, tráfego) e calibra o Noise Gate com histerese de 6 dB para eliminar falsos positivos.
                  </p>
                </div>

                {savedSuccess && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Calibração salva com sucesso no navegador!</span>
                  </div>
                )}
              </div>

              <Button
                variant="secondary"
                size="lg"
                onClick={handleStartNoiseGate}
                className="gap-2 w-full border-slate-600 hover:border-slate-500"
              >
                <Mic className="w-5 h-5 text-sky-400" />
                <span>Calibrar Ruído Ambiente</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      <NoiseGateModal
        isOpen={noiseGateModalOpen}
        onClose={handleNoiseGateClose}
        engine={engine}
      />
    </div>
  );
}
