"use client";

import React from "react";
import { clsx } from "clsx";

export interface FingerPlacement {
  fingerNumber: 1 | 2 | 3 | 4;
  fingerName: "Indicador" | "Médio" | "Anelar" | "Mínimo";
  colorHex: string;
  stringNumber: number; // 6 to 1
  fretNumber: number; // 1, 2, 3...
}

export interface ChordGuideData {
  chordId: string;
  beginnerName: string;
  tagline: string;
  fingers: FingerPlacement[];
  mutedStrings: number[]; // e.g. [6]
  openStrings: number[]; // e.g. [1, 2, 3, 4]
  strumDirection: "down" | "up";
  pedagogicalTip: string;
}

export const FINGER_COLORS = {
  1: { hex: "#3B82F6", label: "Indicador", name: "Dedo 1 (Azul)" },
  2: { hex: "#10B981", label: "Médio", name: "Dedo 2 (Verde)" },
  3: { hex: "#F97316", label: "Anelar", name: "Dedo 3 (Laranja)" },
  4: { hex: "#A855F7", label: "Mínimo", name: "Dedo 4 (Roxo)" },
} as const;

export const CHORD_GUIDES: Record<string, ChordGuideData> = {
  Em: {
    chordId: "Em",
    beginnerName: "Mi Menor (O Mais Fácil do Mundo)",
    tagline: "Apenas 2 dedos nas cordas grossas",
    fingers: [
      {
        fingerNumber: 1,
        fingerName: "Indicador",
        colorHex: "#3B82F6",
        stringNumber: 5,
        fretNumber: 2,
      },
      {
        fingerNumber: 2,
        fingerName: "Médio",
        colorHex: "#10B981",
        stringNumber: 4,
        fretNumber: 2,
      },
    ],
    mutedStrings: [],
    openStrings: [6, 3, 2, 1],
    strumDirection: "down",
    pedagogicalTip:
      "Mantenha os dedos em pé, como martelinhos, para não encostar nas cordas soltas de baixo.",
  },
  G: {
    chordId: "G",
    beginnerName: "Sol Maior (Aberto Completo)",
    tagline: "Som alegre e vibrante",
    fingers: [
      {
        fingerNumber: 2,
        fingerName: "Médio",
        colorHex: "#10B981",
        stringNumber: 6,
        fretNumber: 3,
      },
      {
        fingerNumber: 1,
        fingerName: "Indicador",
        colorHex: "#3B82F6",
        stringNumber: 5,
        fretNumber: 2,
      },
      {
        fingerNumber: 3,
        fingerName: "Anelar",
        colorHex: "#F97316",
        stringNumber: 1,
        fretNumber: 3,
      },
    ],
    mutedStrings: [],
    openStrings: [4, 3, 2],
    strumDirection: "down",
    pedagogicalTip:
      "Posicione o Dedo 2 bem firme no meio da Casa 3 da corda mais grossa.",
  },
  C: {
    chordId: "C",
    beginnerName: "Dó Maior (Escadinha Clássica)",
    tagline: "Os dedos sobem em diagonal",
    fingers: [
      {
        fingerNumber: 1,
        fingerName: "Indicador",
        colorHex: "#3B82F6",
        stringNumber: 2,
        fretNumber: 1,
      },
      {
        fingerNumber: 2,
        fingerName: "Médio",
        colorHex: "#10B981",
        stringNumber: 4,
        fretNumber: 2,
      },
      {
        fingerNumber: 3,
        fingerName: "Anelar",
        colorHex: "#F97316",
        stringNumber: 5,
        fretNumber: 3,
      },
    ],
    mutedStrings: [6],
    openStrings: [3, 1],
    strumDirection: "down",
    pedagogicalTip:
      "Toque da Corda 5 para baixo. Encoste de leve a ponta do Dedo 3 na corda mais grossa para abafá-la.",
  },
  D: {
    chordId: "D",
    beginnerName: "Ré Maior (Triângulo Agudo)",
    tagline: "3 dedos juntinhos nas cordas finas",
    fingers: [
      {
        fingerNumber: 1,
        fingerName: "Indicador",
        colorHex: "#3B82F6",
        stringNumber: 3,
        fretNumber: 2,
      },
      {
        fingerNumber: 3,
        fingerName: "Anelar",
        colorHex: "#F97316",
        stringNumber: 2,
        fretNumber: 3,
      },
      {
        fingerNumber: 2,
        fingerName: "Médio",
        colorHex: "#10B981",
        stringNumber: 1,
        fretNumber: 2,
      },
    ],
    mutedStrings: [6, 5],
    openStrings: [4],
    strumDirection: "down",
    pedagogicalTip:
      "Seus dedos formam um triângulo. Toque apenas as 4 cordas de baixo (da corda 4 até a 1).",
  },
  Am7: {
    chordId: "Am7",
    beginnerName: "Lá Menor com 7ª (Apenas 2 Dedos)",
    tagline: "Muito suave e fácil de tocar",
    fingers: [
      {
        fingerNumber: 1,
        fingerName: "Indicador",
        colorHex: "#3B82F6",
        stringNumber: 2,
        fretNumber: 1,
      },
      {
        fingerNumber: 2,
        fingerName: "Médio",
        colorHex: "#10B981",
        stringNumber: 4,
        fretNumber: 2,
      },
    ],
    mutedStrings: [6],
    openStrings: [5, 3, 1],
    strumDirection: "down",
    pedagogicalTip:
      "É como um Dó Maior sem o dedo 3! Muito leve e fácil de trocar para o Dó ou Sol.",
  },
  Bm7: {
    chordId: "Bm7",
    beginnerName: "Si Menor com 7ª (Sem Pestana)",
    tagline: "Versão fácil de Tempo Perdido",
    fingers: [
      {
        fingerNumber: 1,
        fingerName: "Indicador",
        colorHex: "#3B82F6",
        stringNumber: 5,
        fretNumber: 2,
      },
      {
        fingerNumber: 2,
        fingerName: "Médio",
        colorHex: "#10B981",
        stringNumber: 3,
        fretNumber: 2,
      },
      {
        fingerNumber: 3,
        fingerName: "Anelar",
        colorHex: "#F97316",
        stringNumber: 2,
        fretNumber: 3,
      },
    ],
    mutedStrings: [6],
    openStrings: [4, 1],
    strumDirection: "down",
    pedagogicalTip:
      "Sem pestana dolorosa! Palhete da corda 5 para baixo, deixando a corda mais grossa muda.",
  },
};

export interface AnimatedFretboardGuideProps {
  chordId?: string;
  chordName?: string;
  fretsCount?: number; // Padrão: 4 ou 5 casas visíveis
  highlightedStrings?: number[];
  strumDirection?: "down" | "up" | "none";
  showFingerLabels?: boolean;
  className?: string;
}

export function AnimatedFretboardGuide({
  chordId = "Em",
  chordName,
  fretsCount = 4,
  highlightedStrings,
  strumDirection,
  showFingerLabels = true,
  className,
}: AnimatedFretboardGuideProps) {
  const guide = CHORD_GUIDES[chordId] ?? CHORD_GUIDES["Em"];
  const displayTitle = chordName || guide.beginnerName;
  const activeStrum = strumDirection ?? guide.strumDirection;

  // Neck SVG Geometry:
  // 6 strings horizontally:
  // String 6 (Top, Y=35, thickest) to String 1 (Bottom, Y=185, thinnest)
  // Nut at X=45
  // Frets at X=45, 115, 185, 255, 325, 395
  const width = 420;
  const height = 230;
  const nutX = 45;
  const fretSpacing = 70;
  const stringYs = [35, 65, 95, 125, 155, 185]; // 6, 5, 4, 3, 2, 1
  const stringNumbers = [6, 5, 4, 3, 2, 1];

  return (
    <div
      data-testid="animated-fretboard-guide"
      className={clsx(
        "flex flex-col p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl max-w-lg w-full mx-auto",
        className
      )}
    >
      {/* Header: Chord & Strum Direction */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
            <span>{displayTitle}</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {guide.chordId}
            </span>
          </h3>
          <p className="text-xs text-slate-400">{guide.tagline}</p>
        </div>

        {/* Strum Direction Indicator */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200">
          <span>Palheta:</span>
          {activeStrum === "down" ? (
            <span className="text-emerald-400 flex items-center gap-0.5">
              ↓ Baixo
            </span>
          ) : activeStrum === "up" ? (
            <span className="text-sky-400 flex items-center gap-0.5">
              ↑ Cima
            </span>
          ) : (
            <span className="text-slate-400">-</span>
          )}
        </div>
      </div>

      {/* SVG Fretboard (Player's downward perspective) */}
      <div className="relative w-full overflow-x-auto py-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[340px] select-none"
          role="img"
          aria-label={`Guia de Dedos no Braço do Violão para o acorde ${displayTitle}`}
        >
          <defs>
            <linearGradient id="fretboardWood" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2A1810" />
              <stop offset="50%" stopColor="#3B2216" />
              <stop offset="100%" stopColor="#1E100A" />
            </linearGradient>

            <linearGradient id="metalFret" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#64748B" />
              <stop offset="50%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
          </defs>

          {/* Fretboard Wood Background */}
          <rect
            x={nutX}
            y="20"
            width={fretSpacing * fretsCount}
            height="180"
            rx="4"
            fill="url(#fretboardWood)"
            stroke="#1E100A"
            strokeWidth="2"
          />

          {/* Fret Position Marker Dots (e.g. Casa 3) */}
          <circle
            cx={nutX + fretSpacing * 2.5}
            cy="110"
            r="6"
            fill="#CBD5E1"
            fillOpacity="0.4"
          />

          {/* Fret Vertical Metal Wires */}
          {Array.from({ length: fretsCount + 1 }).map((_, i) => {
            const fx = nutX + i * fretSpacing;
            const isNut = i === 0;

            return (
              <g key={`fret-${i}`}>
                <line
                  x1={fx}
                  y1="20"
                  x2={fx}
                  y2="200"
                  stroke={isNut ? "#F8FAFC" : "url(#metalFret)"}
                  strokeWidth={isNut ? 6 : 3}
                />
                {/* Fret Number Label underneath */}
                {i > 0 && i <= fretsCount && (
                  <text
                    x={fx - fretSpacing / 2}
                    y="218"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#94A3B8"
                    className="font-mono select-none"
                  >
                    Casa {i}
                  </text>
                )}
              </g>
            );
          })}

          {/* Horizontal Strings (String 6 on Top, String 1 at Bottom) */}
          {stringNumbers.map((strNum, idx) => {
            const sy = stringYs[idx];
            const isMuted = guide.mutedStrings.includes(strNum);
            const isOpen = guide.openStrings.includes(strNum);
            const strokeThickness = 1.2 + strNum * 0.45;
            const isHighlighted = highlightedStrings?.includes(strNum);

            return (
              <g key={`string-line-${strNum}`}>
                {/* String wire across neck */}
                <line
                  x1={nutX}
                  y1={sy}
                  x2={nutX + fretSpacing * fretsCount}
                  y2={sy}
                  stroke={
                    isHighlighted
                      ? "#38BDF8"
                      : isMuted
                      ? "#475569"
                      : "#94A3B8"
                  }
                  strokeWidth={strokeThickness}
                  strokeOpacity={isMuted ? 0.4 : 0.85}
                />

                {/* Left of Nut: Open (○) or Muted (✕) Indicator */}
                {isMuted ? (
                  <g data-testid={`muted-string-${strNum}`}>
                    <text
                      x="22"
                      y={sy + 5}
                      textAnchor="middle"
                      fontSize="14"
                      fontWeight="black"
                      fill="#EF4444"
                      className="select-none"
                    >
                      ✕
                    </text>
                  </g>
                ) : isOpen ? (
                  <g data-testid={`open-string-${strNum}`}>
                    <circle
                      cx="22"
                      cy={sy}
                      r="7"
                      fill="none"
                      stroke="#22C55E"
                      strokeWidth="2"
                    />
                    <text
                      x="22"
                      y={sy + 3.5}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="bold"
                      fill="#22C55E"
                      className="select-none"
                    >
                      0
                    </text>
                  </g>
                ) : null}

                {/* String number on far left */}
                <text
                  x="6"
                  y={sy + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="bold"
                  fill="#64748B"
                  className="font-mono select-none"
                >
                  {strNum}
                </text>
              </g>
            );
          })}

          {/* Finger Placement Dots */}
          {guide.fingers.map((f, fIdx) => {
            const strIdx = stringNumbers.indexOf(f.stringNumber);
            const cy = stringYs[strIdx] ?? 35;
            // Place dot in center of fret house
            const cx = nutX + (f.fretNumber - 0.5) * fretSpacing;

            return (
              <g
                key={`finger-${f.fingerNumber}-${fIdx}`}
                data-testid={`finger-dot-${f.fingerNumber}`}
                className="animate-in fade-in zoom-in duration-300"
              >
                {/* Glow ring */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="14"
                  fill={f.colorHex}
                  fillOpacity="0.25"
                  className="animate-pulse"
                />

                {/* Solid finger ball */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="10"
                  fill={f.colorHex}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
                />

                {/* Finger Number Label */}
                <text
                  x={cx}
                  y={cy + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="black"
                  fill="#FFFFFF"
                  className="select-none font-sans"
                >
                  {f.fingerNumber}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Universal Finger Color Legend */}
      {showFingerLabels && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-slate-800 text-xs">
          <span className="text-slate-400 text-[11px] font-semibold">Dedos:</span>
          {([1, 2, 3, 4] as const).map((num) => {
            const finger = FINGER_COLORS[num];
            const isUsed = guide.fingers.some((f) => f.fingerNumber === num);

            return (
              <div
                key={`legend-${num}`}
                data-testid={`finger-legend-${num}`}
                className={clsx(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-opacity",
                  isUsed ? "opacity-100 bg-slate-800/80" : "opacity-40"
                )}
              >
                <span
                  className="w-3 h-3 rounded-full flex items-center justify-center text-[9px] font-black text-white"
                  style={{ backgroundColor: finger.hex }}
                >
                  {num}
                </span>
                <span className="text-slate-300 text-[11px]">
                  {finger.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Pedagogical Tip */}
      <div className="mt-3 p-2.5 rounded-xl bg-blue-950/30 border border-blue-900/50 text-xs text-blue-200 flex items-start gap-2">
        <span className="text-base leading-none">💡</span>
        <p className="leading-relaxed">
          <strong className="text-blue-100">Dica do Professor:</strong>{" "}
          {guide.pedagogicalTip}
        </p>
      </div>
    </div>
  );
}
