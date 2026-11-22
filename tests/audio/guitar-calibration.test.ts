import { describe, it, expect, beforeEach } from "vitest";
import {
  GuitarCalibrationService,
  GuitarCalibrationProfile,
} from "@/audio/guitar-calibration";
import { TunerEngine } from "@/audio/tuner-engine";
import { ChordRecognizer } from "@/audio/chord-recognizer";
import {
  generateSineWave,
  generateFftFromFrequencies,
} from "../helpers/synthetic-audio";

describe("GuitarCalibrationService (Web Audio Acoustic Calibration Engine)", () => {
  const sampleRate = 44100;
  const fftSize = 4096;

  beforeEach(() => {
    GuitarCalibrationService.clearProfile();
  });

  it("captures string frequency, cents offset, clarity, and harmonics accurately for E2", () => {
    // 1. Generate E2 fundamental (82.41 Hz) + harmonics at 164.8, 247.2, 329.6
    const timeBuffer = generateSineWave(82.41, sampleRate, 0.1, 0.8);
    const freqBuffer = generateFftFromFrequencies([82.41], sampleRate, fftSize);

    const stringData = GuitarCalibrationService.captureString(
      timeBuffer,
      freqBuffer,
      sampleRate,
      6
    );

    expect(stringData.stringNumber).toBe(6);
    expect(stringData.name).toBe("E2");
    expect(stringData.targetFrequency).toBe(82.41);
    expect(stringData.measuredFrequency).toBeCloseTo(82.41, 1);
    expect(Math.abs(stringData.centsOffset)).toBeLessThanOrEqual(2.0);
    expect(stringData.clarity).toBeGreaterThan(0.9);
    expect(stringData.harmonics.length).toBeGreaterThanOrEqual(3);

    // Fundamental (H1) in FFT bin
    expect(stringData.harmonics[0].frequency).toBeGreaterThan(80);
    expect(stringData.harmonics[0].frequency).toBeLessThan(90);
  });

  it("detects sharp pitch deviation (+cents) when string is out of tune", () => {
    // A2 standard is 110.0 Hz. Play 112.5 Hz (+39 cents sharp)
    const timeBuffer = generateSineWave(112.5, sampleRate, 0.1, 0.8);
    const freqBuffer = generateFftFromFrequencies([112.5], sampleRate, fftSize);

    const stringData = GuitarCalibrationService.captureString(
      timeBuffer,
      freqBuffer,
      sampleRate,
      5
    );

    expect(stringData.stringNumber).toBe(5);
    expect(stringData.name).toBe("A2");
    expect(stringData.targetFrequency).toBe(110.0);
    expect(stringData.measuredFrequency).toBeCloseTo(112.5, 1);
    expect(stringData.centsOffset).toBeGreaterThan(30);
  });

  it("captures normalized 12-class chromagram for acoustic chords", () => {
    // Em freqs: E2(82.41), B2(123.47), E3(164.81), G3(196.0), B3(246.94), E4(329.63)
    const emFreqs = [82.41, 123.47, 164.81, 196.0, 246.94, 329.63];
    const fft = generateFftFromFrequencies(emFreqs, sampleRate, fftSize);

    const chordData = GuitarCalibrationService.captureChord(
      fft,
      sampleRate,
      "Em",
      "Mi Menor"
    );

    expect(chordData.chordId).toBe("Em");
    expect(chordData.displayName).toBe("Mi Menor");
    expect(chordData.chromagram).toHaveLength(12);

    // Check L2 normalization of captured chromagram
    let sumSq = 0;
    for (const v of chordData.chromagram) sumSq += v * v;
    expect(Math.sqrt(sumSq)).toBeCloseTo(1.0, 1);

    // E (pitch class 4), G (7), B (11) must have highest energy
    expect(chordData.chromagram[4]).toBeGreaterThan(0.3); // E
    expect(chordData.chromagram[7]).toBeGreaterThan(0.2); // G
    expect(chordData.chromagram[11]).toBeGreaterThan(0.2); // B
  });

  it("saves, loads, updates and clears profile in localStorage", () => {
    const timeBuffer = generateSineWave(110.0, sampleRate, 0.1, 0.8);
    const freqBuffer = generateFftFromFrequencies([110.0], sampleRate, fftSize);

    const str5 = GuitarCalibrationService.captureString(
      timeBuffer,
      freqBuffer,
      sampleRate,
      5
    );

    GuitarCalibrationService.updateStringCalibration(str5);

    const loaded = GuitarCalibrationService.loadProfile();
    expect(loaded).toBeDefined();
    expect(loaded?.strings[5]).toBeDefined();
    expect(loaded?.strings[5].name).toBe("A2");

    // Add chord calibration
    const chord = GuitarCalibrationService.captureChord(
      freqBuffer,
      sampleRate,
      "A",
      "Lá Maior"
    );
    GuitarCalibrationService.updateChordCalibration(chord);

    const loadedWithChord = GuitarCalibrationService.loadProfile();
    expect(loadedWithChord?.chords["A"]).toBeDefined();
    expect(loadedWithChord?.chords["A"].displayName).toBe("Lá Maior");

    // Clear
    GuitarCalibrationService.clearProfile();
    expect(GuitarCalibrationService.loadProfile()).toBeNull();
  });

  it("generates a human-readable diagnostic report with exact Hz and copyable JSON", () => {
    const timeBuffer = generateSineWave(82.41, sampleRate, 0.1, 0.8);
    const freqBuffer = generateFftFromFrequencies([82.41], sampleRate, fftSize);

    const str6 = GuitarCalibrationService.captureString(
      timeBuffer,
      freqBuffer,
      sampleRate,
      6
    );
    GuitarCalibrationService.updateStringCalibration(str6);

    const chordEm = GuitarCalibrationService.captureChord(
      freqBuffer,
      sampleRate,
      "Em",
      "Em maior/menor"
    );
    GuitarCalibrationService.updateChordCalibration(chordEm);

    const report = GuitarCalibrationService.generateDiagnosticReport();
    expect(report).toContain("EZVIOLA - RELATÓRIO DE CALIBRAÇÃO");
    expect(report).toContain("Corda 6 (E2)");
    expect(report).toContain("82.41 Hz");
    expect(report).toContain("[Em] Em maior/menor");
    expect(report).toContain("PAYLOAD JSON");

    // Parse JSON portion inside report
    const jsonMatch = report.match(/\{[\s\S]*\}/);
    expect(jsonMatch).not.toBeNull();
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      expect(parsed.strings[6]).toBeDefined();
      expect(parsed.chords["Em"]).toBeDefined();
    }
  });

  it("updates ChordRecognizer template vectors when calibrated profile is applied", () => {
    const recognizer = new ChordRecognizer(sampleRate, fftSize, 0.58, 1);

    // Custom calibration for C with boosted custom vector
    const customVec = new Array(12).fill(0);
    customVec[0] = 1.0; // Pure C
    const customProfile: GuitarCalibrationProfile = {
      version: 1,
      updatedAt: Date.now(),
      strings: {},
      chords: {
        C: {
          chordId: "C",
          displayName: "Dó Custom",
          chromagram: customVec,
          capturedAt: Date.now(),
        },
      },
    };

    recognizer.setCalibrationProfile(customProfile);

    // Spectrum with pure C
    const cFft = generateFftFromFrequencies([261.63], sampleRate, fftSize);
    const res = recognizer.processSpectrum(cFft, true, 0.05);

    expect(res.chordId).toBe("C");
    expect(res.confidence).toBeGreaterThan(0.8);
  });

  it("integrates calibrated harmonic folding in TunerEngine", () => {
    const tuner = new TunerEngine(sampleRate, 2048, 1.0);

    // Calibrate Corda 6 (E2) with prominent 2nd harmonic (164.8 Hz)
    const customProfile: GuitarCalibrationProfile = {
      version: 1,
      updatedAt: Date.now(),
      strings: {
        6: {
          stringNumber: 6,
          name: "E2",
          targetFrequency: 82.41,
          measuredFrequency: 82.41,
          centsOffset: 0,
          harmonics: [
            { frequency: 82.41, amplitudeDb: -25 },
            { frequency: 164.82, amplitudeDb: -15 }, // Strong octave harmonic bleed
          ],
          clarity: 0.95,
        },
      },
      chords: {},
    };

    tuner.setCalibrationProfile(customProfile);

    // Play 164.82 Hz (E3) - tuner should fold to 82.41 Hz (E2)
    const buffer = generateSineWave(164.82, sampleRate, 0.1, 0.8);
    const res = tuner.process(buffer);

    expect(res.noteName).toBe("E");
    expect(res.octave).toBe(2);
    expect(res.targetFrequency).toBeCloseTo(82.41, 1);
  });
});
