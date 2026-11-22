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

  it("eliminates single-frame pick noise spikes using 5-sample median filter", () => {
    // Tuner with adaptive smoothing and median filter enabled
    const tuner = new TunerEngine(sampleRate, 2048, 0.15);

    // Frame 1, 2, 3: Steady A4 (440 Hz)
    const bufA4 = generateSineWave(440.0, sampleRate, 0.1, 0.8);
    tuner.process(bufA4);
    tuner.process(bufA4);
    const res3 = tuner.process(bufA4);
    expect(res3.noteName).toBe("A");
    expect(res3.octave).toBe(4);

    // Frame 4: Transient single-frame noise spike (e.g. pick scratch at 700 Hz, same gate)
    // Note: in YIN detection, if a spike occurs for 1 frame:
    const bufSpike = generateSineWave(448.0, sampleRate, 0.1, 0.8); // +31 cents spike
    const resSpike = tuner.process(bufSpike);

    // Median filter rejects the spike because median of [440, 440, 440, 448] is 440!
    expect(resSpike.smoothedFrequency).toBeCloseTo(440.0, 0.5);
  });

  it("folds harmonics (2x, 3x) back to fundamental when target string is locked", () => {
    const tuner = new TunerEngine(sampleRate, 2048, 1.0);
    // Lock String 6 (E2 = 82.41 Hz)
    tuner.setTargetString(6);

    // Input is 2nd harmonic (164.82 Hz)
    const buf2nd = generateSineWave(164.82, sampleRate, 0.1, 0.8);
    const res2nd = tuner.process(buf2nd);
    expect(res2nd.targetFrequency).toBeCloseTo(82.41, 1);
    expect(res2nd.noteName).toBe("E");
    expect(res2nd.octave).toBe(2);
    expect(res2nd.stringIndex).toBe(0);
    expect(res2nd.inTune).toBe(true);

    // Input is 3rd harmonic (247.23 Hz)
    const buf3rd = generateSineWave(247.23, sampleRate, 0.1, 0.8);
    const res3rd = tuner.process(buf3rd);
    expect(res3rd.targetFrequency).toBeCloseTo(82.41, 1);
    expect(res3rd.noteName).toBe("E");
    expect(res3rd.octave).toBe(2);
    expect(res3rd.stringIndex).toBe(0);
    expect(res3rd.inTune).toBe(true);
  });

  it("folds open string octave doubling in guitarMode without string lock", () => {
    const tuner = new TunerEngine(sampleRate, 2048, 1.0);
    expect(tuner.isGuitarMode()).toBe(true);

    // 164.82 Hz (E3) is not an open string, folds to E2
    const bufE3 = generateSineWave(164.82, sampleRate, 0.1, 0.8);
    const resE = tuner.process(bufE3);
    expect(resE.noteName).toBe("E");
    expect(resE.octave).toBe(2);
    expect(resE.stringIndex).toBe(0); // E2

    // 220.00 Hz (A3) is not an open string, folds to A2
    const bufA3 = generateSineWave(220.00, sampleRate, 0.1, 0.8);
    const resA = tuner.process(bufA3);
    expect(resA.noteName).toBe("A");
    expect(resA.octave).toBe(2);
    expect(resA.stringIndex).toBe(1); // A2
  });

  it("applies adaptive EWMA with high stability on steady note and fast transition on note change", () => {
    const tuner = new TunerEngine(sampleRate, 2048, 0.15);
    expect(tuner.isAdaptiveSmoothing()).toBe(true);

    // Play E2 (82.41 Hz) over several frames until stable
    const bufE2 = generateSineWave(82.41, sampleRate, 0.1, 0.8);
    for (let i = 0; i < 8; i++) {
      tuner.process(bufE2, 16.6);
    }
    const resE2 = tuner.process(bufE2, 16.6);
    expect(resE2.noteName).toBe("E");
    expect(resE2.smoothedFrequency).toBeCloseTo(82.41, 0.5);

    // Switch to A2 (110.00 Hz) - immediate responsiveness via note change alpha = 0.80
    const bufA2 = generateSineWave(110.00, sampleRate, 0.1, 0.8);
    const resA2 = tuner.process(bufA2, 16.6);
    expect(resA2.noteName).toBe("A");
    expect(resA2.octave).toBe(2);
    // With alpha=0.80, jumps immediately from 82.41 to > 100 Hz in one frame
    expect(resA2.smoothedFrequency).toBeGreaterThan(100.0);
  });

  it("suppresses transient pick impact pitch-glide (+35 cents) via 60ms Attack Blanking", () => {
    const tuner = new TunerEngine(sampleRate, 2048, 0.15);

    // Initial steady A4 (440 Hz)
    const bufA4 = generateSineWave(440.0, sampleRate, 0.1, 0.8);
    for (let i = 0; i < 5; i++) {
      tuner.process(bufA4, 16.6);
    }
    const stableRes = tuner.process(bufA4, 16.6);
    expect(Math.abs(stableRes.cents)).toBeLessThan(1.0);

    // Sudden attack spike onset (+35 cents = ~448.97 Hz) with high amplitude
    // Initial 40ms (< 60ms attack blanking window)
    const bufSpike = generateSineWave(448.97, sampleRate, 0.1, 1.0);
    const spikeRes1 = tuner.process(bufSpike, 20.0);
    expect(spikeRes1.isAttackBlanking).toBe(true);
    // Cents should remain frozen / suppressed, NOT reporting the +35 cents overshoot
    expect(spikeRes1.cents).toBeLessThan(10.0);

    const spikeRes2 = tuner.process(bufSpike, 20.0);
    expect(spikeRes2.isAttackBlanking).toBe(true);
    expect(spikeRes2.cents).toBeLessThan(10.0);
  });
});
