"use client";

import React, { useState } from "react";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { NoiseGateModal } from "@/components/tuner/noise-gate-modal";
import { Button } from "@/components/ui/button";
import { Volume2, Mic, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function CalibratePage() {
  const { engine, isRunning, start, stop } = useAudioEngine();
  const [modalOpen, setModalOpen] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleStartCalibration = async () => {
    if (!isRunning) {
      await start();
    }
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSavedSuccess(true);
    stop();
  };

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col justify-between">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Início
        </Link>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <Volume2 className="w-6 h-6 text-sky-400" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Calibração de Microfone & Ruído
            </h1>
            <p className="text-sm text-slate-400">
              Ajuste o Schmitt Trigger com histerese de 6 dB para filtrar o eco da sala
            </p>
          </div>
        </div>
      </div>

      <div className="my-auto py-8">
        <div className="p-8 rounded-3xl bg-slate-800/40 border border-slate-700/60 max-w-xl mx-auto flex flex-col items-center text-center space-y-6">
          <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center border border-slate-700">
            <Mic className="w-10 h-10 text-emerald-400" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Por que calibrar?</h2>
            <p className="text-sm text-slate-300 leading-relaxed max-w-md">
              Cada cômodo tem ruídos próprios (ventilador, tráfego, digitação). Em menos de 10 segundos,
              o EzViola memoriza o silêncio da sua sala e garante que o afinador só reaja às cordas do seu violão.
            </p>
          </div>

          {savedSuccess && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              <span>Limiar salvo com sucesso no navegador!</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-4 w-full">
            <Button
              size="lg"
              onClick={handleStartCalibration}
              className="gap-2 shadow-sky-500/20 bg-sky-600 hover:bg-sky-500"
            >
              <Volume2 className="w-5 h-5" />
              {isRunning ? "Abrir Wizard de Calibração" : "Iniciar Calibração de 3 Passos"}
            </Button>
          </div>
        </div>
      </div>

      <NoiseGateModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        engine={engine}
      />
    </div>
  );
}
