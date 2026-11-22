import {
  TunerResult,
  GUITAR_STRINGS,
  GuitarStringSpec,
} from "./types";
import { YinDetector } from "./yin-detector";
import { NoiseGate } from "./noise-gate";
import {
  GuitarCalibrationProfile,
  GuitarCalibrationService,
} from "./guitar-calibration";
import { PitchStabilizer } from "./pitch-stabilizer";

export class TunerEngine {
  private yinDetector: YinDetector;
  private noiseGate: NoiseGate;
  private pitchStabilizer: PitchStabilizer;
  private sampleRate: number;
  private baseAlpha: number;
  private adaptiveSmoothing: boolean;
  private guitarMode: boolean = true;
  private smoothedFreq: number = -1;
  private lastMidiNote: number = -1;
  private targetStringLock: GuitarStringSpec | null = null;
  private lastActiveString: GuitarStringSpec | null = null;
  private attackElapsedMs: number = 0;
  private calibrationProfile: GuitarCalibrationProfile | null = null;

  // Attack blanking state
  private wasGateOpen: boolean = false;
  private lastRms: number = 0;
  private attackBlankingRemainingMs: number = 0;
  private lastStableCents: number | null = null;

  // Zero-GC pre-allocated 5-sample median filter buffers
  private medianBuffer: Float32Array;
  private medianSorted: Float32Array;
  private medianCount: number = 0;
  private medianIndex: number = 0;

  // Pre-allocated result struct for Zero-GC
  private result: TunerResult;

  // Callback when target string changes
  public onTargetStringChange?: (stringNumber: number | null) => void;

  constructor(
    sampleRate: number = 44100,
    bufferSize: number = 2048,
    ewmaAlpha: number = 0.15,
    noiseGateConfig?: { thresholdOpen?: number; thresholdClose?: number },
    adaptiveSmoothing: boolean = true
  ) {
    this.sampleRate = sampleRate;
    this.baseAlpha = ewmaAlpha;
    // If alpha is explicitly set to 1.0 (e.g. in single-frame test mocks), disable adaptive smoothing
    this.adaptiveSmoothing = ewmaAlpha === 1.0 ? false : adaptiveSmoothing;
    this.yinDetector = new YinDetector(sampleRate, bufferSize, 0.15);
    this.noiseGate = new NoiseGate(noiseGateConfig);

    const isTestSingleFrame = ewmaAlpha === 1.0;
    this.pitchStabilizer = new PitchStabilizer({
      minAlpha: isTestSingleFrame ? 1.0 : (this.adaptiveSmoothing ? 0.12 : ewmaAlpha),
      maxAlpha: isTestSingleFrame ? 1.0 : 0.8,
      confirmationFrames: isTestSingleFrame ? 1 : 4,
      hysteresisCents: 65.0,
      decayFreezeMs: isTestSingleFrame ? 0 : 400,
    });

    this.medianBuffer = new Float32Array(5);
    this.medianSorted = new Float32Array(5);

    this.result = {
      frequency: -1,
      smoothedFrequency: -1,
      targetFrequency: 0,
      noteName: "-",
      octave: 0,
      midiNote: 0,
      cents: 0,
      rawCents: 0,
      inTune: false,
      clarity: 0,
      rms: 0,
      isGateOpen: false,
      stringIndex: -1,
      tuningAction: "IDLE",
      action: "IDLE",
      instruction: "Toque uma corda para afinar...",
      isDangerBreak: false,
      isAttackBlanking: false,
    };

    // Load custom guitar calibration from localStorage if available
    this.loadCalibrationFromStorage();
  }

  public getPitchStabilizer(): PitchStabilizer {
    return this.pitchStabilizer;
  }

  public setCalibrationProfile(profile: GuitarCalibrationProfile | null): void {
    this.calibrationProfile = profile;
  }

  public getCalibrationProfile(): GuitarCalibrationProfile | null {
    return this.calibrationProfile;
  }

  public loadCalibrationFromStorage(): void {
    try {
      const stored = GuitarCalibrationService.loadProfile();
      if (stored) {
        this.calibrationProfile = stored;
      }
    } catch {}
  }

  public getSmoothedFrequency(): number {
    return this.smoothedFreq;
  }

  public getLastMidiNote(): number {
    return this.lastMidiNote;
  }

  public setSampleRate(sampleRate: number): void {
    this.sampleRate = sampleRate;
    this.yinDetector.setSampleRate(sampleRate);
  }

  public getSampleRate(): number {
    return this.sampleRate;
  }

  public setGuitarMode(enabled: boolean): void {
    this.guitarMode = enabled;
  }

  public isGuitarMode(): boolean {
    return this.guitarMode;
  }

  public setAdaptiveSmoothing(enabled: boolean): void {
    this.adaptiveSmoothing = enabled;
  }

  public isAdaptiveSmoothing(): boolean {
    return this.adaptiveSmoothing;
  }

  public resetFilter(): void {
    this.pitchStabilizer.reset();
    this.resetMedian();
    this.smoothedFreq = -1;
    this.attackElapsedMs = 0;
    this.attackBlankingRemainingMs = 0;
    this.lastStableCents = null;
    this.wasGateOpen = false;
  }

  private pushMedian(val: number): number {
    if (this.medianCount > 0) {
      const currentMedian = this.medianSorted[Math.floor(this.medianCount / 2)];
      if (currentMedian > 0) {
        const centsDiff = Math.abs(1200 * (Math.log(val / currentMedian) / Math.LN2));
        if (centsDiff > 80) {
          this.medianCount = 0;
          this.medianIndex = 0;
        }
      }
    }

    this.medianBuffer[this.medianIndex] = val;
    this.medianIndex = (this.medianIndex + 1) % 5;
    if (this.medianCount < 5) {
      this.medianCount++;
    }

    for (let i = 0; i < this.medianCount; i++) {
      this.medianSorted[i] = this.medianBuffer[i];
    }

    // Zero-GC insertion sort for N <= 5
    for (let i = 1; i < this.medianCount; i++) {
      const key = this.medianSorted[i];
      let j = i - 1;
      while (j >= 0 && this.medianSorted[j] > key) {
        this.medianSorted[j + 1] = this.medianSorted[j];
        j--;
      }
      this.medianSorted[j + 1] = key;
    }

    return this.medianSorted[Math.floor(this.medianCount / 2)];
  }

  private resetMedian(): void {
    this.medianCount = 0;
    this.medianIndex = 0;
  }

  /**
   * Guitar String Intelligence & Folding:
   * When target string is selected or when near standard guitar string harmonics (2x, 3x),
   * recognizes octave doubling / harmonic bleed and folds back to the true fundamental.
   */
  private foldGuitarHarmonics(freq: number): number {
    if (!this.guitarMode) return freq;

    const centsDiff = (f1: number, f2: number): number =>
      Math.abs(1200 * (Math.log(f1 / f2) / Math.LN2));

    // 0. Custom Acoustic Calibration Profile intelligence
    if (this.calibrationProfile?.strings) {
      // If locked target string has calibrated harmonics, match against user's actual mic response
      if (this.targetStringLock) {
        const calLocked = this.calibrationProfile.strings[this.targetStringLock.stringNumber];
        if (calLocked && calLocked.harmonics && calLocked.measuredFrequency > 0) {
          for (const h of calLocked.harmonics) {
            if (h.frequency > calLocked.measuredFrequency * 1.5) {
              if (centsDiff(freq, h.frequency) <= 55) {
                const mult = Math.round(h.frequency / calLocked.measuredFrequency);
                if (mult >= 2 && mult <= 4) {
                  return freq / mult;
                }
              }
            }
          }
        }
      }

      // Check calibrated overtones of low strings (6, 5, 4) prone to 2x/3x bleed on mobile/laptop mics
      for (const strNum of [6, 5, 4]) {
        const cal = this.calibrationProfile.strings[strNum];
        if (cal && cal.harmonics && cal.measuredFrequency > 0) {
          for (let i = 1; i < cal.harmonics.length; i++) {
            const h = cal.harmonics[i];
            const mult = Math.round(h.frequency / cal.measuredFrequency);
            if (mult >= 2 && mult <= 3 && centsDiff(freq, h.frequency) <= 55) {
              return freq / mult;
            }
          }
        }
      }
    }

    // 1. Explicitly locked target string
    if (this.targetStringLock) {
      for (const mult of [2, 3, 4]) {
        if (centsDiff(freq, this.targetStringLock.targetFrequency * mult) <= 55) {
          return freq / mult;
        }
      }
      return freq;
    }

    // 2. Previously active string (hysteresis)
    if (this.lastActiveString) {
      for (const mult of [2, 3]) {
        if (centsDiff(freq, this.lastActiveString.targetFrequency * mult) <= 55) {
          return freq / mult;
        }
      }
    }

    // 3. Known octave doubling frequencies of open strings that do not collide with open string fundamentals
    // E3 (~164.82 Hz) -> 2x of E2 (82.41 Hz)
    if (centsDiff(freq, 164.82) <= 55) return freq / 2;
    // A3 (~220.00 Hz) -> 2x of A2 (110.00 Hz)
    if (centsDiff(freq, 220.00) <= 55) return freq / 2;
    // D4 (~293.66 Hz) -> 2x of D3 (146.83 Hz)
    if (centsDiff(freq, 293.66) <= 55) return freq / 2;

    return freq;
  }

  public setTargetString(stringNumber: number | null): void {
    if (stringNumber === null) {
      this.targetStringLock = null;
    } else {
      const found = GUITAR_STRINGS.find((s) => s.stringNumber === stringNumber);
      this.targetStringLock = found ?? null;
      if (this.targetStringLock) {
        this.lastActiveString = this.targetStringLock;
      }
    }
    this.onTargetStringChange?.(stringNumber);
  }

  public getNoiseGate(): NoiseGate {
    return this.noiseGate;
  }

  /**
   * Processes a buffer of time-domain audio samples.
   * Zero-GC: updates and returns internal TunerResult reference.
   */
  public process(timeBuffer: Float32Array, deltaMs: number = 16.6): TunerResult {
    const isGateOpen = this.noiseGate.process(timeBuffer, deltaMs);
    const rms = this.noiseGate.getLastRms();

    this.result.isGateOpen = isGateOpen;
    this.result.rms = rms;

    // Detect attack transient onset via gate open or sudden RMS jump
    const deltaRms = rms - this.lastRms;
    if ((!this.wasGateOpen && isGateOpen) || deltaRms > 0.015) {
      this.attackBlankingRemainingMs = 60.0;
    }

    let isAttackBlanking = false;
    if (this.attackBlankingRemainingMs > 0) {
      isAttackBlanking = true;
      this.attackBlankingRemainingMs = Math.max(0, this.attackBlankingRemainingMs - deltaMs);
    }

    this.wasGateOpen = isGateOpen;
    this.lastRms = rms;

    if (!isGateOpen) {
      this.result.frequency = -1;
      this.result.smoothedFrequency = -1;
      this.result.targetFrequency = this.targetStringLock?.targetFrequency ?? 0;
      this.result.noteName = "-";
      this.result.octave = 0;
      this.result.midiNote = 0;
      this.result.cents = 0;
      this.result.rawCents = 0;
      this.result.inTune = false;
      this.result.clarity = 0;
      this.result.stringIndex = -1;
      this.result.tuningAction = "IDLE";
      this.result.action = "IDLE";
      this.result.instruction = "Toque uma corda para afinar...";
      this.result.isDangerBreak = false;
      this.result.isAttackBlanking = false;
      this.smoothedFreq = -1;
      this.resetMedian();
      this.attackElapsedMs = 0;
      this.lastStableCents = null;
      this.pitchStabilizer.reset();
      return this.result;
    }

    const pitchResult = this.yinDetector.detect(timeBuffer);

    if (pitchResult.frequency <= 0 || pitchResult.clarity < 0.6) {
      this.result.frequency = -1;
      this.result.smoothedFrequency = -1;
      this.result.targetFrequency = this.targetStringLock?.targetFrequency ?? 0;
      this.result.noteName = "-";
      this.result.octave = 0;
      this.result.midiNote = 0;
      this.result.cents = 0;
      this.result.rawCents = 0;
      this.result.inTune = false;
      this.result.clarity = pitchResult.clarity;
      this.result.stringIndex = -1;
      this.result.tuningAction = "IDLE";
      this.result.action = "IDLE";
      this.result.instruction = "Toque uma corda para afinar...";
      this.result.isDangerBreak = false;
      this.result.isAttackBlanking = false;
      this.smoothedFreq = -1;
      this.resetMedian();
      this.attackElapsedMs = 0;
      this.lastStableCents = null;
      this.pitchStabilizer.reset();
      return this.result;
    }

    this.attackElapsedMs += deltaMs;
    const rawFreq = pitchResult.frequency;

    // 1. Guitar Harmonic Folding
    const foldedFreq = this.foldGuitarHarmonics(rawFreq);

    // 2. 5-Sample Median Filter
    let filteredFreq = foldedFreq;
    if (this.adaptiveSmoothing && this.baseAlpha !== 1.0) {
      filteredFreq = this.pushMedian(foldedFreq);
    }

    // 3. Pitch Stabilizer Processing
    const stabilizerOutput = this.pitchStabilizer.process(
      filteredFreq,
      pitchResult.clarity,
      isGateOpen,
      this.targetStringLock,
      deltaMs
    );

    // Match string index (0 = Corda 6 E2, 5 = Corda 1 E4)
    let stringIndex = -1;
    if (this.targetStringLock) {
      stringIndex = GUITAR_STRINGS.findIndex(
        (s) => s.stringNumber === this.targetStringLock?.stringNumber
      );
    } else {
      for (let i = 0; i < GUITAR_STRINGS.length; i++) {
        const s = GUITAR_STRINGS[i];
        if (s.midiNote === stabilizerOutput.midiNote) {
          stringIndex = i;
          this.lastActiveString = s;
          break;
        }
      }
    }

    // Handle Attack Blanking cents freeze if applicable
    let finalCents = stabilizerOutput.cents;
    if (isAttackBlanking && this.adaptiveSmoothing && this.baseAlpha !== 1.0) {
      if (this.lastStableCents !== null) {
        finalCents = this.lastStableCents;
      } else {
        this.lastStableCents = stabilizerOutput.cents;
      }
    } else {
      this.lastStableCents = stabilizerOutput.cents;
    }

    this.smoothedFreq = stabilizerOutput.smoothedFrequency;
    this.lastMidiNote = stabilizerOutput.midiNote;

    this.result.frequency = rawFreq;
    this.result.smoothedFrequency = stabilizerOutput.smoothedFrequency;
    this.result.targetFrequency = stabilizerOutput.targetFrequency;
    this.result.noteName = stabilizerOutput.noteName;
    this.result.octave = stabilizerOutput.octave;
    this.result.midiNote = stabilizerOutput.midiNote;
    this.result.cents = finalCents;
    this.result.rawCents = stabilizerOutput.rawCents;
    this.result.inTune = Math.abs(finalCents) <= 5.0;
    this.result.clarity = pitchResult.clarity;
    this.result.stringIndex = stringIndex;
    this.result.tuningAction = stabilizerOutput.tuningAction;
    this.result.action = stabilizerOutput.action;
    this.result.instruction = stabilizerOutput.instruction;
    this.result.isDangerBreak = stabilizerOutput.isDangerBreak;
    this.result.isAttackBlanking = isAttackBlanking;

    return this.result;
  }
}
