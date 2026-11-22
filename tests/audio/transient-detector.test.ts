import { describe, it, expect } from "vitest";
import { TransientDetector } from "@/audio/transient-detector";
import { generateSineWave, generateFftFromFrequencies } from "../helpers/synthetic-audio";

describe("TransientDetector (Continuous ODF, RMS, Spectral Flux & Rejection)", () => {
  const sampleRate = 44100;
  const fftSize = 2048;

  it("detects a legitimate guitar string pluck on energy surge with high clarity", () => {
    const detector = new TransientDetector(sampleRate, fftSize);

    // Initial silent frame
    const silence = new Float32Array(fftSize);
    const silentFreq = new Float32Array(fftSize / 2).fill(-100);
    detector.process(silence, silentFreq, 0.1, 110.0, 0, 16.6);

    // Sudden pluck onset (high energy RMS > 0.05, clarity = 0.92, frequency = 110.0 Hz)
    const pluckTime = generateSineWave(110.0, sampleRate, 0.1, 0.8);
    const pluckFreq = generateFftFromFrequencies([110.0], sampleRate, fftSize);

    const event = detector.process(
      pluckTime,
      pluckFreq,
      0.92,
      110.0,
      110.0,
      16.6
    );

    expect(event.isOnset).toBe(true);
    expect(event.isRejected).toBe(false);
    expect(event.rms).toBeGreaterThan(0.012);
    expect(event.odfValue).toBeGreaterThan(0.15);
  });

  it("rejects percussive body knocks and table taps with low YIN clarity (< 0.70)", () => {
    const detector = new TransientDetector(sampleRate, fftSize);

    // Body knock: sudden energy surge, but clarity = 0.40 (inharmonic impulse)
    const knockTime = generateSineWave(95.0, sampleRate, 0.1, 0.8);
    const knockFreq = generateFftFromFrequencies([95.0], sampleRate, fftSize);

    const event = detector.process(
      knockTime,
      knockFreq,
      0.4, // Low clarity
      110.0,
      95.0,
      16.6
    );

    expect(event.isOnset).toBe(false);
    expect(event.isRejected).toBe(true);
    expect(event.rejectionReason).toBe("LOW_CLARITY");
  });

  it("rejects fret scrape and handling noise with high spectral centroid (> 3500 Hz)", () => {
    const detector = new TransientDetector(sampleRate, fftSize);

    // Fret scrape: high-frequency friction at 5000 Hz, 6000 Hz
    const scrapeTime = generateSineWave(5000.0, sampleRate, 0.1, 0.7);
    const scrapeFreq = generateFftFromFrequencies([5000.0, 6000.0], sampleRate, fftSize);

    const event = detector.process(
      scrapeTime,
      scrapeFreq,
      0.85,
      110.0,
      5000.0,
      16.6
    );

    expect(event.isOnset).toBe(false);
    expect(event.isRejected).toBe(true);
    expect(event.rejectionReason).toBe("HIGH_CENTROID");
  });

  it("rejects wrong string plucks outside target window (> 250 cents deviation)", () => {
    const detector = new TransientDetector(sampleRate, fftSize);

    // Target is Corda 5 (A2 = 110.0 Hz). User plucks Corda 4 (D3 = 146.83 Hz, ~500 cents away)
    const d3Time = generateSineWave(146.83, sampleRate, 0.1, 0.8);
    const d3Freq = generateFftFromFrequencies([146.83], sampleRate, fftSize);

    const event = detector.process(
      d3Time,
      d3Freq,
      0.9,
      110.0, // Target A2
      146.83, // Detected D3
      16.6
    );

    expect(event.isOnset).toBe(false);
    expect(event.isRejected).toBe(true);
    expect(event.rejectionReason).toBe("WRONG_STRING_WINDOW");
  });

  it("enforces 450ms cooldown period to prevent secondary false onset triggers", () => {
    const detector = new TransientDetector(sampleRate, fftSize);

    const pluckTime = generateSineWave(110.0, sampleRate, 0.1, 0.8);
    const pluckFreq = generateFftFromFrequencies([110.0], sampleRate, fftSize);

    // First pluck -> Onset confirmed
    const event1 = detector.process(pluckTime, pluckFreq, 0.9, 110.0, 110.0, 16.6);
    expect(event1.isOnset).toBe(true);

    // Next frame at t = 50ms (within 450ms cooldown)
    const event2 = detector.process(pluckTime, pluckFreq, 0.9, 110.0, 110.0, 33.4);
    expect(event2.isOnset).toBe(false);

    // After 450ms cooldown elapsed and string has decayed to silence
    const silenceTime = new Float32Array(fftSize);
    const silenceFreq = new Float32Array(fftSize / 2).fill(-100);
    detector.process(silenceTime, silenceFreq, 0.0, 110.0, 0, 420.0);

    // Second distinct pluck
    const event3 = detector.process(pluckTime, pluckFreq, 0.9, 110.0, 110.0, 50.0);
    expect(event3.isOnset).toBe(true);
  });
});
