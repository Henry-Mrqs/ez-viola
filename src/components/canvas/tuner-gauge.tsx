"use client";

import React, { useEffect, useRef } from "react";
import { GUITAR_STRINGS } from "@/audio/types";
import { clsx } from "clsx";

export interface TunerGaugeProps {
  cents: number; // -50 to +50
  inTune: boolean;
  isGateOpen: boolean;
  hasPitch: boolean;
  stringIndex?: number; // 0..5 index into GUITAR_STRINGS, or -1
  noteName?: string;
  octave?: number;
  frequency?: number;
  targetFrequency?: number;
}

export function TunerGauge({
  cents,
  inTune,
  isGateOpen,
  hasPitch,
  stringIndex = -1,
  noteName,
  octave,
  frequency,
  targetFrequency,
}: TunerGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentCentsRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  // Synchronous ref to hold live props without restarting RAF loop
  const targetRef = useRef({
    targetCents: 0,
    inTune: false,
    isGateOpen: false,
    hasPitch: false,
  });

  useEffect(() => {
    targetRef.current = {
      targetCents: hasPitch && isGateOpen ? Math.max(-50, Math.min(50, cents)) : 0,
      inTune,
      isGateOpen,
      hasPitch,
    };
  }, [cents, inTune, isGateOpen, hasPitch]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isRunning = true;

    // Handle high-DPI crisp rendering
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const baseWidth = 360;
    const baseHeight = 180;
    canvas.width = baseWidth * dpr;
    canvas.height = baseHeight * dpr;

    const render = () => {
      if (!isRunning) return;

      const { targetCents, inTune: curInTune, isGateOpen: curGate, hasPitch: curPitch } = targetRef.current;
      const current = currentCentsRef.current;
      const diff = targetCents - current;

      // Micro-vibration deadband & smooth lerp damping
      if (Math.abs(diff) < 0.08) {
        currentCentsRef.current = targetCents;
      } else {
        // Fast tracking for large intervals, soft damping near target to eliminate micro-shivering
        const factor = Math.abs(diff) > 8 ? 0.22 : 0.10;
        currentCentsRef.current = current + diff * factor;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, baseWidth, baseHeight);

      const centerX = baseWidth / 2;
      const centerY = baseHeight - 25;
      const radius = Math.min(baseWidth * 0.42, baseHeight * 0.75);

      // Arc Angles: -135deg (-3/4 PI) to -45deg (-1/4 PI)
      const startAngle = -Math.PI * 0.8;
      const endAngle = -Math.PI * 0.2;
      const totalSweep = endAngle - startAngle;

      // 1. Background Arc Track
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#1E293B"; // Slate 800
      ctx.lineCap = "round";
      ctx.stroke();

      // 2. Sweet spot in-tune zone (-5 to +5 cents)
      const zeroAngle = -Math.PI / 2;
      const sweepPerCent = totalSweep / 100;
      const inTuneStart = zeroAngle - 5 * sweepPerCent;
      const inTuneEnd = zeroAngle + 5 * sweepPerCent;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, inTuneStart, inTuneEnd);
      ctx.lineWidth = 10;
      ctx.strokeStyle = curInTune && curPitch && curGate ? "#22C55E" : "#334155";
      ctx.lineCap = "round";
      ctx.stroke();

      // 3. Tick Marks (-50 to +50 every 10 cents)
      for (let c = -50; c <= 50; c += 10) {
        const tickAngle = zeroAngle + c * sweepPerCent;
        const isCenter = c === 0;
        const isFifth = Math.abs(c) === 50 || c === 0;
        const tickLength = isCenter ? 14 : isFifth ? 10 : 6;

        const x1 = centerX + Math.cos(tickAngle) * (radius - tickLength);
        const y1 = centerY + Math.sin(tickAngle) * (radius - tickLength);
        const x2 = centerX + Math.cos(tickAngle) * (radius + 2);
        const y2 = centerY + Math.sin(tickAngle) * (radius + 2);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = isCenter ? 3 : 1.5;
        ctx.strokeStyle = isCenter
          ? curInTune && curPitch && curGate
            ? "#22C55E"
            : "#94A3B8"
          : "#475569";
        ctx.stroke();

        // Numeric labels for -50, 0, +50
        if (c === -50 || c === 0 || c === 50) {
          const labelDist = radius - 24;
          const lx = centerX + Math.cos(tickAngle) * labelDist;
          const ly = centerY + Math.sin(tickAngle) * labelDist;
          ctx.font = "bold 11px system-ui, sans-serif";
          ctx.fillStyle = c === 0 && curInTune && curPitch && curGate ? "#22C55E" : "#64748B";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(c === 0 ? "0" : c > 0 ? `+${c}` : `${c}`, lx, ly);
        }
      }

      // 4. Smooth Lerp Needle
      const activeAngle = zeroAngle + currentCentsRef.current * sweepPerCent;
      const needleLength = radius - 8;
      const needleX = centerX + Math.cos(activeAngle) * needleLength;
      const needleY = centerY + Math.sin(activeAngle) * needleLength;

      ctx.save();
      if (curInTune && curPitch && curGate) {
        ctx.shadowColor = "#22C55E";
        ctx.shadowBlur = 14;
      }

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(needleX, needleY);
      ctx.lineWidth = curInTune && curPitch ? 4 : 3;
      ctx.strokeStyle =
        !curPitch || !curGate
          ? "#475569"
          : curInTune
          ? "#22C55E"
          : "#38BDF8"; // Sky blue when adjusting
      ctx.lineCap = "round";
      ctx.stroke();

      // Needle center pivot circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, 7, 0, 2 * Math.PI);
      ctx.fillStyle = curInTune && curPitch && curGate ? "#22C55E" : curPitch && curGate ? "#38BDF8" : "#475569";
      ctx.fill();

      // Inner pivot dot
      ctx.beginPath();
      ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
      ctx.fillStyle = "#0F172A";
      ctx.fill();
      ctx.restore();

      ctx.restore();

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Compute detected string info for lock badge
  const isSoundActive = hasPitch && isGateOpen;
  const detectedString =
    isSoundActive && stringIndex >= 0 && stringIndex < GUITAR_STRINGS.length
      ? GUITAR_STRINGS[stringIndex]
      : null;

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto space-y-2">
      {/* String Detection / Lock Status Badge */}
      <div className="h-7 flex items-center justify-center">
        {detectedString ? (
          <div
            className={clsx(
              "inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold border transition-all duration-200 shadow-sm",
              inTune
                ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-emerald-950/40"
                : "bg-slate-800/90 border-slate-700 text-slate-200"
            )}
          >
            <span
              className={clsx(
                "w-2 h-2 rounded-full",
                inTune ? "bg-emerald-400 animate-pulse" : "bg-sky-400"
              )}
            />
            <span>
              Corda {detectedString.stringNumber}: {detectedString.name} (
              {detectedString.targetFrequency.toFixed(1)} Hz) •{" "}
              {inTune ? "Afinada" : Math.abs(cents) <= 8 ? "Estável" : "Detectada"}
            </span>
          </div>
        ) : isSoundActive && noteName && noteName !== "-" ? (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800/80 border border-slate-700 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            <span>
              Nota: {noteName}
              {octave !== undefined && octave >= 0 ? octave : ""}
              {frequency
                ? ` (${frequency.toFixed(1)} Hz${
                    targetFrequency ? ` / Alvo: ${targetFrequency.toFixed(1)} Hz` : ""
                  })`
                : ""} •{" "}
              {inTune ? "Afinada" : "Detectada"}
            </span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-medium text-slate-500 bg-slate-900/60 border border-slate-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
            <span>Aguardando sinal do violão...</span>
          </div>
        )}
      </div>

      {/* Canvas Gauge */}
      <canvas
        ref={canvasRef}
        style={{ width: "360px", height: "180px" }}
        className="w-full max-w-[360px] h-[180px] drop-shadow-md"
      />
    </div>
  );
}
