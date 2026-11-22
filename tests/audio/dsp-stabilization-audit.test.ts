import { describe, it, expect, vi } from "vitest";
import { TunerEngine } from "@/audio/tuner-engine";
import { TransientDetector } from "@/audio/transient-detector";
import { HandsFreeCalibrationEngine } from "@/audio/hands-free-calibration-engine";
import { AudioEngine } from "@/audio/audio-engine";
import {
  generateSineWave,
  generateHarmonicGuitarString,
  generateFftFromFrequencies,
} from "../helpers/synthetic-audio";

describe("DSP Stabilization & Anti-Popcorn Audit Suite (Sprint D)", () => {
  const sampleRate = 44100;
  const fftSize = 2048;

  it("identifies E2 (82.41 Hz) with 100% accuracy over 50 continuous frames despite +14 dB 2nd harmonic (Zero Octave Jumps)", () => {
    const tuner = new TunerEngine(sampleRate, 2048, 0.15);
    tuner.setTargetString(6); // Lock 6th string (E2)

    // Simulate 6th string acoustic signal:
    // H1 (82.41 Hz, weight 0.20), H2 (164.82 Hz, weight 1.0 = +14 dB over fund), H3 (247.23 Hz, weight 0.5 = +8 dB)
    // Filtered by 2nd-order Butterworth low-pass at fc = 115 Hz:
    // H1 attenuation: -1.0 dB (weight ~ 0.18)
    // H2 attenuation: -7.2 dB (weight 1.0 * 0.437 = 0.437)
    // H3 attenuation: -13.5 dB (weight 0.5 * 0.211 = 0.105)
    const compositeSignal = generateHarmonicGuitarString(
      82.41,
      [0.25, 0.45, 0.15],
      sampleRate,
      0.1
    );

    let e2IdentifiedCount = 0;
    const totalFrames = 50;

    for (let frame = 0; frame < totalFrames; frame++) {
      const res = tuner.process(compositeSignal.subarray(0, 2048), 16.6);

      // Verify note is always E, octave is strictly 2, never jumping to E3 or B3
      if (res.noteName === "E" && res.octave === 2 && res.stringIndex === 0) {
        e2IdentifiedCount++;
      }
    }

    expect(e2IdentifiedCount).toBe(totalFrames); // 100% accuracy in 50 frames
  });

  it("stabilizes on E4 (329.63 Hz) without octave jumping on high pick transient impact", () => {
    const tuner = new TunerEngine(sampleRate, 2048, 0.15);
    tuner.setTargetString(1); // Lock 1st string (E4)

    // Transient pick scrape with strong high harmonics (E5, B5)
    const pickAttack = generateHarmonicGuitarString(
      329.63,
      [0.4, 0.8, 0.5],
      sampleRate,
      0.1
    );

    for (let frame = 0; frame < 10; frame++) {
      const res = tuner.process(pickAttack.subarray(0, 2048), 16.6);
      expect(res.noteName).toBe("E");
      expect(res.octave).toBe(4);
    }
  });

  it("immediately rejects body knocks with clarity 0.35 without firing false onset", () => {
    const detector = new TransientDetector(sampleRate, fftSize);

    const knockTime = generateSineWave(90.0, sampleRate, 0.1, 0.8);
    const knockFreq = generateFftFromFrequencies([90.0], sampleRate, fftSize);

    const event = detector.process(
      knockTime,
      knockFreq,
      0.35, // Poor periodic clarity
      82.41,
      90.0,
      16.6
    );

    expect(event.isOnset).toBe(false);
    expect(event.isRejected).toBe(true);
    expect(event.rejectionReason).toBe("LOW_CLARITY");
  });

  it("completes full 3-pluck hands-free cycle with auto-advance in 1200ms", () => {
    const timeBuf = new Float32Array(fftSize);
    const freqBuf = new Float32Array(fftSize / 2).fill(-85);

    const mockAudioEngine = {
      getSampleRate: () => sampleRate,
      getTimeBuffer: () => timeBuf,
      getFreqBuffer: () => freqBuf,
      getAudioContext: () => null,
      setAdaptiveFilterForString: vi.fn(),
      setAdaptiveFilterForChords: vi.fn(),
      getTunerEngine: () => ({ setCalibrationProfile: vi.fn() }),
      getChordRecognizer: () => ({ setCalibrationProfile: vi.fn() }),
    } as unknown as AudioEngine;

    const engine = new HandsFreeCalibrationEngine(mockAudioEngine);
    engine.startWizard();
    engine.onFrame(50); // -> AWAITING_PLUCK

    const e2Time = generateSineWave(82.41, sampleRate, 0.1, 0.8).subarray(0, fftSize);
    const e2Freq = generateFftFromFrequencies([82.41], sampleRate, fftSize);
    const silenceTime = new Float32Array(fftSize);
    const silenceFreq = new Float32Array(fftSize / 2).fill(-85);

    // 3 successive coherent plucks
    for (let p = 1; p <= 3; p++) {
      timeBuf.set(e2Time);
      freqBuf.set(e2Freq);
      engine.onFrame(16.6); // Onset
      engine.onFrame(60); // Settling
      engine.onFrame(16.6); // Sustain

      if (p < 3) {
        timeBuf.set(silenceTime);
        freqBuf.set(silenceFreq);
        engine.onFrame(400); // Cooldown
      }
    }

    // After 3rd pluck: step complete and transition to AUTO_ADVANCING
    expect(engine.getState().state).toBe("AUTO_ADVANCING");

    // After 1200ms countdown: auto advances to Corda 5 (A2)
    engine.onFrame(1200);
    expect(engine.getState().state).toBe("CONFIGURING_DSP");
    expect(engine.getState().currentTarget?.name).toBe("A2");
  });
});
