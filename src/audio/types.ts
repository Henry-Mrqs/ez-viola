/**
 * Strict TypeScript types and interfaces for the Web Audio DSP Engine.
 * Follows Zero-GC contracts: structs are mutable and pre-allocated.
 */

export type AudioEngineStatus =
  | "uninitialized"
  | "requesting"
  | "running"
  | "suspended"
  | "interrupted"
  | "error";

export interface AudioEngineConfig {
  sampleRate: number;
  tunerBufferSize: number; // 2048
  chordFftSize: number; // 4096
  yinThreshold: number; // 0.15
  minRmsThreshold: number; // 0.015 (-36.5 dBFS)
}

export interface GuitarStringSpec {
  stringNumber: number; // 6 (lowest) to 1 (highest)
  name: string; // "E2", "A2", "D3", "G3", "B3", "E4"
  noteName: string; // "E", "A", "D", "G", "B", "E"
  octave: number; // 2, 2, 3, 3, 3, 4
  midiNote: number; // 40, 45, 50, 55, 59, 64
  targetFrequency: number; // 82.41, 110.00, 146.83, 196.00, 246.94, 329.63
  color: string;
}

export const GUITAR_STRINGS: readonly GuitarStringSpec[] = [
  {
    stringNumber: 6,
    name: "E2",
    noteName: "E",
    octave: 2,
    midiNote: 40,
    targetFrequency: 82.41,
    color: "#EF4444",
  },
  {
    stringNumber: 5,
    name: "A2",
    noteName: "A",
    octave: 2,
    midiNote: 45,
    targetFrequency: 110.0,
    color: "#F97316",
  },
  {
    stringNumber: 4,
    name: "D3",
    noteName: "D",
    octave: 3,
    midiNote: 50,
    targetFrequency: 146.83,
    color: "#F59E0B",
  },
  {
    stringNumber: 3,
    name: "G3",
    noteName: "G",
    octave: 3,
    midiNote: 55,
    targetFrequency: 196.0,
    color: "#10B981",
  },
  {
    stringNumber: 2,
    name: "B3",
    noteName: "B",
    octave: 3,
    midiNote: 59,
    targetFrequency: 246.94,
    color: "#0EA5E9",
  },
  {
    stringNumber: 1,
    name: "E4",
    noteName: "E",
    octave: 4,
    midiNote: 64,
    targetFrequency: 329.63,
    color: "#8B5CF6",
  },
] as const;

export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export type TunerTuningAction =
  | "TIGHTEN" // Corda frouxa -> APERTE a tarraxa
  | "LOOSEN" // Corda esticada -> AFROUXE a tarraxa
  | "IN_TUNE" // Afinado dentro da margem
  | "DANGER_BREAK" // Alerta extremo na 1ª corda (E4 > +45 cents)
  | "IDLE"; // Sem sinal ou ruído

export interface TunerResult {
  frequency: number; // -1 if silence or unpitched
  smoothedFrequency: number;
  targetFrequency: number;
  noteName: string;
  octave: number;
  midiNote: number;
  cents: number; // -50 to +50
  rawCents: number; // Desvio centesimal antes de clamp
  inTune: boolean; // Math.abs(cents) <= 5.0
  clarity: number; // 0.0 to 1.0
  rms: number;
  isGateOpen: boolean;
  stringIndex: number; // 0..5 index into GUITAR_STRINGS, or -1 if outside
  tuningAction: TunerTuningAction; // Ação mecânica recomendada
  action: TunerTuningAction; // Alias compatível
  instruction: string; // Instrução textual para iniciante
  isDangerBreak: boolean; // True se risco iminente de rompimento
  isAttackBlanking: boolean; // True se dentro da janela de supressão transitória
}

export interface PitchStabilizerConfig {
  minAlpha?: number; // Padrão: 0.12 (firmeza máxima perto do tom)
  maxAlpha?: number; // Padrão: 0.80 (resposta instantânea em transições)
  inflectionCents?: number; // Padrão: 12.0 cents (ponto de inflexão sigmoidal)
  sigmoidSlope?: number; // Padrão: 4.0
  deadbandCents?: number; // Padrão: 0.25 cents (zona morta de micro-ruído)
  hysteresisCents?: number; // Padrão: 65.0 cents (Schmitt Trigger de nota)
  confirmationFrames?: number; // Padrão: 4 frames consecutivos
  decayFreezeMs?: number; // Padrão: 400 ms (congelamento gracioso no silêncio)
}

export interface ChordResult {
  chordId: string;
  displayName: string;
  confidence: number; // 0.0 to 1.0 (cosine similarity)
  chromagram: Float32Array; // 12-class PCP vector (reused)
  rms: number;
  isGateOpen: boolean;
}

export interface NoiseGateConfig {
  thresholdOpen: number; // e.g. 0.015 (~ -36.5 dBFS)
  thresholdClose: number; // e.g. 0.0075 (~ -42.5 dBFS, 6 dB lower)
  attackTimeMs?: number; // default 5ms
  releaseTimeMs?: number; // default 120ms
}
