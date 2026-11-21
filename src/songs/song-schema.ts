/**
 * Canonical TypeScript definitions and runtime schema validator for songs and exercises.
 * Based on Draft-07 JSON Schema specified in ux-and-songs-specification.md.
 */

export type GuitarTuning = [string, string, string, string, string, string]; // [E2, A2, D3, G3, B3, E4]

export type FingerNumber = 0 | 1 | 2 | 3 | 4; // 0: None/Open, 1: Index, 2: Middle, 3: Ring, 4: Pinky
export type PluckingFinger = "P" | "I" | "M" | "A"; // Thumb, Index, Middle, Ring

export interface BarreDefinition {
  fret: number;
  fromString: number; // 1 to 6 (6 = low E, 1 = high E)
  toString: number;
  finger: FingerNumber;
}

export interface ChordDefinition {
  chordId: string;
  displayName: string;
  baseFret: number;
  frets: [number, number, number, number, number, number]; // -1 = muted/x, 0 = open, >0 = fret
  fingers: [FingerNumber, FingerNumber, FingerNumber, FingerNumber, FingerNumber, FingerNumber];
  barres?: BarreDefinition[];
  notes?: string[];
}

export interface SingleNoteEvent {
  string: number; // 1 to 6
  fret: number; // 0 to 24
  pitch: string; // e.g. "E2", "G3"
  finger?: FingerNumber;
  hand?: PluckingFinger;
}

export type TimelineEventType = "chord" | "single-note" | "rest" | "arpeggio";
export type StrumDirection = "down" | "up" | "none";

export interface TimelineEvent {
  id: string;
  timeSec: number;
  beat: number;
  measure: number;
  durationBeats: number;
  durationSec: number;
  type: TimelineEventType;
  chordId?: string;
  strumDirection?: StrumDirection;
  notes?: SingleNoteEvent[];
  lyrics?: string;
}

export interface SongSchema {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre: "Exercise" | "Folk" | "Rock" | "Pop" | "MPB" | "Classical" | "Blues";
  difficulty: "beginner" | "elementary" | "intermediate" | "advanced";
  difficultyRating: number; // 1 to 5
  bpm: number;
  timeSignature: {
    numerator: number;
    denominator: number;
  };
  durationSec: number;
  capo: number;
  tuning: GuitarTuning;
  chordsUsed: Record<string, ChordDefinition>;
  timeline: TimelineEvent[];
}

/**
 * Validates that an object strictly complies with SongSchema at runtime.
 * Throws a descriptive Error if any required field or structural invariant is violated.
 */
export function validateSongSchema(data: unknown): SongSchema {
  if (!data || typeof data !== "object") {
    throw new Error("Song data must be a non-null object");
  }

  const s = data as Partial<SongSchema>;

  if (typeof s.id !== "string" || !/^[a-z0-9-]+$/.test(s.id)) {
    throw new Error(`Invalid or missing 'id' in song: ${s.id}`);
  }
  if (typeof s.title !== "string" || s.title.trim().length === 0) {
    throw new Error(`Invalid or missing 'title' in song ${s.id}`);
  }
  if (typeof s.artist !== "string") {
    throw new Error(`Missing 'artist' in song ${s.id}`);
  }
  if (typeof s.bpm !== "number" || s.bpm < 30 || s.bpm > 280) {
    throw new Error(`Invalid 'bpm' in song ${s.id}: ${s.bpm}`);
  }
  if (
    !s.timeSignature ||
    typeof s.timeSignature.numerator !== "number" ||
    typeof s.timeSignature.denominator !== "number"
  ) {
    throw new Error(`Invalid 'timeSignature' in song ${s.id}`);
  }
  if (typeof s.durationSec !== "number" || s.durationSec <= 0) {
    throw new Error(`Invalid 'durationSec' in song ${s.id}`);
  }
  if (!Array.isArray(s.tuning) || s.tuning.length !== 6) {
    throw new Error(`Invalid 'tuning' in song ${s.id}: must be 6 strings`);
  }
  if (!s.chordsUsed || typeof s.chordsUsed !== "object") {
    throw new Error(`Invalid 'chordsUsed' in song ${s.id}`);
  }
  if (!Array.isArray(s.timeline) || s.timeline.length === 0) {
    throw new Error(`'timeline' must be a non-empty array in song ${s.id}`);
  }

  // Validate chordsUsed entries
  for (const [chordKey, chord] of Object.entries(s.chordsUsed)) {
    if (!chord || typeof chord !== "object") {
      throw new Error(`Chord '${chordKey}' in ${s.id} is not an object`);
    }
    if (!Array.isArray(chord.frets) || chord.frets.length !== 6) {
      throw new Error(`Chord '${chordKey}' frets must have exactly 6 values`);
    }
    if (!Array.isArray(chord.fingers) || chord.fingers.length !== 6) {
      throw new Error(`Chord '${chordKey}' fingers must have exactly 6 values`);
    }
  }

  // Validate timeline events
  let lastTime = -1;
  for (let i = 0; i < s.timeline.length; i++) {
    const ev = s.timeline[i];
    if (typeof ev.id !== "string") {
      throw new Error(`Timeline event at index ${i} in ${s.id} missing id`);
    }
    if (typeof ev.timeSec !== "number" || ev.timeSec < 0) {
      throw new Error(`Event ${ev.id} in ${s.id} has invalid timeSec: ${ev.timeSec}`);
    }
    if (ev.timeSec < lastTime) {
      throw new Error(`Event ${ev.id} in ${s.id} is out of chronological order`);
    }
    lastTime = ev.timeSec;

    if (typeof ev.durationSec !== "number" || ev.durationSec <= 0) {
      throw new Error(`Event ${ev.id} has invalid durationSec`);
    }

    if (ev.type === "chord") {
      if (!ev.chordId || !s.chordsUsed[ev.chordId]) {
        throw new Error(`Event ${ev.id} references undefined chordId: ${ev.chordId}`);
      }
    } else if (ev.type === "single-note") {
      if (!Array.isArray(ev.notes) || ev.notes.length === 0) {
        throw new Error(`Single-note event ${ev.id} must contain notes array`);
      }
      for (const n of ev.notes) {
        if (n.string < 1 || n.string > 6) {
          throw new Error(`Event ${ev.id} note string must be between 1 and 6`);
        }
        if (n.fret < 0 || n.fret > 24) {
          throw new Error(`Event ${ev.id} note fret must be between 0 and 24`);
        }
      }
    }
  }

  return s as SongSchema;
}
