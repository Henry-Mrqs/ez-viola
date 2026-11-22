/**
 * Pitch and MIDI conversion utilities for strict, accurate note validation
 * in EzViola game engine and practice modes.
 */

const SEMITONE_MAP: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

/**
 * Converts scientific pitch notation (e.g. "E2", "G3", "C#4") to MIDI note number.
 * E2 = 40, A2 = 45, D3 = 50, G3 = 55, B3 = 59, E4 = 64
 */
export function pitchToMidi(pitch: string): number {
  const match = pitch.trim().match(/^([A-Ga-g][#b]?)([0-9])$/);
  if (!match) return -1;

  const noteName = match[1].toUpperCase();
  const octave = parseInt(match[2], 10);
  const semitone = SEMITONE_MAP[noteName];
  if (semitone === undefined) return -1;

  // MIDI 69 = A4 (440 Hz) -> Octave 4, semitone 9 -> 12 * (4 + 1) + 9 = 69
  return 12 * (octave + 1) + semitone;
}

/**
 * Validates whether the live audio detected from TunerEngine legitimately matches
 * the expected target pitch from the song timeline.
 *
 * Prevents false positives where ANY in-tune note was mistakenly validated as correct.
 */
export function isSingleNoteMatch(
  targetPitch: string,
  detectedNoteName: string,
  detectedMidiNote: number,
  detectedCents: number,
  toleranceCents: number = 55
): { isMatch: boolean; confidence: number } {
  if (!detectedNoteName || detectedNoteName === "-" || detectedMidiNote <= 0) {
    return { isMatch: false, confidence: 0 };
  }

  const targetMidi = pitchToMidi(targetPitch);
  if (targetMidi <= 0) {
    return { isMatch: false, confidence: 0 };
  }

  const cleanTargetNote = targetPitch.replace(/[0-9]/g, "").toUpperCase();
  const cleanDetected = detectedNoteName.toUpperCase();

  // 1. Exact MIDI note match (e.g. G3 = 55 matches G3 = 55)
  const isExactMidi = Math.abs(detectedMidiNote - targetMidi) <= 0;

  // 2. Octave harmonic match (e.g. G4 = 67 when G3 = 55 is expected, due to 2nd harmonic)
  const midiDiff = Math.abs(detectedMidiNote - targetMidi);
  const isOctaveHarmonic = midiDiff === 12 || midiDiff === 24;

  const isNoteNameMatch = cleanTargetNote === cleanDetected;

  if (isExactMidi || (isNoteNameMatch && (isOctaveHarmonic || midiDiff <= 1))) {
    const absCents = Math.abs(detectedCents);
    if (absCents <= toleranceCents) {
      const confidence = Math.max(0.65, 1.0 - (absCents / toleranceCents) * 0.35);
      return { isMatch: true, confidence };
    }
  }

  return { isMatch: false, confidence: 0 };
}
