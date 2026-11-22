import { AudioEngine } from "./audio-engine";
import { TransientDetector } from "./transient-detector";
import { YinDetector } from "./yin-detector";
import { AudioSynthesizer } from "./audio-synthesizer";
import {
  GuitarCalibrationProfile,
  GuitarCalibrationService,
  StringCalibrationData,
  ChordCalibrationData,
  StringHarmonic,
} from "./guitar-calibration";

export type HandsFreeState =
  | "STANDBY"
  | "CONFIGURING_DSP"
  | "AWAITING_PLUCK"
  | "ATTACK_SETTLING"
  | "MEASURING_SUSTAIN"
  | "PLUCK_CONFIRMED"
  | "COOLDOWN_WAIT"
  | "STEP_COMPLETE"
  | "AUTO_ADVANCING"
  | "CALIBRATION_DONE";

export interface CalibrationTarget {
  type: "string" | "chord";
  stringNumber?: number; // 6 to 1
  chordId?: string;
  name: string;
  targetFrequency?: number;
  displayName: string;
  instructionText: string;
}

export interface PluckMeasurement {
  frequency: number;
  clarity: number;
  rms: number;
  centsOffset: number;
  harmonics: StringHarmonic[];
  chromagram?: number[];
}

export interface HandsFreeCalibrationProgress {
  state: HandsFreeState;
  currentTarget: CalibrationTarget | null;
  targetIndex: number;
  totalTargets: number;
  currentPluckCount: number; // 0, 1, 2, 3
  targetPlucks: number; // 3
  lastOnsetTimestamp: number;
  inactivityWarning: boolean;
  inactivityMessage?: string;
  feedbackMessage: string;
  autoAdvanceCountdownMs: number;
  outlierRejected: boolean;
  measuredCents?: number;
  varianceCents?: number;
}

export const DEFAULT_CALIBRATION_TARGETS: readonly CalibrationTarget[] = [
  {
    type: "string",
    stringNumber: 6,
    name: "E2",
    targetFrequency: 82.41,
    displayName: "Corda 6 (E2) — Mais grossa (Cima)",
    instructionText: "Toque a corda 6 (mais grossa) solta e deixe soar",
  },
  {
    type: "string",
    stringNumber: 5,
    name: "A2",
    targetFrequency: 110.0,
    displayName: "Corda 5 (A2) — Segunda mais grossa",
    instructionText: "Toque a corda 5 solta com firmeza",
  },
  {
    type: "string",
    stringNumber: 4,
    name: "D3",
    targetFrequency: 146.83,
    displayName: "Corda 4 (D3) — Terceira corda",
    instructionText: "Toque a corda 4 solta",
  },
  {
    type: "string",
    stringNumber: 3,
    name: "G3",
    targetFrequency: 196.0,
    displayName: "Corda 3 (G3) — Terceira mais fina",
    instructionText: "Toque a corda 3 solta",
  },
  {
    type: "string",
    stringNumber: 2,
    name: "B3",
    targetFrequency: 246.94,
    displayName: "Corda 2 (B3) — Segunda mais fina",
    instructionText: "Toque a corda 2 solta",
  },
  {
    type: "string",
    stringNumber: 1,
    name: "E4",
    targetFrequency: 329.63,
    displayName: "Corda 1 (E4) — Mais fina (Baixo)",
    instructionText: "Toque a corda 1 (mais fina) solta",
  },
];

export class HandsFreeCalibrationEngine {
  private audioEngine: AudioEngine;
  private transientDetector: TransientDetector;
  private yinDetector: YinDetector;

  private state: HandsFreeState = "STANDBY";
  private targets: CalibrationTarget[] = [];
  private currentTargetIndex: number = 0;
  private plucks: PluckMeasurement[] = [];

  // Timers & FSM tracking
  private stateTimerMs: number = 0;
  private inactivityTimerMs: number = 0;
  private autoAdvanceCountdownMs: number = 0;
  private lastOnsetTimestamp: number = 0;
  private outlierRejected: boolean = false;
  private feedbackMessage: string = "Aguardando início...";

  // Calibration staging buffer
  private calibratedStrings: Record<number, StringCalibrationData> = {};
  private calibratedChords: Record<string, ChordCalibrationData> = {};

  // Subscribers
  private listeners: Set<(progress: HandsFreeCalibrationProgress) => void> = new Set();

  constructor(audioEngine: AudioEngine) {
    this.audioEngine = audioEngine;
    const sampleRate = audioEngine.getSampleRate();
    this.transientDetector = new TransientDetector(sampleRate, 2048);
    this.yinDetector = new YinDetector(sampleRate, 2048, 0.15);
  }

  public subscribe(listener: (progress: HandsFreeCalibrationProgress) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const progress = this.getState();
    for (const listener of this.listeners) {
      listener(progress);
    }
  }

  public getState(): HandsFreeCalibrationProgress {
    const currentTarget = this.targets[this.currentTargetIndex] ?? null;
    const isInactivity = this.inactivityTimerMs >= 12000;

    return {
      state: this.state,
      currentTarget,
      targetIndex: this.currentTargetIndex,
      totalTargets: this.targets.length,
      currentPluckCount: this.plucks.length,
      targetPlucks: 3,
      lastOnsetTimestamp: this.lastOnsetTimestamp,
      inactivityWarning: isInactivity,
      inactivityMessage: isInactivity
        ? "Não estamos ouvindo seu violão... Toque a corda com mais firmeza perto do microfone!"
        : undefined,
      feedbackMessage: this.feedbackMessage,
      autoAdvanceCountdownMs: this.autoAdvanceCountdownMs,
      outlierRejected: this.outlierRejected,
    };
  }

  public startWizard(customTargets?: CalibrationTarget[]): void {
    this.targets = customTargets && customTargets.length > 0
      ? [...customTargets]
      : [...DEFAULT_CALIBRATION_TARGETS];
    this.currentTargetIndex = 0;
    this.plucks = [];
    this.calibratedStrings = {};
    this.calibratedChords = {};
    this.outlierRejected = false;
    this.inactivityTimerMs = 0;

    this.transitionTo("CONFIGURING_DSP");
  }

  public stopWizard(): void {
    this.transitionTo("STANDBY");
    this.audioEngine.setAdaptiveFilterForChords();
  }

  public retryCurrentStep(): void {
    this.plucks = [];
    this.outlierRejected = false;
    this.inactivityTimerMs = 0;
    this.transitionTo("AWAITING_PLUCK");
    this.feedbackMessage = "Passo reiniciado. Por favor, toque novamente.";
    this.notify();
  }

  public skipCurrentStep(): void {
    this.plucks = [];
    this.outlierRejected = false;
    this.inactivityTimerMs = 0;

    if (this.currentTargetIndex + 1 < this.targets.length) {
      this.currentTargetIndex++;
      this.transitionTo("CONFIGURING_DSP");
    } else {
      this.finishCalibration();
    }
  }

  private transitionTo(newState: HandsFreeState, customMessage?: string): void {
    this.state = newState;
    this.stateTimerMs = 0;

    const currentTarget = this.targets[this.currentTargetIndex];

    switch (newState) {
      case "STANDBY":
        this.feedbackMessage = customMessage ?? "Pronto para iniciar calibração.";
        break;

      case "CONFIGURING_DSP":
        if (currentTarget) {
          if (currentTarget.type === "string" && currentTarget.stringNumber) {
            this.audioEngine.setAdaptiveFilterForString(currentTarget.stringNumber);
          } else {
            this.audioEngine.setAdaptiveFilterForChords();
          }
          this.feedbackMessage =
            customMessage ??
            `Ajustando filtro para ${currentTarget.displayName}...`;
        }
        break;

      case "AWAITING_PLUCK":
        this.feedbackMessage =
          customMessage ??
          (currentTarget ? currentTarget.instructionText : "Toque o violão...");
        break;

      case "ATTACK_SETTLING":
        this.feedbackMessage = customMessage ?? "Ouvindo ataque...";
        break;

      case "MEASURING_SUSTAIN":
        this.feedbackMessage =
          customMessage ?? "Analisando sustentação harmônica...";
        break;

      case "PLUCK_CONFIRMED":
        const count = this.plucks.length;
        this.playPluckChime(count);
        this.feedbackMessage =
          customMessage ?? `Toque ${count}/3 confirmado!`;
        break;

      case "COOLDOWN_WAIT":
        this.feedbackMessage =
          customMessage ?? "Deixe a corda decair...";
        break;

      case "STEP_COMPLETE":
        this.feedbackMessage =
          customMessage ?? "Validando precisão dos 3 toques...";
        break;

      case "AUTO_ADVANCING":
        this.autoAdvanceCountdownMs = 1200;
        this.feedbackMessage =
          customMessage ?? "Perfeito! Avançando automaticamente...";
        break;

      case "CALIBRATION_DONE":
        this.feedbackMessage =
          customMessage ?? "Calibração concluída com sucesso!";
        break;
    }

    this.notify();
  }

  private playPluckChime(pluckNumber: number): void {
    const ctx = this.audioEngine.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (pluckNumber === 1 || pluckNumber === 2) {
      AudioSynthesizer.playCalibrationStepChime(ctx, pluckNumber as 1 | 2, now);
    } else if (pluckNumber === 3) {
      AudioSynthesizer.playCalibrationStepChime(ctx, 3, now);
    }
  }

  private playMissSound(): void {
    const ctx = this.audioEngine.getAudioContext();
    if (!ctx) return;
    AudioSynthesizer.playDampedMissSound(ctx, ctx.currentTime);
  }

  /**
   * Main DSP & FSM processing hook to be executed on each audio frame (Zero-GC).
   */
  public onFrame(deltaMs: number = 16.6): void {
    if (this.state === "STANDBY" || this.state === "CALIBRATION_DONE") return;

    this.stateTimerMs += deltaMs;
    const currentTarget = this.targets[this.currentTargetIndex];
    if (!currentTarget) return;

    const timeBuffer = this.audioEngine.getTimeBuffer();
    const freqBuffer = this.audioEngine.getFreqBuffer();
    const sampleRate = this.audioEngine.getSampleRate();

    this.transientDetector.setSampleRate(sampleRate);
    this.yinDetector.setSampleRate(sampleRate);

    // 1. Yin Fundamental & Clarity check
    const pitch = this.yinDetector.detect(timeBuffer);
    const targetFreq = currentTarget.targetFrequency ?? 110.0;

    // 2. Transient onset process
    const transient = this.transientDetector.process(
      timeBuffer,
      freqBuffer,
      pitch.clarity,
      currentTarget.type === "string" ? targetFreq : undefined,
      pitch.frequency > 0 ? pitch.frequency : undefined,
      deltaMs
    );

    // FSM State Dispatch
    switch (this.state) {
      case "CONFIGURING_DSP":
        // Wait 50ms for smooth filter cutoff ramp to settle
        if (this.stateTimerMs >= 50) {
          this.transitionTo("AWAITING_PLUCK");
        }
        break;

      case "AWAITING_PLUCK":
        this.inactivityTimerMs += deltaMs;
        if (this.inactivityTimerMs >= 12000 && this.stateTimerMs % 1000 < 50) {
          this.notify();
        }

        if (transient.isOnset) {
          this.inactivityTimerMs = 0;
          this.lastOnsetTimestamp = Date.now();
          this.transitionTo("ATTACK_SETTLING");
        } else if (transient.isRejected && transient.rejectionReason === "WRONG_STRING_WINDOW") {
          this.feedbackMessage = `Detectamos outra corda — por favor, toque a ${currentTarget.displayName}`;
          this.notify();
        }
        break;

      case "ATTACK_SETTLING":
        // Wait 60ms to skip mechanical pitch glide / pick scratch
        if (this.stateTimerMs >= 60) {
          this.transitionTo("MEASURING_SUSTAIN");
        }
        break;

      case "MEASURING_SUSTAIN":
        // Capture stable harmonic sustain frame
        if (pitch.frequency > 0 && pitch.clarity >= 0.7) {
          const centsOffset =
            1200 * (Math.log(pitch.frequency / targetFreq) / Math.LN2);

          // Capture harmonics for string
          const stringCapture = GuitarCalibrationService.captureString(
            timeBuffer,
            freqBuffer,
            sampleRate,
            currentTarget.stringNumber ?? 6
          );

          this.plucks.push({
            frequency: pitch.frequency,
            clarity: pitch.clarity,
            rms: transient.rms,
            centsOffset,
            harmonics: stringCapture.harmonics,
          });

          const count = this.plucks.length;
          this.playPluckChime(count);
          this.feedbackMessage = `Toque ${count}/3 confirmado!`;

          if (this.plucks.length < 3) {
            this.transitionTo("COOLDOWN_WAIT");
          } else {
            this.transitionTo("STEP_COMPLETE");
            this.evaluatePlucksAndAdvance(currentTarget, timeBuffer, freqBuffer, sampleRate);
          }
        } else if (this.stateTimerMs >= 400) {
          // Timeout without sustained pitch -> return to awaiting pluck
          this.transitionTo("AWAITING_PLUCK");
        }
        break;

      case "PLUCK_CONFIRMED":
        if (this.plucks.length < 3) {
          this.transitionTo("COOLDOWN_WAIT");
        } else {
          this.transitionTo("STEP_COMPLETE");
          this.evaluatePlucksAndAdvance(currentTarget, timeBuffer, freqBuffer, sampleRate);
        }
        break;

      case "COOLDOWN_WAIT":
        // 400ms cooldown to let vibration decay before next pluck
        if (this.stateTimerMs >= 400) {
          this.transitionTo("AWAITING_PLUCK");
        }
        break;

      case "STEP_COMPLETE":
        this.evaluatePlucksAndAdvance(currentTarget, timeBuffer, freqBuffer, sampleRate);
        break;

      case "AUTO_ADVANCING":
        this.autoAdvanceCountdownMs -= deltaMs;
        if (this.autoAdvanceCountdownMs <= 0) {
          if (this.currentTargetIndex + 1 < this.targets.length) {
            this.currentTargetIndex++;
            this.plucks = [];
            this.outlierRejected = false;
            this.transitionTo("CONFIGURING_DSP");
          } else {
            this.finishCalibration();
          }
        } else {
          this.notify();
        }
        break;
    }
  }

  /**
   * Statistical Fusion & Outlier Rejection:
   * w_k = q_k^2 * sqrt(RMS_k)
   * sigma_cents = 1200 * sigma_f0 / (f0_mean * ln(2))
   * If sigma_cents > 18.0: drop outlier, step back to 2/3 plucks, play miss sound.
   */
  private evaluatePlucksAndAdvance(
    target: CalibrationTarget,
    timeBuffer: Float32Array,
    freqBuffer: Float32Array,
    sampleRate: number
  ): void {
    if (this.plucks.length < 3) {
      this.transitionTo("AWAITING_PLUCK");
      return;
    }

    // Compute statistical weights
    let weightSum = 0;
    const weights: number[] = [];
    for (let i = 0; i < 3; i++) {
      const p = this.plucks[i];
      const w = Math.max(1e-4, p.clarity * p.clarity * Math.sqrt(Math.max(1e-4, p.rms)));
      weights.push(w);
      weightSum += w;
    }

    let f0Mean = 0;
    for (let i = 0; i < 3; i++) {
      f0Mean += (weights[i] / weightSum) * this.plucks[i].frequency;
    }

    let varianceF0 = 0;
    for (let i = 0; i < 3; i++) {
      const diff = this.plucks[i].frequency - f0Mean;
      varianceF0 += (weights[i] / weightSum) * (diff * diff);
    }
    const sigmaF0 = Math.sqrt(varianceF0);
    const sigmaCents = 1200 * (sigmaF0 / (f0Mean * Math.LN2));

    if (sigmaCents > 18.0) {
      // Outlier detected! Find pluck farthest from weighted mean
      let maxDist = -1;
      let outlierIndex = 0;
      for (let i = 0; i < 3; i++) {
        const dist = Math.abs(this.plucks[i].frequency - f0Mean);
        if (dist > maxDist) {
          maxDist = dist;
          outlierIndex = i;
        }
      }

      // Remove outlier
      this.plucks.splice(outlierIndex, 1);
      this.outlierRejected = true;
      this.playMissSound();
      this.transitionTo(
        "AWAITING_PLUCK",
        "Toque inconsistente descartado. Por favor, dê mais 1 toque firme."
      );
      return;
    }

    // Coherent plucks confirmed! Consolidate string or chord calibration
    if (target.type === "string" && target.stringNumber) {
      const targetFreq = target.targetFrequency ?? f0Mean;
      const centsOffset =
        1200 * (Math.log(f0Mean / targetFreq) / Math.LN2);

      const captured = GuitarCalibrationService.captureString(
        timeBuffer,
        freqBuffer,
        sampleRate,
        target.stringNumber,
        Math.round(sigmaCents * 10) / 10,
        3
      );
      captured.measuredFrequency = Math.round(f0Mean * 100) / 100;
      captured.centsOffset = Math.round(centsOffset * 10) / 10;

      this.calibratedStrings[target.stringNumber] = captured;
    } else if (target.type === "chord" && target.chordId) {
      const chordCaptured = GuitarCalibrationService.captureChord(
        freqBuffer,
        sampleRate,
        target.chordId,
        target.displayName,
        0.95
      );
      this.calibratedChords[target.chordId] = chordCaptured;
    }

    this.transitionTo("AUTO_ADVANCING");
  }

  private finishCalibration(): void {
    const profile: GuitarCalibrationProfile = {
      version: 2,
      updatedAt: Date.now(),
      instrumentType: "acoustic_steel",
      strings: { ...this.calibratedStrings },
      chords: { ...this.calibratedChords },
    };

    GuitarCalibrationService.saveProfile(profile);

    // Actively inject profile into TunerEngine & ChordRecognizer
    this.audioEngine.getTunerEngine().setCalibrationProfile(profile);
    this.audioEngine.getChordRecognizer().setCalibrationProfile(profile);

    this.transitionTo("CALIBRATION_DONE");
  }
}
