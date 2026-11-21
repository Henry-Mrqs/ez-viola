import Link from "next/link";
import { Sliders, Music, Volume2, Sparkles, CheckCircle2, Zap, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-between px-4 sm:px-6 py-10 max-w-6xl mx-auto w-full">
      {/* Hero Section */}
      <div className="text-center space-y-5 max-w-3xl my-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs sm:text-sm font-semibold">
          <Sparkles className="w-4 h-4" />
          <span>Detecção de Áudio 100% no Navegador • Sem Plugins</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
          Toque violão de verdade.{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 bg-clip-text text-transparent">
            Seu navegador escuta e guia.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
          O <strong>EzViola</strong> transforma seu microfone em um tutor inteligente: afine com precisão
          profissional de <strong>±5 cents</strong> e pratique com esteira visual interativa e o paciente{" "}
          <strong>Wait Mode</strong> que espera você acertar a posição dos dedos.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
          <Link href="/practice">
            <Button size="lg" className="gap-2 text-base shadow-emerald-500/25">
              <Music className="w-5 h-5" />
              Começar a Tocar Agora
            </Button>
          </Link>
          <Link href="/tuner">
            <Button variant="secondary" size="lg" className="gap-2 text-base">
              <Sliders className="w-5 h-5 text-emerald-400" />
              Abrir Afinador
            </Button>
          </Link>
        </div>
      </div>

      {/* 3 Core Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-12 mb-8">
        {/* Card 1: Afinador */}
        <Link
          href="/tuner"
          className="group p-6 rounded-2xl bg-slate-800/60 border border-slate-700/60 hover:border-emerald-500/40 hover:bg-slate-800/90 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Sliders className="w-6 h-6 text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Afinador Cromático</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Algoritmo YIN monofônico com agulha visual (-50 a +50c), anti-jitter EWMA e zona de precisão
              verde neon para as 6 cordas do violão (E2 a E4).
            </p>
          </div>
          <div className="mt-6 flex items-center text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
            Abrir Afinador →
          </div>
        </Link>

        {/* Card 2: Prática e Esteira */}
        <Link
          href="/practice"
          className="group p-6 rounded-2xl bg-slate-800/60 border border-slate-700/60 hover:border-emerald-500/40 hover:bg-slate-800/90 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Music className="w-6 h-6 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Esteira Yousician & Lições</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Esteira Canvas 2D a 60 FPS com 6 cordas coloridas, blocos de acordes, tokens de notas,
              velocidade ajustável (50%, 75%, 100%) e Wait Mode pedagógico.
            </p>
          </div>
          <div className="mt-6 flex items-center text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
            Ver Catálogo de Lições →
          </div>
        </Link>

        {/* Card 3: Calibração */}
        <Link
          href="/calibrate"
          className="group p-6 rounded-2xl bg-slate-800/60 border border-slate-700/60 hover:border-emerald-500/40 hover:bg-slate-800/90 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Volume2 className="w-6 h-6 text-sky-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Calibração de Ruído</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Wizard em 3 passos para medir o silêncio da sua sala e calibrar o Schmitt Trigger com
              histerese de 6 dB para eliminar ruído ambiente indesejado.
            </p>
          </div>
          <div className="mt-6 flex items-center text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
            Calibrar Microfone →
          </div>
        </Link>
      </div>

      {/* Highlights Bar */}
      <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs sm:text-sm text-slate-400 border-t border-slate-800/60 pt-6 w-full">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Privacidade Total (Zero Áudio Enviado)</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span>Zero Garbage Collection (60 FPS Custo Zero)</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-sky-400" />
          <span>Áudio Cristalino Sintetizado Sem MP3</span>
        </div>
      </div>
    </div>
  );
}
