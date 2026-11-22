"use client";

import React, { useEffect, useRef } from "react";
import { AudioEngine } from "@/audio/audio-engine";
import {
  Headphones,
  Volume2,
  Volume1,
  VolumeX,
  Activity,
  AlertTriangle,
  Mic,
  Sparkles,
} from "lucide-react";
import { clsx } from "clsx";

export interface MicMonitorProps {
  engine: AudioEngine;
  isRunning: boolean;
  isLoopback: boolean;
  loopbackVolume: number; // 0.0 to 1.0
  onToggleLoopback: () => void;
  onVolumeChange: (volume: number) => void;
  onStartMic?: () => void;
  className?: string;
}

export function MicMonitor({
  engine,
  isRunning,
  isLoopback,
  loopbackVolume,
  onToggleLoopback,
  onVolumeChange,
  onStartMic,
  className,
}: MicMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const vuBarRef = useRef<HTMLDivElement | null>(null);
  const vuPeakRef = useRef<HTMLDivElement | null>(null);
  const vuValueRef = useRef<HTMLSpanElement | null>(null);
  const vuStatusRef = useRef<HTMLSpanElement | null>(null);

  // Pre-allocated Zero-GC waveform buffer (1024 samples for crisp oscilloscope trace)
  const timeDataRef = useRef<Float32Array>(new Float32Array(1024));
  const peakHoldRef = useRef<number>(0);

  // Persistent running state ref for RAF loop
  const isRunningRef = useRef<boolean>(isRunning);
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let active = true;
    let rafId: number | null = null;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const baseWidth = 600;
    const baseHeight = 130;
    canvas.width = baseWidth * dpr;
    canvas.height = baseHeight * dpr;

    let restingPhase = 0;

    const render = () => {
      if (!active) return;

      const running = isRunningRef.current;
      const timeData = timeDataRef.current;

      if (running) {
        engine.getWaveformData(timeData);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, baseWidth, baseHeight);

      // 1. Oscilloscope Background & Grid
      const bgGrad = ctx.createLinearGradient(0, 0, 0, baseHeight);
      bgGrad.addColorStop(0, "#090D16");
      bgGrad.addColorStop(1, "#0D1322");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, baseWidth, baseHeight);

      // Subtle horizontal grid lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#1A2338";
      for (let y = 20; y < baseHeight; y += 22) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(baseWidth, y);
        ctx.stroke();
      }

      // Subtle vertical grid lines
      for (let x = 40; x < baseWidth; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, baseHeight);
        ctx.stroke();
      }

      // Center baseline
      const centerY = baseHeight / 2;
      ctx.beginPath();
      ctx.strokeStyle = "#2A3A5A";
      ctx.setLineDash([4, 4]);
      ctx.moveTo(0, centerY);
      ctx.lineTo(baseWidth, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Waveform Trace
      if (running) {
        const waveGrad = ctx.createLinearGradient(0, 0, baseWidth, 0);
        waveGrad.addColorStop(0, "#06B6D4"); // Vibrant Cyan
        waveGrad.addColorStop(0.5, "#10B981"); // Neon Emerald
        waveGrad.addColorStop(1, "#22C55E"); // Bright Lime

        ctx.shadowColor = "#10B981";
        ctx.shadowBlur = 9;
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = waveGrad;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        const sliceWidth = baseWidth / (timeData.length - 1);
        let x = 0;

        for (let i = 0; i < timeData.length; i++) {
          const sample = timeData[i];
          // Scale sample [-1.0, 1.0] to canvas height with padding
          const y = centerY + sample * (baseHeight * 0.44);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        ctx.stroke();

        // 3. RMS & VU Meter Calculations (Direct DOM update - Zero Re-render)
        let sumSquares = 0;
        for (let i = 0; i < timeData.length; i++) {
          sumSquares += timeData[i] * timeData[i];
        }
        const rms = Math.sqrt(sumSquares / timeData.length);
        const dbfs = rms > 0.0001 ? 20 * Math.log10(rms) : -60;
        const clampedDbfs = Math.max(-60, Math.min(0, dbfs));
        const vuPercent = Math.min(100, Math.max(0, ((clampedDbfs + 60) / 60) * 100));

        // Peak Hold logic with decay
        if (vuPercent > peakHoldRef.current) {
          peakHoldRef.current = vuPercent;
        } else {
          peakHoldRef.current = Math.max(0, peakHoldRef.current - 0.7);
        }

        // Direct DOM Update for 60 FPS zero-overhead VU meter
        if (vuBarRef.current) {
          vuBarRef.current.style.width = `${vuPercent.toFixed(1)}%`;
        }
        if (vuPeakRef.current) {
          vuPeakRef.current.style.left = `${peakHoldRef.current.toFixed(1)}%`;
        }
        if (vuValueRef.current) {
          vuValueRef.current.textContent = `${clampedDbfs.toFixed(1)} dBFS (RMS: ${rms.toFixed(3)})`;
        }
        if (vuStatusRef.current) {
          if (clampedDbfs < -45) {
            vuStatusRef.current.textContent = "Sem sinal / Silêncio";
            vuStatusRef.current.className = "text-slate-400 font-medium";
          } else if (clampedDbfs < -28) {
            vuStatusRef.current.textContent = "Sinal Moderado";
            vuStatusRef.current.className = "text-sky-400 font-medium";
          } else if (clampedDbfs <= -4) {
            vuStatusRef.current.textContent = "Sinal Forte • Ideal";
            vuStatusRef.current.className = "text-emerald-400 font-bold";
          } else {
            vuStatusRef.current.textContent = "Atenção: Quase Saturando";
            vuStatusRef.current.className = "text-rose-400 font-bold animate-pulse";
          }
        }
      } else {
        // Standby resting wave animation
        restingPhase += 0.04;
        ctx.beginPath();
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1.5;
        for (let x = 0; x < baseWidth; x += 4) {
          const y = centerY + Math.sin(x * 0.02 + restingPhase) * 3;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        if (vuBarRef.current) vuBarRef.current.style.width = "0%";
        if (vuPeakRef.current) vuPeakRef.current.style.left = "0%";
        if (vuValueRef.current) vuValueRef.current.textContent = "-60.0 dBFS (RMS: 0.000)";
        if (vuStatusRef.current) {
          vuStatusRef.current.textContent = "Microfone Desconectado";
          vuStatusRef.current.className = "text-slate-500 font-medium";
        }
      }

      ctx.restore();
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      active = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [engine]);

  return (
    <div
      className={clsx(
        "w-full rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 shadow-xl space-y-4 backdrop-blur-md",
        className
      )}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              Monitor de Áudio & Teste do Microfone
            </h3>
            <p className="text-[11px] text-slate-400">
              Osciloscópio a 60 FPS e medição de nível dBFS em tempo real
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Sinal Ao Vivo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              Microfone Parado
            </span>
          )}
        </div>
      </div>

      {/* Oscilloscope Canvas */}
      <div className="relative w-full rounded-xl overflow-hidden border border-slate-800 shadow-inner group">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "130px" }}
          className="w-full h-[130px] block"
        />

        {/* Oscilloscope HUD Badges */}
        <div className="absolute top-2 left-3 pointer-events-none flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-900/80 border border-slate-700/80 text-cyan-300">
            Osciloscópio
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-900/80 border border-slate-700/80">
            60 FPS
          </span>
        </div>

        {!isRunning && onStartMic && (
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 p-4 text-center">
            <Mic className="w-6 h-6 text-emerald-400 animate-pulse" />
            <p className="text-xs text-slate-300 font-medium">
              Microfone desligado. Ative para visualizar a onda acústica do violão.
            </p>
            <button
              onClick={onStartMic}
              className="mt-1 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/50 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Ativar Microfone
            </button>
          </div>
        )}
      </div>

      {/* Real-Time VU Meter */}
      <div className="space-y-1.5 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1.5">
            VU Meter (dBFS):
            <span ref={vuStatusRef} className="text-slate-400 font-medium">
              Sem sinal / Silêncio
            </span>
          </span>
          <span
            ref={vuValueRef}
            className="font-mono text-[11px] font-semibold text-slate-300"
          >
            -60.0 dBFS (RMS: 0.000)
          </span>
        </div>

        {/* VU Meter Track */}
        <div className="relative w-full h-3 sm:h-3.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700/70 shadow-inner">
          {/* Active Gradient Fill Bar */}
          <div
            ref={vuBarRef}
            style={{ width: "0%" }}
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-rose-500 transition-[width] duration-75 shadow-sm"
          />

          {/* Peak Hold Marker */}
          <div
            ref={vuPeakRef}
            style={{ left: "0%" }}
            className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)] -translate-x-1/2 rounded-full pointer-events-none"
          />
        </div>

        {/* Scale Numbers */}
        <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-0.5 px-0.5">
          <span>-60 dB</span>
          <span>-48</span>
          <span>-36</span>
          <span>-24</span>
          <span>-12</span>
          <span>-6</span>
          <span className="text-rose-400 font-bold">0 dB</span>
        </div>
      </div>

      {/* Loopback Return Controls & Friendly Alert */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        {/* Prominent Headphones Button */}
        <div className="flex flex-col gap-2">
          <button
            onClick={onToggleLoopback}
            disabled={!isRunning}
            className={clsx(
              "w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 border shadow-md active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed",
              isLoopback
                ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 ring-4 ring-emerald-500/30 animate-pulse shadow-emerald-950/60"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:text-white"
            )}
          >
            <Headphones
              className={clsx(
                "w-5 h-5",
                isLoopback ? "text-white animate-bounce" : "text-slate-400"
              )}
            />
            <span>
              {isLoopback
                ? "Retorno do Microfone Ativo"
                : "Ouvir Retorno do Microfone"}
            </span>
          </button>

          {/* Friendly Visual Alert */}
          <div
            className={clsx(
              "flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-colors border",
              isLoopback
                ? "bg-amber-500/15 border-amber-500/40 text-amber-200 shadow-sm"
                : "bg-slate-800/60 border-slate-800 text-slate-400"
            )}
          >
            <AlertTriangle
              className={clsx(
                "w-4 h-4 flex-shrink-0 mt-0.5",
                isLoopback ? "text-amber-400" : "text-slate-500"
              )}
            />
            <span className="leading-relaxed">
              Recomendado usar fones de ouvido para evitar microfonia (eco) nas caixas de som.
            </span>
          </div>
        </div>

        {/* Volume Slider */}
        <div className="flex flex-col justify-center gap-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              {loopbackVolume === 0 ? (
                <VolumeX className="w-4 h-4 text-slate-500" />
              ) : loopbackVolume < 0.5 ? (
                <Volume1 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
              Volume do Retorno
            </span>
            <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-700">
              {Math.round(loopbackVolume * 100)}%
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(loopbackVolume * 100)}
            onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
            disabled={!isRunning}
            className="w-full accent-emerald-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          />

          <p className="text-[11px] text-slate-400">
            Ajuste o ganho do áudio monitorado que é direcionado aos seus fones de ouvido.
          </p>
        </div>
      </div>
    </div>
  );
}
