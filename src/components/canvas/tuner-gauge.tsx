"use client";

import React, { useEffect, useRef } from "react";

interface TunerGaugeProps {
  cents: number; // -50 to +50
  inTune: boolean;
  isGateOpen: boolean;
  hasPitch: boolean;
}

export function TunerGauge({ cents, inTune, isGateOpen, hasPitch }: TunerGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentCentsRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const targetCents = hasPitch && isGateOpen ? Math.max(-50, Math.min(50, cents)) : 0;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      // Lerp smoothing: smoothly interpolate needle position
      const current = currentCentsRef.current;
      const factor = 0.15; // smooth damping
      currentCentsRef.current = current + (targetCents - current) * factor;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height - 25;
      const radius = Math.min(width * 0.42, height * 0.75);

      ctx.clearRect(0, 0, width, height);

      // Arc Angles: -135deg (-3/4 PI) to -45deg (-1/4 PI)
      const startAngle = -Math.PI * 0.8;
      const endAngle = -Math.PI * 0.2;
      const totalSweep = endAngle - startAngle;

      // 1. Background Arc
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
      ctx.strokeStyle = inTune ? "#22C55E" : "#334155";
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
        ctx.strokeStyle = isCenter ? (inTune ? "#22C55E" : "#94A3B8") : "#475569";
        ctx.stroke();

        // Numeric labels for -50, 0, +50
        if (c === -50 || c === 0 || c === 50) {
          const labelDist = radius - 24;
          const lx = centerX + Math.cos(tickAngle) * labelDist;
          const ly = centerY + Math.sin(tickAngle) * labelDist;
          ctx.font = "bold 11px system-ui, sans-serif";
          ctx.fillStyle = c === 0 && inTune ? "#22C55E" : "#64748B";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(c === 0 ? "0" : c > 0 ? `+${c}` : `${c}`, lx, ly);
        }
      }

      // 4. Smooth Needle
      const activeAngle = zeroAngle + currentCentsRef.current * sweepPerCent;
      const needleLength = radius - 8;
      const needleX = centerX + Math.cos(activeAngle) * needleLength;
      const needleY = centerY + Math.sin(activeAngle) * needleLength;

      ctx.save();
      if (inTune && hasPitch) {
        ctx.shadowColor = "#22C55E";
        ctx.shadowBlur = 12;
      }

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(needleX, needleY);
      ctx.lineWidth = inTune ? 4 : 3;
      ctx.strokeStyle = !hasPitch || !isGateOpen ? "#475569" : inTune ? "#22C55E" : "#38BDF8"; // Sky blue when searching
      ctx.lineCap = "round";
      ctx.stroke();

      // Needle center pivot circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, 7, 0, 2 * Math.PI);
      ctx.fillStyle = inTune && hasPitch ? "#22C55E" : "#38BDF8";
      ctx.fill();
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
  }, [cents, inTune, isGateOpen, hasPitch]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto">
      <canvas
        ref={canvasRef}
        width={360}
        height={180}
        className="w-full max-w-[360px] h-[180px]"
      />
    </div>
  );
}
