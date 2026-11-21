"use client";

import React from "react";
import { GameScoreState } from "@/hooks/useConveyorGame";
import { Button } from "@/components/ui/button";
import { Star, Trophy, RotateCcw, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";

interface ResultsModalProps {
  isOpen: boolean;
  scoreState: GameScoreState;
  onPlayAgain: () => void;
  nextSongId?: string;
}

export function ResultsModal({
  isOpen,
  scoreState,
  onPlayAgain,
  nextSongId,
}: ResultsModalProps) {
  if (!isOpen) return null;

  const stars = scoreState.stars;
  const isGreat = stars >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center space-y-6">
        {/* Celebration Trophy Icon */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Trophy className="w-8 h-8 text-amber-400" />
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            {isGreat ? "Lição Concluída!" : "Bom Treino!"}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            {stars === 3
              ? "Performance perfeita! Dedos afiados no tempo certo."
              : stars === 2
              ? "Excelente progresso! Continue praticando para atingir 3 estrelas."
              : stars === 1
              ? "Bom começo! Tente praticar no modo lento (50% ou 75%) para fixar os acordes."
              : "Continue tentando! Ative o Wait Mode para dominar as posições."}
          </p>
        </div>

        {/* Stars */}
        <div className="flex items-center justify-center gap-3 py-2">
          {[1, 2, 3].map((starIdx) => (
            <Star
              key={starIdx}
              className={clsx(
                "w-10 h-10 transition-transform duration-300",
                starIdx <= stars
                  ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)] scale-110"
                  : "fill-slate-800 text-slate-700"
              )}
            />
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 w-full">
          <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Pontuação
            </span>
            <span className="text-xl font-black text-white font-mono">
              {scoreState.score.toLocaleString()}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Precisão
            </span>
            <span className="text-xl font-black text-emerald-400 font-mono">
              {scoreState.accuracy}%
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Maior Combo
            </span>
            <span className="text-xl font-black text-sky-400 font-mono">
              {scoreState.maxCombo}x
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Acertos
            </span>
            <span className="text-xs font-mono font-semibold text-slate-300">
              <span className="text-emerald-400">{scoreState.perfectCount}P</span> /{" "}
              <span className="text-amber-400">{scoreState.goodCount}G</span> /{" "}
              <span className="text-rose-400">{scoreState.missCount}M</span>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full pt-2">
          <Button
            variant="secondary"
            size="md"
            onClick={onPlayAgain}
            className="w-full gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Tocar Novamente
          </Button>

          {nextSongId ? (
            <Link href={`/practice/${nextSongId}`} className="w-full">
              <Button size="md" className="w-full gap-2 shadow-emerald-500/20">
                Próxima Lição
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          ) : (
            <Link href="/practice" className="w-full">
              <Button size="md" className="w-full gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Ver Lições
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
