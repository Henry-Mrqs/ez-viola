"use client";

import React, { useState, useEffect, useRef } from "react";
import { AudioEngine } from "@/audio/audio-engine";
import { TunerResult } from "@/audio/types";
import { Activity, Pause, Play, Copy, Check, Info } from "lucide-react";
import { clsx } from "clsx";

interface LiveTelemetryPanelProps {
  engine: AudioEngine;
  tunerResult?: TunerResult;
  className?: string;
}

export function LiveTelemetryPanel({
  engine,
  tunerResult,
  className,
}: LiveTelemetryPanelProps) {
  const [isFrozen, setIsFrozen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logHistory, setLogHistory] = useState<
    {
      time: string;
      freq: number;
      note: string;
      cents: number;
      rmsDb: number;
      clarity: number;
      status: string;
    }[]
  >([]);

  const frozenDataRef = useRef<{
    freq: number;
    note: string;
    cents: number;
    rmsDb: number;
    clarity: number;
    status: string;
  } | null>(null);

  // Keep a running buffer of recent acoustic detections
  useEffect(() => {
    if (isFrozen || !tunerResult) return;

    const rms = tunerResult.rms || 0;
    const rmsDb = rms > 1e-5 ? 20 * Math.log10(rms) : -100;
    const freq = tunerResult.smoothedFrequency > 0 ? tunerResult.smoothedFrequency : tunerResult.frequency;
    const note = tunerResult.noteName && tunerResult.noteName !== "-" ? `${tunerResult.noteName}${tunerResult.octave}` : "-";
    const clarity = Math.round((tunerResult.clarity || 0) * 100);

    let status = "Sinal Silencioso";
    if (!tunerResult.isGateOpen) {
      status = "Abaixo do Noise Gate";
    } else if (freq <= 0) {
      status = "Inarmônico / Ruído";
    } else if (clarity < 70) {
      status = "Clareza Baixa";
    } else if (tunerResult.inTune) {
      status = "Afinado (±5 cents)";
    } else {
      status = `Ativo (${tunerResult.tuningAction === "TIGHTEN" ? "Aperte" : "Afrouxe"})`;
    }

    const currentEntry = {
      time: new Date().toLocaleTimeString(),
      freq: Math.round(freq * 10) / 10,
      note,
      cents: Math.round(tunerResult.cents * 10) / 10,
      rmsDb: Math.round(rmsDb * 10) / 10,
      clarity,
      status,
    };

    frozenDataRef.current = currentEntry;

    if (tunerResult.isGateOpen && freq > 0) {
      setLogHistory((prev) => [currentEntry, ...prev.slice(0, 7)]);
    }
  }, [tunerResult, isFrozen]);

  const handleCopyLogs = () => {
    const summary = {
      timestamp: new Date().toISOString(),
      sampleRate: engine.getSampleRate(),
      currentLive: frozenDataRef.current,
      recentSamples: logHistory,
    };
    navigator.clipboard.writeText(JSON.stringify(summary, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const current = frozenDataRef.current || {
    freq: 0,
    note: "-",
    cents: 0,
    rmsDb: -100,
    clarity: 0,
    status: "Aguardando sinal...",
  };

  return (
    <div
      data-testid="live-telemetry-panel"
      className={clsx(
        "p-4 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-2xl text-slate-200 text-xs font-mono w-full",
        className
      )}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-bold text-slate-100 font-sans text-sm">
            Telemetria de Microfone Ao Vivo
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400">
            {engine.getSampleRate()} Hz
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFrozen(!isFrozen)}
            className={clsx(
              "px-2.5 py-1 rounded-lg border flex items-center gap-1 text-[11px] font-sans font-semibold transition-colors",
              isFrozen
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
            )}
            title="Congela a leitura para inspeção"
          >
            {isFrozen ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            <span>{isFrozen ? "Descongelar" : "Congelar"}</span>
          </button>

          <button
            onClick={handleCopyLogs}
            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 text-[11px] font-sans font-bold transition-all shadow"
            title="Copiar relatório de telemetria"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? "Copiado!" : "Copiar"}</span>
          </button>
        </div>
      </div>

      {/* Primary Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3">
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
            Frequência
          </span>
          <span className="text-lg font-black text-sky-400">
            {current.freq > 0 ? `${current.freq} Hz` : "-"}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
            Nota & Cents
          </span>
          <span className="text-lg font-black text-emerald-400">
            {current.note !== "-" ? `${current.note} (${current.cents > 0 ? `+${current.cents}` : current.cents}c)` : "-"}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
            Volume (RMS)
          </span>
          <span className="text-lg font-black text-amber-400">
            {current.rmsDb > -90 ? `${current.rmsDb} dBFS` : "Mudo"}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
            Clareza YIN
          </span>
          <span className="text-lg font-black text-purple-400">
            {current.clarity}%
          </span>
        </div>
      </div>

      {/* Status & Diagnostic Message */}
      <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-[11px] mb-3">
        <span className="text-slate-400 font-sans">Diagnóstico do Pipeline:</span>
        <span
          className={clsx(
            "font-bold font-sans px-2 py-0.5 rounded",
            current.status.includes("Afinado")
              ? "bg-emerald-500/20 text-emerald-300"
              : current.status.includes("Abaixo")
              ? "bg-slate-800 text-slate-400"
              : "bg-sky-500/20 text-sky-300"
          )}
        >
          {current.status}
        </span>
      </div>

      {/* Mini Recent Log History */}
      {logHistory.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
            Últimas leituras confirmadas:
          </span>
          <div className="space-y-0.5">
            {logHistory.map((item, i) => (
              <div
                key={`log-${i}`}
                className="flex items-center justify-between text-[10px] py-0.5 px-1.5 rounded bg-slate-900/40 text-slate-400"
              >
                <span>{item.time}</span>
                <span className="text-sky-300 font-bold">{item.freq} Hz</span>
                <span className="text-emerald-300 font-bold">{item.note}</span>
                <span className="text-amber-300">{item.cents}c</span>
                <span>{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Helpful Hint */}
      <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center gap-1.5 text-[11px] text-slate-500 font-sans">
        <Info className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
        <span>
          Toque as cordas com o painel aberto para verificar se o microfone está captando na faixa correta.
        </span>
      </div>
    </div>
  );
}
