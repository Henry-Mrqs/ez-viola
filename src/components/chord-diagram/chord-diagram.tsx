"use client";

import React from "react";
import { ChordDefinition } from "@/songs/song-schema";

interface GuitarChordDiagramProps {
  chord: ChordDefinition;
  width?: number;
  height?: number;
  className?: string;
  showTitle?: boolean;
}

export function GuitarChordDiagram({
  chord,
  width = 160,
  height = 200,
  className = "",
  showTitle = true,
}: GuitarChordDiagramProps) {
  // Dimensions
  const paddingX = 28;
  const paddingTop = showTitle ? 44 : 28;
  const paddingBottom = 22;

  const gridWidth = width - paddingX * 2;
  const gridHeight = height - paddingTop - paddingBottom;

  const numStrings = 6;
  const numFrets = 4;

  const stringSpacing = gridWidth / (numStrings - 1);
  const fretSpacing = gridHeight / numFrets;

  const isNut = chord.baseFret === 1;

  // Helper coordinate getters
  const getStringX = (strIndex: number) => paddingX + strIndex * stringSpacing; // 0 = 6th string, 5 = 1st string
  const getFretY = (fretNum: number) => paddingTop + fretNum * fretSpacing; // 0 = nut, 1..4 = frets

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* Chord Title */}
        {showTitle && (
          <text
            x={width / 2}
            y={22}
            textAnchor="middle"
            className="fill-white font-extrabold text-base tracking-wide"
          >
            {chord.displayName || chord.chordId}
          </text>
        )}

        {/* Base Fret Label (if > 1) */}
        {!isNut && (
          <text
            x={paddingX - 10}
            y={getFretY(1) - fretSpacing / 2 + 4}
            textAnchor="end"
            className="fill-amber-400 font-bold text-xs"
          >
            {chord.baseFret}ª
          </text>
        )}

        {/* Top Open (O) / Muted (X) Indicators */}
        {chord.frets.map((fretVal, strIdx) => {
          const x = getStringX(strIdx);
          const y = paddingTop - 10;

          if (fretVal === -1) {
            // Muted string '✕'
            return (
              <text
                key={`mute-${strIdx}`}
                x={x}
                y={y}
                textAnchor="middle"
                className="fill-slate-500 font-bold text-xs select-none"
              >
                ✕
              </text>
            );
          } else if (fretVal === 0) {
            // Open string '○'
            return (
              <circle
                key={`open-${strIdx}`}
                cx={x}
                cy={y - 4}
                r={4}
                stroke="#38BDF8"
                strokeWidth={1.5}
                fill="none"
              />
            );
          }
          return null;
        })}

        {/* Nut (Thick line if baseFret === 1) */}
        <line
          x1={paddingX}
          y1={paddingTop}
          x2={paddingX + gridWidth}
          y2={paddingTop}
          stroke={isNut ? "#F8FAFC" : "#64748B"}
          strokeWidth={isNut ? 4.5 : 2}
          strokeLinecap="round"
        />

        {/* Fret Lines (1 to 4) */}
        {[1, 2, 3, 4].map((fretNum) => (
          <line
            key={`fret-${fretNum}`}
            x1={paddingX}
            y1={getFretY(fretNum)}
            x2={paddingX + gridWidth}
            y2={getFretY(fretNum)}
            stroke="#475569"
            strokeWidth={1.5}
          />
        ))}

        {/* Vertical String Lines (6 strings) */}
        {[0, 1, 2, 3, 4, 5].map((strIdx) => {
          // Thicker lines for lower strings (string 6 is thicker than string 1)
          const strokeWidth = 2.5 - strIdx * 0.3;
          return (
            <line
              key={`str-${strIdx}`}
              x1={getStringX(strIdx)}
              y1={paddingTop}
              x2={getStringX(strIdx)}
              y2={paddingTop + gridHeight}
              stroke="#64748B"
              strokeWidth={Math.max(1, strokeWidth)}
            />
          );
        })}

        {/* Barre Lines (if present) */}
        {chord.barres &&
          chord.barres.map((barre, bIdx) => {
            // fromString and toString are 1 to 6 (6 = low E, 1 = high E)
            const startStrIdx = 6 - barre.fromString;
            const endStrIdx = 6 - barre.toString;
            const fretRelative = barre.fret - chord.baseFret + 1;
            const y = getFretY(fretRelative) - fretSpacing / 2;
            const x1 = getStringX(Math.min(startStrIdx, endStrIdx));
            const x2 = getStringX(Math.max(startStrIdx, endStrIdx));

            return (
              <rect
                key={`barre-${bIdx}`}
                x={x1 - 6}
                y={y - 8}
                width={x2 - x1 + 12}
                height={16}
                rx={8}
                className="fill-emerald-500/80 stroke-emerald-400"
                strokeWidth={1.5}
              />
            );
          })}

        {/* Finger Dots (1 to 4) */}
        {chord.frets.map((fretVal, strIdx) => {
          if (fretVal <= 0) return null; // skip open or muted

          const fretRelative = fretVal - chord.baseFret + 1;
          if (fretRelative < 1 || fretRelative > numFrets) return null;

          const cx = getStringX(strIdx);
          const cy = getFretY(fretRelative) - fretSpacing / 2;
          const fingerNum = chord.fingers[strIdx];

          return (
            <g key={`dot-${strIdx}`}>
              <circle
                cx={cx}
                cy={cy}
                r={7}
                className="fill-emerald-500 stroke-emerald-300"
                strokeWidth={1.5}
              />
              {fingerNum > 0 && (
                <text
                  x={cx}
                  y={cy + 3.5}
                  textAnchor="middle"
                  className="fill-white font-black text-[10px] select-none"
                >
                  {fingerNum}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
