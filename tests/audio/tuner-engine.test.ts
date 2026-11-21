import { describe, it, expect } from "vitest";
import { TunerEngine } from "@/audio/tuner-engine";
import { generateSineWave } from "../helpers/synthetic-audio";

describe("TunerEngine (EWMA Smoothing, Cents, and String Identification)", () => {
  const sampleRate = 44100;

  it("detects exact 440.0 Hz as Note A4 with 0.0 cents and inTune = true", () => {
    const tuner = new TunerEngine(sampleRate, 2048, 1.0); // alpha=1.0 for immediate response in test
    const buffer = generateSineWave(440.0, sampleRate, 0.1, 0.8);

    const result = tuner.process(buffer);

    expect(result.isGateOpen).toBe(true);
    expect(result.noteName).toBe("A");
    expect(result.octave).toBe(4);
    expect(result.midiNote).toBe(69);
    expect(result.targetFrequency).toBeCloseTo(440.0, 1);
    expect(Math.abs(result.cents)).toBeLessThan(1.0);
    expect(result.inTune).toBe(true);
  });

  it("evaluates inTune = true at +4.5 cents and inTune = false at +10 cents", () => {
    const tuner = new TunerEngine(sampleRate, 2048, 1.0);

    // +4.5 cents above 440 Hz = 440 * 2^(4.5/1200) ~ 441.144 Hz
    const freq4_5c = 440 * Math.pow(2, 4.5 / 1200);
    const bufInTune = generateSineWave(freq4_5c, sampleRate, 0.1, 0.8);
    const resInTune = tuner.process(bufInTune);

    expect(resInTune.noteName).toBe("A");
    expect(resInTune.cents).toBeCloseTo(4.5, 0.5);
    expect(resInTune.inTune).toBe(true);

    // +10 cents above 440 Hz = 440 * 2^(10/1200) ~ 442.548 Hz
    const freq10c = 440 * Math.pow(2, 10 / 1200);
    const bufOutOfTune = generateSineWave(freq10c, sampleRate, 0.1, 0.8);
    const resOutOfTune = tuner.process(bufOutOfTune);

    expect(resOutOfTune.noteName).toBe("A");
    expect(resOutOfTune.cents).toBeCloseTo(10, 0.5);
    expect(resOutOfTune.inTune).toBe(false);
  });

  it("identifies all 6 standard guitar strings with proper stringIndex", () => {
    const tuner = new TunerEngine(sampleRate, 2048, 1.0);
    const guitarTests = [
      { freq: 82.41, expectedName: "E", octave: 2, expectedIndex: 0 }, // E2 = 6th string
      { freq: 110.0, expectedName: "A", octave: 2, expectedIndex: 1 }, // A2 = 5th string
      { freq: 146.83, expectedName: "D", octave: 3, expectedIndex: 2 }, // D3 = 4th string
      { freq: 196.0, expectedName: "G", octave: 3, expectedIndex: 3 }, // G3 = 3rd string
      { freq: 246.94, expectedName: "B", octave: 3, expectedIndex: 4 }, // B3 = 2nd string
      { freq: 329.63, expectedName: "E", octave: 4, expectedIndex: 5 }, // E4 = 1st string
    ];

    for (const test of guitarTests) {
      const buffer = generateSineWave(test.freq, sampleRate, 0.1, 0.8);
      const res = tuner.process(buffer);

      expect(res.noteName).toBe(test.expectedName);
      expect(res.octave).toBe(test.octave);
      expect(res.stringIndex).toBe(test.expectedIndex);
      expect(res.inTune).toBe(true);
    }
  });

  it("smooths fluctuations using EWMA filter", () => {
    const alpha = 0.35;
    const tuner = new TunerEngine(sampleRate, 2048, alpha);

    // First frame: 440 Hz
    const buf1 = generateSineWave(440, sampleRate, 0.1, 0.8);
    const res1 = tuner.process(buf1);
    expect(res1.smoothedFrequency).toBeCloseTo(440, 0.5);

    // Second frame: slight jitter to 444 Hz
    const buf2 = generateSineWave(444, sampleRate, 0.1, 0.8);
    const res2 = tuner.process(buf2);
    // Expected smoothed = 0.35 * 444 + 0.65 * 440 = 155.4 + 286 = 441.4 Hz
    expect(res2.smoothedFrequency).toBeLessThan(443);
    expect(res2.smoothedFrequency).toBeGreaterThan(440.5);
  });

  it("handles string locking correctly", () => {
    const tuner = new TunerEngine(sampleRate, 2048, 1.0);
    // Lock to string 6 (E2, target 82.41 Hz)
    tuner.setTargetString(6);

    // Slightly flat E2 (80.0 Hz)
    const flatBuffer = generateSineWave(80.0, sampleRate, 0.1, 0.8);
    const res = tuner.process(flatBuffer);

    expect(res.targetFrequency).toBeCloseTo(82.41, 1);
    expect(res.noteName).toBe("E");
    expect(res.octave).toBe(2);
    expect(res.cents).toBeLessThan(-5); // flat
  });
});
