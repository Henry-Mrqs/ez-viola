/**
 * Weighted and L2-Normalized Chord Templates for 12-PCP Chromagram matching.
 * Provides discriminant weights for Root, Thirds, Fifths, Sevenths, and custom catalog chords.
 */

export interface ChordTemplate {
  chordId: string;
  displayName: string;
  root: number; // 0..11
  vector: Float32Array; // L2-normalized 12-element vector
}

export const PITCH_CLASSES = [
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

/**
 * Normalizes a 12-element vector to unit Euclidean length (L2 norm = 1.0)
 */
function normalizeL2(vec: Float32Array): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < 12; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm > 1e-9) {
    for (let i = 0; i < 12; i++) {
      vec[i] /= norm;
    }
  }
  return vec;
}

/**
 * Builds all L2-normalized chord templates used in EzViola.
 */
export function buildChordTemplates(): ChordTemplate[] {
  const templates: ChordTemplate[] = [];

  // Helper to create template
  const addTemplate = (
    chordId: string,
    displayName: string,
    root: number,
    intervals: { semitone: number; weight: number }[]
  ) => {
    const vec = new Float32Array(12);
    for (const { semitone, weight } of intervals) {
      const pitchClass = (root + semitone) % 12;
      vec[pitchClass] = Math.max(vec[pitchClass], weight);
    }
    normalizeL2(vec);
    templates.push({
      chordId,
      displayName,
      root,
      vector: vec,
    });
  };

  // 1. Major Triades (12 chords): Root(1.0), Major 3rd(0.85), 5th(0.70)
  for (let r = 0; r < 12; r++) {
    const rootName = PITCH_CLASSES[r];
    addTemplate(rootName, `${rootName} maior`, r, [
      { semitone: 0, weight: 1.0 },
      { semitone: 4, weight: 0.85 },
      { semitone: 7, weight: 0.7 },
    ]);
  }

  // 2. Minor Triades (12 chords): Root(1.0), Minor 3rd(0.85), 5th(0.70)
  for (let r = 0; r < 12; r++) {
    const rootName = PITCH_CLASSES[r];
    addTemplate(`${rootName}m`, `${rootName} menor`, r, [
      { semitone: 0, weight: 1.0 },
      { semitone: 3, weight: 0.85 },
      { semitone: 7, weight: 0.7 },
    ]);
  }

  // 3. Dominant 7th (12 chords): Root(1.0), Major 3rd(0.85), 5th(0.70), Minor 7th(0.60)
  for (let r = 0; r < 12; r++) {
    const rootName = PITCH_CLASSES[r];
    addTemplate(`${rootName}7`, `${rootName} com 7ª`, r, [
      { semitone: 0, weight: 1.0 },
      { semitone: 4, weight: 0.85 },
      { semitone: 7, weight: 0.7 },
      { semitone: 10, weight: 0.6 },
    ]);
  }

  // 4. Minor 7th (12 chords): Root(1.0), Minor 3rd(0.85), 5th(0.70), Minor 7th(0.60)
  for (let r = 0; r < 12; r++) {
    const rootName = PITCH_CLASSES[r];
    addTemplate(`${rootName}m7`, `${rootName} menor com 7ª`, r, [
      { semitone: 0, weight: 1.0 },
      { semitone: 3, weight: 0.85 },
      { semitone: 7, weight: 0.7 },
      { semitone: 10, weight: 0.6 },
    ]);
  }

  // 5. Special Catalog Chord: D6add9/F# (America - "A Horse with No Name")
  // Notes: F# (6), A (9), D (2), B (11), E (4)
  const d6add9Vec = new Float32Array(12);
  d6add9Vec[2] = 1.0; // D (Root)
  d6add9Vec[6] = 0.85; // F# (3rd in bass)
  d6add9Vec[9] = 0.7; // A (5th)
  d6add9Vec[11] = 0.55; // B (6th)
  d6add9Vec[4] = 0.7; // E (9th - ringing open string)
  normalizeL2(d6add9Vec);
  templates.push({
    chordId: "D6add9_Fsharp",
    displayName: "D6add9/F#",
    root: 2,
    vector: d6add9Vec,
  });

  // Alias for Bm7_easy matching Bm7 template
  const bm7Template = templates.find((t) => t.chordId === "Bm7");
  if (bm7Template) {
    templates.push({
      chordId: "Bm7_easy",
      displayName: "Bm7 (Fácil)",
      root: bm7Template.root,
      vector: new Float32Array(bm7Template.vector),
    });
  }

  return templates;
}

export const ALL_CHORD_TEMPLATES: readonly ChordTemplate[] = buildChordTemplates();
