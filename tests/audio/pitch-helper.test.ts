import { describe, it, expect } from "vitest";
import { pitchToMidi, isSingleNoteMatch } from "@/audio/pitch-helper";

describe("Pitch Helper & Note Match Validation", () => {
  it("converts guitar string pitches to exact standard MIDI notes", () => {
    expect(pitchToMidi("E2")).toBe(40);
    expect(pitchToMidi("A2")).toBe(45);
    expect(pitchToMidi("D3")).toBe(50);
    expect(pitchToMidi("G3")).toBe(55);
    expect(pitchToMidi("B3")).toBe(59);
    expect(pitchToMidi("E4")).toBe(64);
  });

  it("validates legitimate pitch matches within tolerance", () => {
    // Exact G3 match
    const result = isSingleNoteMatch("G3", "G", 55, 4);
    expect(result.isMatch).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.9);

    // G4 harmonic match for G3
    const harmonicResult = isSingleNoteMatch("G3", "G", 67, -5);
    expect(harmonicResult.isMatch).toBe(true);
  });

  it("strictly rejects false positive notes (e.g. playing E2 when G3 or D3 is expected)", () => {
    // User plays E2 (MIDI 40) in tune (cents 0), but song wanted G3 (MIDI 55)
    const falseResult = isSingleNoteMatch("G3", "E", 40, 0);
    expect(falseResult.isMatch).toBe(false);
    expect(falseResult.confidence).toBe(0);

    // User plays A2 (MIDI 45) in tune, but song wanted D3 (MIDI 50)
    const falseResult2 = isSingleNoteMatch("D3", "A", 45, 2);
    expect(falseResult2.isMatch).toBe(false);
  });
});
