/**
 * Monophonic Pitch Detection using the YIN Algorithm (Cheveigné & Kawahara).
 * Operates in the time domain on buffer size N = 2048 with Zero-GC.
 */

export interface YinPitchResult {
  frequency: number; // Fundamental frequency f0 in Hz (-1 if unpitched)
  clarity: number; // Periodic confidence from 0.0 to 1.0
  period: number; // Estimated fundamental period in samples (tau*)
}

export class YinDetector {
  private sampleRate: number;
  private bufferSize: number;
  private tauMax: number;
  private windowSize: number;
  private threshold: number;

  // Pre-allocated buffers for Zero-GC
  private diffBuffer: Float32Array;
  private cmndfBuffer: Float32Array;
  private result: YinPitchResult;

  constructor(
    sampleRate: number = 44100,
    bufferSize: number = 2048,
    threshold: number = 0.15
  ) {
    this.sampleRate = sampleRate;
    this.bufferSize = bufferSize;
    this.tauMax = Math.floor(bufferSize / 2); // 1024
    this.windowSize = this.bufferSize - this.tauMax; // 1024
    this.threshold = threshold;

    this.diffBuffer = new Float32Array(this.tauMax);
    this.cmndfBuffer = new Float32Array(this.tauMax);

    this.result = {
      frequency: -1,
      clarity: 0,
      period: 0,
    };
  }

  public setSampleRate(sampleRate: number): void {
    this.sampleRate = sampleRate;
  }

  /**
   * Detects the fundamental pitch f0 in the input buffer.
   * Zero-GC: updates and returns the internal result reference.
   */
  public detect(buffer: Float32Array): YinPitchResult {
    const tauMax = this.tauMax;
    const windowSize = this.windowSize;
    const diff = this.diffBuffer;
    const cmndf = this.cmndfBuffer;

    // Minimum tau for ~1050 Hz (highest expected guitar harmonic note in tuner)
    // At 44.1k: 44100 / 1050 ~ 42 samples
    const tauMin = Math.max(2, Math.floor(this.sampleRate / 1100));

    // Step 1: Difference Function d_t(tau)
    diff[0] = 0;
    for (let tau = 1; tau < tauMax; tau++) {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        const delta = buffer[j] - buffer[j + tau];
        sum += delta * delta;
      }
      diff[tau] = sum;
    }

    // Step 2: Cumulative Mean Normalized Difference Function (CMNDF)
    cmndf[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < tauMax; tau++) {
      runningSum += diff[tau];
      if (runningSum > 0) {
        cmndf[tau] = (diff[tau] * tau) / runningSum;
      } else {
        cmndf[tau] = 1;
      }
    }

    // Step 3: Absolute Thresholding
    let tauMatch = -1;
    for (let tau = tauMin; tau < tauMax; tau++) {
      if (cmndf[tau] < this.threshold) {
        // Find bottom of local minimum
        while (tau + 1 < tauMax && cmndf[tau + 1] < cmndf[tau]) {
          tau++;
        }
        tauMatch = tau;
        break;
      }
    }

    // Fallback: If no dip below threshold, check global minimum
    if (tauMatch === -1) {
      let minVal = 1000;
      let minTau = -1;
      for (let tau = tauMin; tau < tauMax; tau++) {
        if (cmndf[tau] < minVal) {
          minVal = cmndf[tau];
          minTau = tau;
        }
      }
      // Cutoff threshold 0.40 for weak sustain / damped guitar strings
      if (minTau > 0 && minVal < 0.4) {
        tauMatch = minTau;
      }
    }

    // If still no valid periodic valley, return unpitched
    if (tauMatch === -1) {
      this.result.frequency = -1;
      this.result.clarity = 0;
      this.result.period = 0;
      return this.result;
    }

    // Step 4: Sub-sample Parabolic Interpolation
    let tauRefined = tauMatch;
    if (tauMatch > 0 && tauMatch < tauMax - 1) {
      const y1 = cmndf[tauMatch - 1];
      const y2 = cmndf[tauMatch];
      const y3 = cmndf[tauMatch + 1];
      const denominator = 2 * (2 * y2 - y1 - y3);

      if (Math.abs(denominator) > 1e-9) {
        const delta = (y3 - y1) / denominator;
        if (delta >= -1 && delta <= 1) {
          tauRefined = tauMatch + delta;
        }
      }
    }

    // Step 5: Fundamental Frequency Calculation
    const frequency = this.sampleRate / tauRefined;
    const clarity = Math.max(0, Math.min(1, 1 - cmndf[tauMatch]));

    // Sanity check: Guitar fundamental frequency range (65 Hz to 1050 Hz)
    if (frequency >= 65 && frequency <= 1050) {
      this.result.frequency = frequency;
      this.result.clarity = clarity;
      this.result.period = tauRefined;
    } else {
      this.result.frequency = -1;
      this.result.clarity = 0;
      this.result.period = 0;
    }

    return this.result;
  }
}
