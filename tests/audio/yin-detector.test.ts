import { describe, it, expect } from "vitest";
import { YinDetector } from "@/audio/yin-detector";
import {
  generateSineWave,
  generateHarmonicGuitarString,
} from "../helpers/synthetic-audio";

describe("YinDetector (Sub-sample Monophonic Pitch Detection)", () => {
  it("TC-01: accurately detects E2 (82.41 Hz) with high clarity", () => {
    const sampleRate = 44100;
    const yin = new YinDetector(sampleRate, 2048, 0.15);
    const buffer = generateSineWave(82.41, sampleRate, 0.1);

    const result = yin.detect(buffer);

    expect(result.frequency).toBeGreaterThanOrEqual(82.0);
    expect(result.frequency).toBeLessThanOrEqual(82.8);
    expect(result.clarity).toBeGreaterThan(0.9);
  });

  it("TC-02: detects all 6 guitar strings at 44.1 kHz and 48 kHz within 1 cent tolerance", () => {
    const strings = [
      { name: "E2", freq: 82.41 },
      { name: "A2", freq: 110.0 },
      { name: "D3", freq: 146.83 },
      { name: "G3", freq: 196.0 },
      { name: "B3", freq: 246.94 },
      { name: "E4", freq: 329.63 },
    ];

    const sampleRates = [44100, 48000];

    for (const sampleRate of sampleRates) {
      const yin = new YinDetector(sampleRate, 2048, 0.15);

      for (const s of strings) {
        const buffer = generateSineWave(s.freq, sampleRate, 0.1);
        const result = yin.detect(buffer);

        expect(result.frequency).toBeGreaterThan(0);
        // Calculate cents error: 1200 * log2(detected / target)
        const centsError = Math.abs(1200 * Math.log2(result.frequency / s.freq));
        expect(
          centsError,
          `${s.name} at ${sampleRate}Hz had error ${centsError.toFixed(2)} cents`
        ).toBeLessThan(1.0);
        expect(result.clarity).toBeGreaterThan(0.9);
      }
    }
  });

  it("TC-03: avoids octave jumps on harmonic guitar string with strong 2nd/3rd harmonics", () => {
    const sampleRate = 44100;
    const yin = new YinDetector(sampleRate, 2048, 0.15);

    // E2 with strong 2nd and 3rd harmonics (often louder than fundamental on nylon strings)
    const harmonics = [1.0, 1.4, 0.8, 0.4];
    const buffer = generateHarmonicGuitarString(82.41, harmonics, sampleRate, 0.1);

    const result = yin.detect(buffer);

    // Fundamental must be 82.41 Hz, NOT 164.82 Hz (2nd harmonic octave jump)
    expect(result.frequency).toBeGreaterThanOrEqual(81.5);
    expect(result.frequency).toBeLessThanOrEqual(83.5);
    expect(result.clarity).toBeGreaterThan(0.85);
  });

  it("TC-04: rejects white noise and returns frequency -1", () => {
    const sampleRate = 44100;
    const yin = new YinDetector(sampleRate, 2048, 0.15);

    const noiseBuffer = new Float32Array(2048);
    for (let i = 0; i < noiseBuffer.length; i++) {
      noiseBuffer[i] = (Math.random() - 0.5) * 0.5;
    }

    const result = yin.detect(noiseBuffer);
    expect(result.frequency).toBe(-1);
    expect(result.clarity).toBeLessThan(0.6);
  });
});
