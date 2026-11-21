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

export interface TunerResult {
  frequency: number; // -1 if silence or unpitched
  smoothedFrequency: number;
  targetFrequency: number;
  noteName: string;
  octave: number;
  midiNote: number;
  cents: number; // -50 to +50
  inTune: boolean; // Math.abs(cents) <= 5.0
  clarity: number; // 0.0 to 1.0
  rms: number;
  isGateOpen: boolean;
  stringIndex: number; // 0..5 index into GUITAR_STRINGS, or -1 if outside
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
