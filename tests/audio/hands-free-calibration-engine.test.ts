import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandsFreeCalibrationEngine } from "@/audio/hands-free-calibration-engine";
import { AudioEngine } from "@/audio/audio-engine";
import { generateSineWave, generateFftFromFrequencies } from "../helpers/synthetic-audio";

describe("HandsFreeCalibrationEngine (Zero-Click 3-Pluck FSM & Auto-Advance)", () => {
  const sampleRate = 44100;
  const fftSize = 2048;

  let mockAudioEngine: AudioEngine;
  let timeBuf: Float32Array;
  let freqBuf: Float32Array;

  beforeEach(() => {
    timeBuf = new Float32Array(fftSize);
    freqBuf = new Float32Array(fftSize / 2).fill(-85);

    mockAudioEngine = {
      getSampleRate: () => sampleRate,
      getTimeBuffer: () => timeBuf,
      getFreqBuffer: () => freqBuf,
      getAudioContext: () => null,
      setAdaptiveFilterForString: vi.fn(),
      setAdaptiveFilterForChords: vi.fn(),
      getTunerEngine: () => ({
        setCalibrationProfile: vi.fn(),
      }),
      getChordRecognizer: () => ({
        setCalibrationProfile: vi.fn(),
      }),
    } as unknown as AudioEngine;
  });

  it("advances through FSM: STANDBY -> CONFIGURING_DSP -> AWAITING_PLUCK", () => {
    const engine = new HandsFreeCalibrationEngine(mockAudioEngine);
    expect(engine.getState().state).toBe("STANDBY");

    engine.startWizard();
    expect(engine.getState().state).toBe("CONFIGURING_DSP");
    expect(mockAudioEngine.setAdaptiveFilterForString).toHaveBeenCalledWith(6);

    // After 50ms DSP configuration ramp settles
    engine.onFrame(50);
    expect(engine.getState().state).toBe("AWAITING_PLUCK");
    expect(engine.getState().currentTarget?.name).toBe("E2");
  });

  it("handles 3 sequential plucks, validates coherence, and triggers AUTO_ADVANCING", () => {
    const engine = new HandsFreeCalibrationEngine(mockAudioEngine);
    engine.startWizard();
    engine.onFrame(50); // -> AWAITING_PLUCK

    const e2Time = generateSineWave(82.41, sampleRate, 0.1, 0.8);
    const e2Freq = generateFftFromFrequencies([82.41], sampleRate, fftSize);
    const silenceTime = new Float32Array(fftSize);
    const silenceFreq = new Float32Array(fftSize / 2).fill(-85);

    // Simulate Pluck 1
    timeBuf.set(e2Time.subarray(0, fftSize));
    freqBuf.set(e2Freq);
    engine.onFrame(16.6); // Onset -> ATTACK_SETTLING
    expect(engine.getState().state).toBe("ATTACK_SETTLING");

    engine.onFrame(60); // -> MEASURING_SUSTAIN
    expect(engine.getState().state).toBe("MEASURING_SUSTAIN");

    engine.onFrame(16.6); // Sustained frame captured -> PLUCK_CONFIRMED -> COOLDOWN_WAIT
    expect(engine.getState().currentPluckCount).toBe(1);

    // Cooldown elapsed (700ms) with silence
    timeBuf.set(silenceTime);
    freqBuf.set(silenceFreq);
    engine.onFrame(700);
    expect(engine.getState().state).toBe("AWAITING_PLUCK");

    // Simulate Pluck 2
    timeBuf.set(e2Time.subarray(0, fftSize));
    freqBuf.set(e2Freq);
    engine.onFrame(16.6); // Onset -> ATTACK_SETTLING
    engine.onFrame(60); // -> MEASURING_SUSTAIN
    engine.onFrame(16.6); // -> PLUCK_CONFIRMED -> COOLDOWN_WAIT
    expect(engine.getState().currentPluckCount).toBe(2);

    timeBuf.set(silenceTime);
    freqBuf.set(silenceFreq);
    engine.onFrame(700); // -> AWAITING_PLUCK

    // Simulate Pluck 3
    timeBuf.set(e2Time.subarray(0, fftSize));
    freqBuf.set(e2Freq);
    engine.onFrame(16.6); // Onset -> ATTACK_SETTLING
    engine.onFrame(60); // -> MEASURING_SUSTAIN
    engine.onFrame(16.6); // -> PLUCK_CONFIRMED -> STEP_COMPLETE
    engine.onFrame(16.6); // STEP_COMPLETE evaluates coherence -> AUTO_ADVANCING

    expect(engine.getState().state).toBe("AUTO_ADVANCING");
    expect(engine.getState().currentPluckCount).toBe(3);
    expect(engine.getState().outlierRejected).toBe(false);

    // Countdown 1200ms -> Advances to Corda 5 (A2)
    engine.onFrame(1200);
    expect(engine.getState().state).toBe("CONFIGURING_DSP");
    expect(engine.getState().currentTarget?.name).toBe("A2");
  });

  it("rejects outliers when variance > 18 cents, drops rogue pluck, and returns to 2/3 plucks", () => {
    const engine = new HandsFreeCalibrationEngine(mockAudioEngine);
    engine.startWizard();
    engine.onFrame(50); // -> AWAITING_PLUCK

    const normalTime = generateSineWave(82.41, sampleRate, 0.1, 0.8);
    const normalFreq = generateFftFromFrequencies([82.41], sampleRate, fftSize);
    const silenceTime = new Float32Array(fftSize);
    const silenceFreq = new Float32Array(fftSize / 2).fill(-85);

    // Pluck 1: 82.41 Hz
    timeBuf.set(normalTime.subarray(0, fftSize));
    freqBuf.set(normalFreq);
    engine.onFrame(16.6);
    engine.onFrame(60);
    engine.onFrame(16.6);

    timeBuf.set(silenceTime);
    freqBuf.set(silenceFreq);
    engine.onFrame(700);

    // Pluck 2: 82.41 Hz
    timeBuf.set(normalTime.subarray(0, fftSize));
    freqBuf.set(normalFreq);
    engine.onFrame(16.6);
    engine.onFrame(60);
    engine.onFrame(16.6);

    timeBuf.set(silenceTime);
    freqBuf.set(silenceFreq);
    engine.onFrame(700);

    // Pluck 3: severe outlier (+50 cents sharp ~ 84.82 Hz)
    const outlierFreqVal = 82.41 * Math.pow(2, 50 / 1200);
    const outlierTime = generateSineWave(outlierFreqVal, sampleRate, 0.1, 0.8);
    const outlierFreq = generateFftFromFrequencies([outlierFreqVal], sampleRate, fftSize);

    timeBuf.set(outlierTime.subarray(0, fftSize));
    freqBuf.set(outlierFreq);
    engine.onFrame(16.6);
    engine.onFrame(60);
    engine.onFrame(16.6); // -> PLUCK_CONFIRMED -> STEP_COMPLETE
    engine.onFrame(16.6); // Evaluates variance (sigma > 18 cents!)

    // Outlier should be discarded, plucks count steps back from 3 to 2, outlierRejected flag set
    expect(engine.getState().state).toBe("AWAITING_PLUCK");
    expect(engine.getState().currentPluckCount).toBe(2);
    expect(engine.getState().outlierRejected).toBe(true);
    expect(engine.getState().feedbackMessage).toContain("Toque inconsistente descartado");
  });

  it("triggers inactivity pedagogical nudge warning after 12 seconds without sound", () => {
    const engine = new HandsFreeCalibrationEngine(mockAudioEngine);
    engine.startWizard();
    engine.onFrame(50); // -> AWAITING_PLUCK

    expect(engine.getState().inactivityWarning).toBe(false);

    // Advance 6 seconds
    engine.onFrame(6000);
    expect(engine.getState().inactivityWarning).toBe(false);

    // Advance 7 more seconds (13s total > 12s threshold)
    engine.onFrame(7000);
    expect(engine.getState().inactivityWarning).toBe(true);
    expect(engine.getState().inactivityMessage).toContain("Não estamos ouvindo seu violão");
  });

  it("supports manual escape routes: retryCurrentStep() and skipCurrentStep()", () => {
    const engine = new HandsFreeCalibrationEngine(mockAudioEngine);
    engine.startWizard();
    engine.onFrame(50);

    // Retry resets plucks on current step
    engine.retryCurrentStep();
    expect(engine.getState().state).toBe("AWAITING_PLUCK");
    expect(engine.getState().currentPluckCount).toBe(0);

    // Skip advances to next target immediately
    engine.skipCurrentStep();
    expect(engine.getState().currentTarget?.name).toBe("A2");
  });
});
