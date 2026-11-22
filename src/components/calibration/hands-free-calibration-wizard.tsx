"use client";

import React, { useEffect, useState } from "react";
import {
  HandsFreeCalibrationEngine,
  HandsFreeCalibrationProgress,
} from "@/audio/hands-free-calibration-engine";
import { AnimatedFretboardGuide } from "@/components/guitar/animated-fretboard-guide";
import { clsx } from "clsx";

export interface HandsFreeCalibrationWizardProps {
  engine: HandsFreeCalibrationEngine;
  onComplete?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function HandsFreeCalibrationWizard({
  engine,
  onComplete,
  onCancel,
  className,
}: HandsFreeCalibrationWizardProps) {
  const [progress, setProgress] = useState<HandsFreeCalibrationProgress>(() =>
    engine.getState()
  );

  useEffect(() => {
    const unsubscribe = engine.subscribe((p) => {
      setProgress({ ...p });
    });
    return () => {
      unsubscribe();
    };
  }, [engine]);

  const {
    state,
    currentTarget,
    targetIndex,
    totalTargets,
    currentPluckCount,
    inactivityWarning,
    inactivityMessage,
    feedbackMessage,
    autoAdvanceCountdownMs,
    outlierRejected,
  } = progress;

  const isComplete = state === "CALIBRATION_DONE";
  const isAutoAdvancing = state === "AUTO_ADVANCING";

  return (
    <div
      data-testid="hands-free-calibration-wizard"
      className={clsx(
        "flex flex-col items-center justify-between p-6 sm:p-8 rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl max-w-xl w-full mx-auto text-slate-100 min-h-[500px]",
        className
      )}
    >
      {/* Top Header: Step Indicator & Target Tracker */}
      <div className="w-full flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Calibração Mãos Livres (Zero Cliques)
          </span>
        </div>
        <div className="text-xs font-mono font-bold text-slate-400">
          Etapa {Math.min(targetIndex + 1, totalTargets || 6)} de {totalTargets || 6}
        </div>
      </div>

      {/* Main 2-Meter Readability Body */}
      <div className="w-full flex-1 flex flex-col items-center justify-center my-6 text-center">
        {isComplete ? (
          <div className="flex flex-col items-center space-y-4 animate-in zoom-in duration-300">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-4xl text-emerald-400 shadow-lg shadow-emerald-950/60">
              ✓
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-100">
              Violão Calibrado!
            </h2>
            <p className="text-slate-300 max-w-md text-sm sm:text-base">
              A resposta acústica do seu instrumento e microfone foi gravada com sucesso. O afinador e os acordes agora operam com máxima precisão.
            </p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center space-y-5">
            {/* Current Target String or Chord Guide */}
            {currentTarget && (
              <div className="flex flex-col items-center w-full">
                {currentTarget.type === "chord" && currentTarget.chordId ? (
                  <div className="w-full max-w-sm mb-2">
                    <AnimatedFretboardGuide
                      chordId={currentTarget.chordId}
                      className="w-full bg-slate-900/90 shadow-xl"
                    />
                  </div>
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-900 border-4 border-sky-500/50 flex flex-col items-center justify-center shadow-xl shadow-sky-950/40 animate-in fade-in">
                    <span className="text-3xl sm:text-4xl font-black text-sky-400 font-mono">
                      {currentTarget.name}
                    </span>
                    {currentTarget.targetFrequency && (
                      <span className="text-[11px] font-mono text-slate-400">
                        {currentTarget.targetFrequency.toFixed(1)} Hz
                      </span>
                    )}
                  </div>
                )}

                <h2 className="text-2xl sm:text-3xl font-black mt-3 text-slate-100 text-center">
                  {currentTarget.displayName}
                </h2>
              </div>
            )}

            {/* Inactivity Pedagogical Nudge */}
            {inactivityWarning && (
              <div
                data-testid="inactivity-warning"
                className="w-full p-4 rounded-2xl bg-amber-500/20 border-2 border-amber-500 text-amber-200 text-sm font-bold text-center animate-bounce shadow-lg"
              >
                ⚠️ {inactivityMessage}
              </div>
            )}

            {/* Outlier Alert Notification */}
            {outlierRejected && (
              <div
                data-testid="outlier-alert"
                className="w-full p-3 rounded-xl bg-orange-500/20 border border-orange-500/50 text-orange-300 text-xs font-semibold text-center animate-shake"
              >
                ⚠️ Toque com força excessiva ou desafinado descartado. Dê mais 1 toque firme!
              </div>
            )}

            {/* Feedback Message (2-meter font) */}
            <p
              data-testid="wizard-feedback-message"
              className={clsx(
                "text-base sm:text-xl font-bold max-w-md transition-colors",
                isAutoAdvancing ? "text-emerald-400 font-black" : "text-slate-300"
              )}
            >
              {feedbackMessage}
            </p>

            {/* Multisensory 3-Pluck Counter */}
            <div className="w-full max-w-sm pt-2">
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((step) => {
                  const isChecked = currentPluckCount >= step;
                  const isCurrent = currentPluckCount === step - 1;

                  return (
                    <div
                      key={`pluck-step-${step}`}
                      data-testid={`pluck-counter-${step}`}
                      className={clsx(
                        "py-3 px-2 rounded-2xl border text-center flex flex-col items-center justify-center transition-all duration-300",
                        isChecked
                          ? step === 3
                            ? "bg-emerald-500/25 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950"
                            : "bg-lime-500/20 border-lime-500 text-lime-300 shadow-md shadow-lime-950"
                          : isCurrent
                          ? "bg-slate-800 border-sky-400 text-sky-300 animate-pulse"
                          : "bg-slate-900/60 border-slate-800 text-slate-600"
                      )}
                    >
                      <span className="text-xs uppercase font-extrabold tracking-wider">
                        Toque
                      </span>
                      <span className="text-xl sm:text-2xl font-black font-mono">
                        {step}/3
                      </span>
                      <span className="text-[10px] mt-0.5">
                        {isChecked ? "✓ Pronto" : isCurrent ? "● Aguardando" : "○ Fila"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Auto-Advance Countdown Bar */}
              {isAutoAdvancing && (
                <div className="mt-4 w-full flex flex-col items-center animate-in fade-in">
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-100 ease-linear"
                      style={{
                        width: `${Math.max(0, (1200 - autoAdvanceCountdownMs) / 12)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-emerald-300 font-bold mt-1.5 font-mono">
                    Próxima corda em {(autoAdvanceCountdownMs / 1000).toFixed(1)}s...
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tactile Manual Escape Controls Footer */}
      <div className="w-full pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        {isComplete ? (
          <button
            onClick={onComplete}
            data-testid="wizard-finish-button"
            className="w-full py-3 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm transition-all shadow-lg shadow-emerald-950"
          >
            Concluir e Começar a Tocar
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button
                onClick={() => engine.retryCurrentStep()}
                data-testid="wizard-retry-button"
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-colors"
                title="Reinicia as amostras da corda atual"
              >
                ↺ Refazer corda
              </button>

              <button
                onClick={() => engine.skipCurrentStep()}
                data-testid="wizard-skip-button"
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-semibold border border-slate-700 transition-colors"
                title="Avança para a próxima corda"
              >
                Pular corda →
              </button>
            </div>

            <button
              onClick={() => {
                engine.stopWizard();
                onCancel?.();
              }}
              data-testid="wizard-cancel-button"
              className="px-3 py-2 rounded-xl text-slate-500 hover:text-slate-300 text-xs font-medium transition-colors"
            >
              Encerrar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
