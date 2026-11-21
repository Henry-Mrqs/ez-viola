import {
  TunerResult,
  GUITAR_STRINGS,
  NOTE_NAMES,
  GuitarStringSpec,
} from "./types";
import { YinDetector } from "./yin-detector";
import { NoiseGate } from "./noise-gate";

export class TunerEngine {
  private yinDetector: YinDetector;
  private noiseGate: NoiseGate;
  private sampleRate: number;
  private ewmaAlpha: number;
  private smoothedFreq: number = -1;
  private lastMidiNote: number = -1;
  private targetStringLock: GuitarStringSpec | null = null;

  // Pre-allocated result struct for Zero-GC
  private result: TunerResult;

  constructor(
    sampleRate: number = 44100,
    bufferSize: number = 2048,
    ewmaAlpha: number = 0.35,
    noiseGateConfig?: { thresholdOpen?: number; thresholdClose?: number }
  ) {
    this.sampleRate = sampleRate;
    this.ewmaAlpha = ewmaAlpha;
    this.yinDetector = new YinDetector(sampleRate, bufferSize, 0.15);
    this.noiseGate = new NoiseGate(noiseGateConfig);

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
  }

  public setSampleRate(sampleRate: number): void {
    this.sampleRate = sampleRate;
    this.yinDetector.setSampleRate(sampleRate);
  }

  public getSampleRate(): number {
    return this.sampleRate;
  }

  public setTargetString(stringNumber: number | null): void {
    if (stringNumber === null) {
      this.targetStringLock = null;
    } else {
      const found = GUITAR_STRINGS.find((s) => s.stringNumber === stringNumber);
      this.targetStringLock = found ?? null;
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
      return this.result;
    }

    const rawFreq = pitchResult.frequency;

    // Convert frequency to MIDI note: MIDI = 69 + 12 * log2(f / 440)
    const midiReal = 69 + 12 * (Math.log(rawFreq / 440) / Math.LN2);
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

    // EWMA Smoothing: f_smooth = alpha * f0 + (1 - alpha) * f_prev
    if (this.smoothedFreq <= 0 || this.lastMidiNote !== midiNearest) {
      this.smoothedFreq = rawFreq;
    } else {
      this.smoothedFreq =
        this.ewmaAlpha * rawFreq + (1 - this.ewmaAlpha) * this.smoothedFreq;
    }
    this.lastMidiNote = midiNearest;

    // Calculate cents deviation: 1200 * log2(f / f_target)
    const centsDeviation =
      1200 * (Math.log(this.smoothedFreq / targetFreq) / Math.LN2);
    // Clamp to -50 to +50 for gauge range
    const clampedCents = Math.max(-50, Math.min(50, centsDeviation));

    // Match string index (0 = Corda 6 E2, 5 = Corda 1 E4)
    let stringIndex = -1;
    for (let i = 0; i < GUITAR_STRINGS.length; i++) {
      const s = GUITAR_STRINGS[i];
      if (s.midiNote === midiNearest) {
        stringIndex = i;
        break;
      }
    }

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
