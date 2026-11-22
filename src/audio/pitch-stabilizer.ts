import {
  GuitarStringSpec,
  NOTE_NAMES,
  PitchStabilizerConfig,
  TunerTuningAction,
} from "./types";

export interface PitchStabilizerOutput {
  frequency: number;
  smoothedFrequency: number;
  targetFrequency: number;
  noteName: string;
  octave: number;
  midiNote: number;
  cents: number;
  rawCents: number;
  inTune: boolean;
  tuningAction: TunerTuningAction;
  action: TunerTuningAction;
  instruction: string;
  isDangerBreak: boolean;
}

export class PitchStabilizer {
  private minAlpha: number;
  private maxAlpha: number;
  private inflectionCents: number;
  private sigmoidSlope: number;
  private deadbandCents: number;
  private hysteresisCents: number;
  private confirmationFrames: number;
  private decayFreezeMs: number;

  // Zero-GC circular median filter buffers
  private medianBuffer: Float32Array;
  private medianSorted: Float32Array;
  private medianIndex: number = 0;
  private medianCount: number = 0;

  // Schmitt trigger state
  private confirmedMidiNote: number = -1;
  private candidateMidiNote: number = -1;
  private confirmationCount: number = 0;

  // Smoothed frequency state
  private smoothedFreq: number = -1;
  private lastValidFreq: number = -1;
  private decayElapsedMs: number = 0;

  // Pre-allocated output struct for Zero-GC
  private output: PitchStabilizerOutput;

  constructor(config?: PitchStabilizerConfig) {
    this.minAlpha = config?.minAlpha ?? 0.12;
    this.maxAlpha = config?.maxAlpha ?? 0.8;
    this.inflectionCents = config?.inflectionCents ?? 12.0;
    this.sigmoidSlope = config?.sigmoidSlope ?? 4.0;
    this.deadbandCents = config?.deadbandCents ?? 0.25;
    this.hysteresisCents = config?.hysteresisCents ?? 65.0;
    this.confirmationFrames = config?.confirmationFrames ?? 4;
    this.decayFreezeMs = config?.decayFreezeMs ?? 400;

    this.medianBuffer = new Float32Array(5);
    this.medianSorted = new Float32Array(5);

    this.output = {
      frequency: -1,
      smoothedFrequency: -1,
      targetFrequency: 0,
      noteName: "-",
      octave: 0,
      midiNote: 0,
      cents: 0,
      rawCents: 0,
      inTune: false,
      tuningAction: "IDLE",
      action: "IDLE",
      instruction: "Toque uma corda para afinar...",
      isDangerBreak: false,
    };
  }

  public reset(): void {
    this.medianIndex = 0;
    this.medianCount = 0;
    this.confirmedMidiNote = -1;
    this.candidateMidiNote = -1;
    this.confirmationCount = 0;
    this.smoothedFreq = -1;
    this.lastValidFreq = -1;
    this.decayElapsedMs = 0;

    this.output.frequency = -1;
    this.output.smoothedFrequency = -1;
    this.output.targetFrequency = 0;
    this.output.noteName = "-";
    this.output.octave = 0;
    this.output.midiNote = 0;
    this.output.cents = 0;
    this.output.rawCents = 0;
    this.output.inTune = false;
    this.output.tuningAction = "IDLE";
    this.output.action = "IDLE";
    this.output.instruction = "Toque uma corda para afinar...";
    this.output.isDangerBreak = false;
  }

  private pushMedian(val: number): number {
    if (this.medianCount > 0) {
      const currentMedian = this.medianSorted[Math.floor(this.medianCount / 2)];
      if (currentMedian > 0) {
        const centsDiff = Math.abs(1200 * (Math.log(val / currentMedian) / Math.LN2));
        if (centsDiff > 80) {
          // Note changed abruptly -> reset median to ensure zero latency
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

    // In-place insertion sort
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

  public process(
    rawFreq: number,
    clarity: number,
    isGateOpen: boolean,
    targetLock: GuitarStringSpec | null,
    deltaMs: number = 16.6
  ): PitchStabilizerOutput {
    const isSignalValid = isGateOpen && rawFreq > 0 && clarity >= 0.6;

    if (!isSignalValid) {
      // Check graceful decay freeze
      this.decayElapsedMs += deltaMs;
      if (this.lastValidFreq > 0 && this.decayElapsedMs < this.decayFreezeMs) {
        // Keep the previous stabilized output intact during graceful decay
        return this.output;
      }

      // Past graceful decay freeze: set to IDLE
      this.reset();
      return this.output;
    }

    // Active valid signal: reset decay counter
    this.decayElapsedMs = 0;

    // 1. Median filter (5 samples Zero-GC)
    const filteredFreq = this.pushMedian(rawFreq);

    // Continuous MIDI representation: 69 + 12 * log2(f / 440)
    const midiReal = 69 + 12 * (Math.log(filteredFreq / 440) / Math.LN2);
    const nominalMidi = Math.round(midiReal);

    // 2. Schmitt Trigger with Confirmation (Note locking / Hysteresis)
    let targetMidi: number;
    let targetFreq: number;
    let noteName: string;
    let octave: number;

    if (targetLock) {
      targetMidi = targetLock.midiNote;
      targetFreq = targetLock.targetFrequency;
      noteName = targetLock.noteName;
      octave = targetLock.octave;
      this.confirmedMidiNote = targetMidi;
      this.candidateMidiNote = -1;
      this.confirmationCount = 0;
    } else {
      if (this.confirmedMidiNote === -1) {
        this.confirmedMidiNote = nominalMidi;
        this.candidateMidiNote = -1;
        this.confirmationCount = 0;
      } else {
        const confirmedNominalFreq =
          440 * Math.pow(2, (this.confirmedMidiNote - 69) / 12);
        const centsFromConfirmed =
          1200 * (Math.log(filteredFreq / confirmedNominalFreq) / Math.LN2);
        const absCents = Math.abs(centsFromConfirmed);

        if (absCents >= 150 || this.confirmationFrames <= 1) {
          // Large leap (different note/string) or test mode: immediate switch
          this.confirmedMidiNote = nominalMidi;
          this.candidateMidiNote = -1;
          this.confirmationCount = 0;
        } else if (absCents > this.hysteresisCents) {
          // Boundary region between adjacent semitones (65 to 150 cents)
          if (this.candidateMidiNote === nominalMidi && clarity >= 0.65) {
            this.confirmationCount++;
            if (this.confirmationCount >= this.confirmationFrames) {
              this.confirmedMidiNote = nominalMidi;
              this.candidateMidiNote = -1;
              this.confirmationCount = 0;
            }
          } else {
            this.candidateMidiNote = nominalMidi;
            this.confirmationCount = clarity >= 0.65 ? 1 : 0;
          }
        } else {
          // Within hysteresis band (+/- 65 cents): retain confirmed note
          this.candidateMidiNote = -1;
          this.confirmationCount = 0;
        }
      }

      targetMidi = this.confirmedMidiNote;
      targetFreq = 440 * Math.pow(2, (targetMidi - 69) / 12);
      const semitoneIndex = ((targetMidi % 12) + 12) % 12;
      noteName = NOTE_NAMES[semitoneIndex];
      octave = Math.floor(targetMidi / 12) - 1;
    }

    // 3. Sigmoidal Dual-Rate EMA with Deadband
    let effectiveFilteredFreq = filteredFreq;
    if (this.smoothedFreq <= 0) {
      this.smoothedFreq = filteredFreq;
    } else {
      const deltaCents = Math.abs(
        1200 * (Math.log(filteredFreq / this.smoothedFreq) / Math.LN2)
      );

      if (deltaCents < this.deadbandCents) {
        // Anti-jitter deadband: eliminate micro-oscillations near target
        effectiveFilteredFreq = this.smoothedFreq;
      }

      // Sigmoidal Alpha function:
      // alpha = minAlpha + (maxAlpha - minAlpha) / (1 + exp(-(deltaCents - inflectionCents) / sigmoidSlope))
      const exponent =
        -(deltaCents - this.inflectionCents) / Math.max(0.1, this.sigmoidSlope);
      const sigmoid = 1.0 / (1.0 + Math.exp(exponent));
      const dynamicAlpha =
        this.minAlpha + (this.maxAlpha - this.minAlpha) * sigmoid;

      this.smoothedFreq =
        dynamicAlpha * effectiveFilteredFreq +
        (1 - dynamicAlpha) * this.smoothedFreq;
    }

    this.lastValidFreq = this.smoothedFreq;

    // 4. Calculate Cents and Action
    const rawCents =
      1200 * (Math.log(this.smoothedFreq / targetFreq) / Math.LN2);
    const clampedCents = Math.max(-50, Math.min(50, rawCents));
    const inTune = Math.abs(rawCents) <= 5.0;

    // Tuning Action Evaluation
    let tuningAction: TunerTuningAction = "IDLE";
    let instruction = "";
    let isDangerBreak = false;

    // Danger break condition: String 1 (E4 = ~329.63 Hz) tensioned excessively (> +45 cents or > 338 Hz)
    const isE4String =
      targetLock?.stringNumber === 1 ||
      (noteName === "E" && octave === 4) ||
      (targetFreq > 320 && targetFreq < 340);

    if (isE4String && (rawCents > 45.0 || this.smoothedFreq > 338.0)) {
      tuningAction = "DANGER_BREAK";
      isDangerBreak = true;
      instruction = "CUIDADO: RISCO DE QUEBRA! AFROUXE A TARRAXA IMEDIATAMENTE";
    } else if (clampedCents < -5.0) {
      tuningAction = "TIGHTEN";
      instruction = "Corda frouxa — APERTE a tarraxa";
    } else if (clampedCents > 5.0) {
      tuningAction = "LOOSEN";
      instruction = "Corda tensa — AFROUXE a tarraxa";
    } else {
      tuningAction = "IN_TUNE";
      instruction = "AFINADO!";
    }

    this.output.frequency = rawFreq;
    this.output.smoothedFrequency = this.smoothedFreq;
    this.output.targetFrequency = targetFreq;
    this.output.noteName = noteName;
    this.output.octave = octave;
    this.output.midiNote = targetMidi;
    this.output.cents = clampedCents;
    this.output.rawCents = rawCents;
    this.output.inTune = inTune;
    this.output.tuningAction = tuningAction;
    this.output.action = tuningAction;
    this.output.instruction = instruction;
    this.output.isDangerBreak = isDangerBreak;

    return this.output;
  }
}
