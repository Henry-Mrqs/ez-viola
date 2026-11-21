import { NoiseGateConfig } from "./types";

/**
 * Adaptive Noise Gate with Schmitt Trigger and 6 dB Hysteresis.
 * Prevents chattering on acoustic boundaries and eliminates microphone background hiss.
 * Zero-GC: no allocations in process() or computeRms().
 */
export class NoiseGate {
  private thresholdOpen: number;
  private thresholdClose: number;
  private releaseTimeMs: number;
  private currentReleaseMs: number = 0;
  private isOpen: boolean = false;
  private lastRms: number = 0;

  constructor(config?: Partial<NoiseGateConfig>) {
    this.thresholdOpen = config?.thresholdOpen ?? 0.015;
    // 6 dB down = amplitude * 0.5 (or thresholdOpen * 10^(-6/20) ~ 0.501)
    this.thresholdClose = config?.thresholdClose ?? this.thresholdOpen * 0.5;
    this.releaseTimeMs = config?.releaseTimeMs ?? 120;
  }

  /**
   * Computes RMS of the time domain buffer in O(N) with zero allocations.
   */
  public computeRms(buffer: Float32Array): number {
    let sumSquares = 0;
    const len = buffer.length;
    for (let i = 0; i < len; i++) {
      const val = buffer[i];
      sumSquares += val * val;
    }
    return Math.sqrt(sumSquares / len);
  }

  /**
   * Processes the buffer through the Schmitt Trigger state machine.
   * @param buffer Time domain audio data
   * @param deltaMs Elapsed time in milliseconds since last frame (default 16.6ms for 60fps)
   * @returns boolean true if gate is OPEN (signal passes), false if CLOSED (silence/noise)
   */
  public process(buffer: Float32Array, deltaMs: number = 16.6): boolean {
    const rms = this.computeRms(buffer);
    this.lastRms = rms;

    if (!this.isOpen) {
      if (rms >= this.thresholdOpen) {
        this.isOpen = true;
        this.currentReleaseMs = this.releaseTimeMs;
      }
    } else {
      if (rms >= this.thresholdClose) {
        // Sustained signal, refresh release timer
        this.currentReleaseMs = this.releaseTimeMs;
      } else {
        // Signal fell below close threshold; count down release window
        this.currentReleaseMs -= deltaMs;
        if (this.currentReleaseMs <= 0) {
          this.isOpen = false;
          this.currentReleaseMs = 0;
        }
      }
    }

    return this.isOpen;
  }

  /**
   * Returns current RMS value from the last processed frame.
   */
  public getLastRms(): number {
    return this.lastRms;
  }

  /**
   * Returns true if gate is currently open.
   */
  public getIsOpen(): boolean {
    return this.isOpen;
  }

  public getThresholdOpen(): number {
    return this.thresholdOpen;
  }

  public getThresholdClose(): number {
    return this.thresholdClose;
  }

  /**
   * Dynamically sets thresholds based on calibrated room floor and guitar peak.
   */
  public calibrate(floorRms: number, peakRms: number): void {
    // Threshold_Open = N_floor + 0.35 * (S_peak - N_floor)
    const effectivePeak = Math.max(peakRms, floorRms + 0.02);
    this.thresholdOpen = Math.max(0.005, floorRms + 0.35 * (effectivePeak - floorRms));
    this.thresholdClose = this.thresholdOpen * 0.5; // -6 dB hysteresis
  }

  /**
   * Manually sets opening threshold and automatically computes 6 dB hysteresis close threshold.
   */
  public setThreshold(thresholdOpen: number): void {
    this.thresholdOpen = Math.max(0.001, thresholdOpen);
    this.thresholdClose = this.thresholdOpen * 0.5;
  }
}
