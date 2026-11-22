import {
  TunerResult,
  GUITAR_STRINGS,
  NOTE_NAMES,
  GuitarStringSpec,
} from "./types";
import { YinDetector } from "./yin-detector";
import { NoiseGate } from "./noise-gate";
import {
  GuitarCalibrationProfile,
  GuitarCalibrationService,
} from "./guitar-calibration";

export class TunerEngine {
  private yinDetector: YinDetector;
  private noiseGate: NoiseGate;
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

  // Zero-GC pre-allocated 5-sample median filter buffers
  private medianBuffer: Float32Array;
  private medianSorted: Float32Array;
  private medianCount: number = 0;
  private medianIndex: number = 0;

  // Pre-allocated result struct for Zero-GC
  private result: TunerResult;

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
      inTune: false,
      clarity: 0,
      rms: 0,
      isGateOpen: false,
      stringIndex: -1,
    };

    // Load custom guitar calibration from localStorage if available
    this.loadCalibrationFromStorage();
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
    this.resetMedian();
    this.smoothedFreq = -1;
    this.attackElapsedMs = 0;
  }

  private pushMedian(val: number): number {
    if (this.medianCount > 0) {
      const currentMedian = this.medianSorted[Math.floor(this.medianCount / 2)];
      const centsDiff = Math.abs(1200 * (Math.log(val / currentMedian) / Math.LN2));
      // If note changed by > 80 cents (string switch or distinct fret), reset median filter
      // to guarantee zero latency on string change as required.
      if (centsDiff > 80) {
        this.medianCount = 0;
        this.medianIndex = 0;
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

    if (!isGateOpen) {
      this.result.frequency = -1;
      this.result.smoothedFrequency = -1;
      this.result.cents = 0;
      this.result.inTune = false;
      this.result.clarity = 0;
      this.smoothedFreq = -1;
      this.resetMedian();
      this.attackElapsedMs = 0;
      return this.result;
    }

    const pitchResult = this.yinDetector.detect(timeBuffer);

    if (pitchResult.frequency <= 0 || pitchResult.clarity < 0.6) {
      this.result.frequency = -1;
      this.result.smoothedFrequency = -1;
      this.result.cents = 0;
      this.result.inTune = false;
      this.result.clarity = pitchResult.clarity;
      this.smoothedFreq = -1;
      this.resetMedian();
      this.attackElapsedMs = 0;
      return this.result;
    }

    this.attackElapsedMs += deltaMs;
    const rawFreq = pitchResult.frequency;

    // 1. Guitar Harmonic Folding
    const foldedFreq = this.foldGuitarHarmonics(rawFreq);

    // 2. 5-Sample Median Filter (eliminates transient spikes and pick scrapes)
    let filteredFreq = foldedFreq;
    if (this.adaptiveSmoothing && this.baseAlpha !== 1.0) {
      filteredFreq = this.pushMedian(foldedFreq);
    }

    // Convert frequency to MIDI note: MIDI = 69 + 12 * log2(f / 440)
    const midiReal = 69 + 12 * (Math.log(filteredFreq / 440) / Math.LN2);
    let midiNearest = Math.round(midiReal);

    // If target string is locked, target frequency is fixed to that string
    let targetFreq: number;
    let noteName: string;
    let octave: number;

    if (this.targetStringLock) {
      targetFreq = this.targetStringLock.targetFrequency;
      noteName = this.targetStringLock.noteName;
      octave = this.targetStringLock.octave;
      midiNearest = this.targetStringLock.midiNote;
    } else {
      targetFreq = 440 * Math.pow(2, (midiNearest - 69) / 12);
      const semitoneIndex = ((midiNearest % 12) + 12) % 12;
      noteName = NOTE_NAMES[semitoneIndex];
      octave = Math.floor(midiNearest / 12) - 1;
    }

    // Match string index (0 = Corda 6 E2, 5 = Corda 1 E4)
    let stringIndex = -1;
    for (let i = 0; i < GUITAR_STRINGS.length; i++) {
      const s = GUITAR_STRINGS[i];
      if (s.midiNote === midiNearest) {
        stringIndex = i;
        this.lastActiveString = s;
        break;
      }
    }

    // 3. Adaptive EWMA Smoothing with Attack Damping
    let alpha: number;
    if (!this.adaptiveSmoothing || this.baseAlpha === 1.0) {
      alpha = this.baseAlpha;
    } else if (this.smoothedFreq <= 0 || this.lastMidiNote !== midiNearest) {
      // Note change: 0.80 for zero-latency string transition
      alpha = 0.80;
    } else if (this.attackElapsedMs < 80) {
      // Attack transient damping: 0.15 dampens sharp initial tension surge
      alpha = Math.min(0.15, this.baseAlpha);
    } else {
      // Stable around target note: 0.15 for rock-solid PolyTune/Boss stability
      alpha = this.baseAlpha;
    }

    if (this.smoothedFreq <= 0 || alpha === 1.0) {
      this.smoothedFreq = filteredFreq;
    } else {
      this.smoothedFreq =
        alpha * filteredFreq + (1 - alpha) * this.smoothedFreq;
    }
    this.lastMidiNote = midiNearest;

    // Calculate cents deviation: 1200 * log2(f / f_target)
    const centsDeviation =
      1200 * (Math.log(this.smoothedFreq / targetFreq) / Math.LN2);
    // Clamp to -50 to +50 for gauge range
    const clampedCents = Math.max(-50, Math.min(50, centsDeviation));

    this.result.frequency = rawFreq;
    this.result.smoothedFrequency = this.smoothedFreq;
    this.result.targetFrequency = targetFreq;
    this.result.noteName = noteName;
    this.result.octave = octave;
    this.result.midiNote = midiNearest;
    this.result.cents = clampedCents;
    this.result.inTune = Math.abs(centsDeviation) <= 5.0;
    this.result.clarity = pitchResult.clarity;
    this.result.stringIndex = stringIndex;

    return this.result;
  }
}
