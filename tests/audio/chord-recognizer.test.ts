import { describe, it, expect } from "vitest";
import { ChordRecognizer } from "@/audio/chord-recognizer";
import { generateFftFromFrequencies } from "../helpers/synthetic-audio";

describe("ChordRecognizer (4096-bin FFT -> 12-PCP Chromagram -> Cosine Similarity)", () => {
  const sampleRate = 44100;
  const fftSize = 4096;

  it("discriminates accurately between Em and G", () => {
    const recognizer = new ChordRecognizer(sampleRate, fftSize, 0.7, 1);

    // Em notes: E2(82.41), B2(123.47), E3(164.81), G3(196.0), B3(246.94), E4(329.63)
    const emFreqs = [82.41, 123.47, 164.81, 196.0, 246.94, 329.63];
    const emFft = generateFftFromFrequencies(emFreqs, sampleRate, fftSize);
    const emResult = recognizer.processSpectrum(emFft, true, 0.05);

    expect(emResult.chordId).toBe("Em");
    expect(emResult.confidence).toBeGreaterThan(0.75);

    // G notes: G2(98.0), B2(123.47), D3(146.83), G3(196.0), B3(246.94), G4(392.0)
    const gFreqs = [98.0, 123.47, 146.83, 196.0, 246.94, 392.0];
    const gFft = generateFftFromFrequencies(gFreqs, sampleRate, fftSize);
    const gResult = recognizer.processSpectrum(gFft, true, 0.05);

    expect(gResult.chordId).toBe("G");
    expect(gResult.confidence).toBeGreaterThan(0.75);
  });

  it("discriminates accurately between C and Am7 (Validation Section 4.2)", () => {
    const recognizer = new ChordRecognizer(sampleRate, fftSize, 0.7, 1);

    // C notes: C3(130.81), E3(164.81), G3(196.0), C4(261.63), E4(329.63)
    const cFreqs = [130.81, 164.81, 196.0, 261.63, 329.63];
    const cFft = generateFftFromFrequencies(cFreqs, sampleRate, fftSize);
    const cResult = recognizer.processSpectrum(cFft, true, 0.05);

    expect(cResult.chordId).toBe("C");
    expect(cResult.confidence).toBeGreaterThan(0.75);

    // Am7 notes: A2(110.0), E3(164.81), G3(196.0), C4(261.63), E4(329.63)
    const am7Freqs = [110.0, 164.81, 196.0, 261.63, 329.63];
    const am7Fft = generateFftFromFrequencies(am7Freqs, sampleRate, fftSize);
    const am7Result = recognizer.processSpectrum(am7Fft, true, 0.05);

    expect(am7Result.chordId).toBe("Am7");
    expect(am7Result.confidence).toBeGreaterThan(0.75);
  });

  it("recognizes D6add9_Fsharp from America's 'Horse with No Name'", () => {
    const recognizer = new ChordRecognizer(sampleRate, fftSize, 0.7, 1);

    // D6add9/F# notes: F#2(92.5), A2(110.0), D3(146.83), A3(220.0), B3(246.94), E4(329.63)
    const d6Freqs = [92.5, 110.0, 146.83, 220.0, 246.94, 329.63];
    const d6Fft = generateFftFromFrequencies(d6Freqs, sampleRate, fftSize);
    const result = recognizer.processSpectrum(d6Fft, true, 0.05);

    expect(result.chordId).toBe("D6add9_Fsharp");
    expect(result.confidence).toBeGreaterThan(0.75);
  });

  it("respects active chord filtering to optimize matching within song scope", () => {
    const recognizer = new ChordRecognizer(sampleRate, fftSize, 0.7, 1);
    recognizer.setActiveChords(["Em", "D6add9_Fsharp"]);

    const emFreqs = [82.41, 123.47, 164.81, 196.0, 246.94, 329.63];
    const emFft = generateFftFromFrequencies(emFreqs, sampleRate, fftSize);
    const emResult = recognizer.processSpectrum(emFft, true, 0.05);

    expect(emResult.chordId).toBe("Em");
  });

  it("resets to NO_CHORD when gate is closed or signal is silent", () => {
    const recognizer = new ChordRecognizer(sampleRate, fftSize, 0.7, 1);
    const emptyFft = new Float32Array(fftSize / 2).fill(-90);

    const result = recognizer.processSpectrum(emptyFft, false, 0.001);
    expect(result.chordId).toBe("NO_CHORD");
    expect(result.confidence).toBe(0);
  });

  it("executes processSpectrum() in less than 1.5ms budget", () => {
    const recognizer = new ChordRecognizer(sampleRate, fftSize, 0.7, 1);
    const emFreqs = [82.41, 123.47, 164.81, 196.0, 246.94, 329.63];
    const emFft = generateFftFromFrequencies(emFreqs, sampleRate, fftSize);

    // Warm-up JIT
    for (let i = 0; i < 50; i++) {
      recognizer.processSpectrum(emFft, true, 0.05);
    }

    const iterations = 100;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      recognizer.processSpectrum(emFft, true, 0.05);
    }
    const elapsedMs = performance.now() - start;
    const avgMs = elapsedMs / iterations;

    expect(avgMs).toBeLessThan(1.5);
  });
});
