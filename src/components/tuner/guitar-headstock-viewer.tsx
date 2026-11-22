"use client";

import React from "react";
import { TunerTuningAction } from "@/audio/types";
import { clsx } from "clsx";

export interface GuitarHeadstockViewerProps {
  activeStringNumber: number | null; // 6 to 1
  cents: number;
  inTune: boolean;
  hasSignal: boolean;
  tuningAction: TunerTuningAction;
  onSelectString?: (stringNumber: number) => void;
  className?: string;
}

interface PegPosition {
  stringNumber: number;
  name: string;
  note: string;
  side: "left" | "right";
  cx: number;
  cy: number;
  labelX: number;
  labelY: number;
  metaphor: string;
}

const PEGS: PegPosition[] = [
  // Left side (Low strings: 6, 5, 4 - Bass / Graves)
  {
    stringNumber: 6,
    name: "E2",
    note: "Mi",
    side: "left",
    cx: 46,
    cy: 70,
    labelX: 18,
    labelY: 70,
    metaphor: "Mais grossa (Cima)",
  },
  {
    stringNumber: 5,
    name: "A2",
    note: "Lá",
    side: "left",
    cx: 46,
    cy: 135,
    labelX: 18,
    labelY: 135,
    metaphor: "2ª mais grossa",
  },
  {
    stringNumber: 4,
    name: "D3",
    note: "Ré",
    side: "left",
    cx: 46,
    cy: 200,
    labelX: 18,
    labelY: 200,
    metaphor: "3ª corda (Meio)",
  },

  // Right side (High strings: 1, 2, 3 - Treble / Agudas)
  {
    stringNumber: 1,
    name: "E4",
    note: "Mi",
    side: "right",
    cx: 214,
    cy: 70,
    labelX: 242,
    labelY: 70,
    metaphor: "Mais fina (Baixo)",
  },
  {
    stringNumber: 2,
    name: "B3",
    note: "Si",
    side: "right",
    cx: 214,
    cy: 135,
    labelX: 242,
    labelY: 135,
    metaphor: "2ª mais fina",
  },
  {
    stringNumber: 3,
    name: "G3",
    note: "Sol",
    side: "right",
    cx: 214,
    cy: 200,
    labelX: 242,
    labelY: 200,
    metaphor: "3ª mais fina",
  },
];

export function GuitarHeadstockViewer({
  activeStringNumber,
  cents,
  inTune,
  hasSignal,
  tuningAction,
  onSelectString,
  className,
}: GuitarHeadstockViewerProps) {
  const isDanger =
    activeStringNumber === 1 && (cents > 45 || tuningAction === "DANGER_BREAK");

  const activePeg = PEGS.find((p) => p.stringNumber === activeStringNumber);

  return (
    <div
      data-testid="guitar-headstock-viewer"
      className={clsx(
        "flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl max-w-sm w-full mx-auto",
        isDanger && "border-red-500/80 bg-red-950/20 shadow-red-950/50",
        className
      )}
    >
      {/* Safety Alert Anti-Panic Banner */}
      {isDanger && (
        <div
          data-testid="danger-break-banner"
          className="w-full mb-3 p-3 bg-red-600/30 border-2 border-red-500 rounded-xl text-red-100 font-black text-xs text-center animate-pulse flex items-center justify-center gap-2 shadow-lg"
        >
          <span className="text-lg">⚠️</span>
          <span>CUIDADO: RISCO DE QUEBRA! AFROUXE A TARRAXA IMEDIATAMENTE</span>
        </div>
      )}

      {/* Headstock Header & Action Feedback */}
      <div className="w-full text-center mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Cabeça do Violão & Tarraxas
        </h4>
        {hasSignal && activePeg ? (
          <div className="mt-1">
            <span
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors",
                isDanger
                  ? "bg-red-500/20 text-red-300 border border-red-500/50"
                  : inTune
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm shadow-emerald-950"
                  : tuningAction === "TIGHTEN" || cents < -5
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-orange-500/20 text-orange-300 border border-orange-500/40"
              )}
            >
              {inTune ? (
                <>✓ CORDA AFINADA!</>
              ) : tuningAction === "TIGHTEN" || cents < -5 ? (
                <>↺ APERTE A TARRAXA ({activePeg.name})</>
              ) : (
                <>↻ AFROUXE A TARRAXA ({activePeg.name})</>
              )}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              Corda {activePeg.stringNumber}: {activePeg.metaphor}
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 mt-1">
            Toque uma corda ou clique na tarraxa para selecionar
          </p>
        )}
      </div>

      {/* Interactive Headstock SVG */}
      <div className="relative w-[260px] h-[300px]">
        <svg
          viewBox="0 0 260 300"
          className="w-full h-full select-none"
          role="img"
          aria-label="Guitar Headstock"
        >
          <defs>
            <linearGradient id="woodGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#331A0F" />
              <stop offset="50%" stopColor="#4A2818" />
              <stop offset="100%" stopColor="#25130A" />
            </linearGradient>

            <linearGradient id="pegMetal" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#94A3B8" />
              <stop offset="50%" stopColor="#CBD5E1" />
              <stop offset="100%" stopColor="#64748B" />
            </linearGradient>

            <filter id="pegGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#38BDF8" floodOpacity="0.8" />
            </filter>
            <filter id="inTuneGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#22C55E" floodOpacity="0.9" />
            </filter>
            <filter id="dangerGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#EF4444" floodOpacity="1.0" />
            </filter>
          </defs>

          {/* Headstock Wooden Body */}
          <path
            d="M 65 20
               C 85 8, 175 8, 195 20
               C 215 35, 205 250, 195 280
               C 185 295, 75 295, 65 280
               C 55 250, 45 35, 65 20 Z"
            fill="url(#woodGradient)"
            stroke="#5C3317"
            strokeWidth="3"
          />

          {/* Decorative Headstock Inlay / Truss Rod Cover */}
          <polygon
            points="130,28 140,55 120,55"
            fill="#1E293B"
            stroke="#94A3B8"
            strokeWidth="1"
          />

          {/* Nut at base (Pestana) */}
          <rect
            x="64"
            y="278"
            width="132"
            height="14"
            rx="2"
            fill="#F8FAFC"
            stroke="#CBD5E1"
            strokeWidth="1"
          />

          {/* Strings drawn from pegs through nut */}
          {PEGS.map((peg) => {
            const isActive = peg.stringNumber === activeStringNumber;
            const nutX = 72 + (6 - peg.stringNumber) * 23;
            const nutY = 285;
            const strokeWidth = 1 + (peg.stringNumber * 0.45);

            return (
              <g key={`string-${peg.stringNumber}`}>
                <line
                  x1={peg.cx}
                  y1={peg.cy}
                  x2={nutX}
                  y2={nutY}
                  stroke={
                    isActive
                      ? isDanger
                        ? "#EF4444"
                        : inTune
                        ? "#22C55E"
                        : "#38BDF8"
                      : "#64748B"
                  }
                  strokeWidth={strokeWidth}
                  strokeOpacity={isActive ? 1.0 : 0.6}
                  className={isActive ? "transition-all duration-300" : ""}
                />
                <line
                  x1={nutX}
                  y1={nutY}
                  x2={nutX}
                  y2={300}
                  stroke={isActive ? (inTune ? "#22C55E" : "#38BDF8") : "#64748B"}
                  strokeWidth={strokeWidth}
                />
              </g>
            );
          })}

          {/* Tuning Pegs (Tarraxas) */}
          {PEGS.map((peg) => {
            const isActive = peg.stringNumber === activeStringNumber;
            const pegColor = isActive
              ? isDanger
                ? "#EF4444"
                : inTune
                ? "#22C55E"
                : "#38BDF8"
              : "#CBD5E1";

            const filterId = isActive
              ? isDanger
                ? "url(#dangerGlow)"
                : inTune
                ? "url(#inTuneGlow)"
                : "url(#pegGlow)"
              : undefined;

            return (
              <g
                key={`peg-${peg.stringNumber}`}
                className="cursor-pointer group"
                onClick={() => onSelectString?.(peg.stringNumber)}
                data-testid={`peg-${peg.stringNumber}`}
              >
                {/* Outer Wing / Handle of Tuning Machine */}
                <ellipse
                  cx={peg.side === "left" ? peg.cx - 16 : peg.cx + 16}
                  cy={peg.cy}
                  rx="10"
                  ry="5"
                  fill="url(#pegMetal)"
                  stroke="#475569"
                  strokeWidth="1.5"
                  className="transition-transform group-hover:scale-110"
                />

                {/* Connecting Post */}
                <rect
                  x={peg.side === "left" ? peg.cx - 12 : peg.cx}
                  y={peg.cy - 3}
                  width="12"
                  height="6"
                  fill="#94A3B8"
                />

                {/* Main Post / Capstan */}
                <circle
                  cx={peg.cx}
                  cy={peg.cy}
                  r={isActive ? 11 : 9}
                  fill="url(#pegMetal)"
                  stroke={pegColor}
                  strokeWidth={isActive ? 3 : 1.5}
                  filter={filterId}
                />

                {/* Center Hole of post */}
                <circle cx={peg.cx} cy={peg.cy} r="3" fill="#1E293B" />

                {/* Turning Arrow Animation on Active Peg */}
                {isActive && hasSignal && !inTune && (
                  <path
                    d={
                      tuningAction === "TIGHTEN" || cents < -5
                        ? `M ${peg.cx - 15} ${peg.cy} A 15 15 0 1 1 ${peg.cx} ${peg.cy + 15}`
                        : `M ${peg.cx + 15} ${peg.cy} A 15 15 0 1 0 ${peg.cx} ${peg.cy + 15}`
                    }
                    fill="none"
                    stroke={pegColor}
                    strokeWidth="2.5"
                    strokeDasharray="4 2"
                    className="animate-spin origin-center"
                    style={{
                      transformOrigin: `${peg.cx}px ${peg.cy}px`,
                      animationDuration: "2s",
                    }}
                  />
                )}

                {/* Peg String Label Button */}
                <text
                  x={peg.labelX}
                  y={peg.labelY + 4}
                  textAnchor={peg.side === "left" ? "end" : "start"}
                  fontSize="12"
                  fontWeight="bold"
                  fill={isActive ? pegColor : "#94A3B8"}
                  className="transition-colors group-hover:fill-sky-400 select-none font-mono"
                >
                  {peg.stringNumber}: {peg.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
