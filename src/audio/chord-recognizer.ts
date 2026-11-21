import { ChordResult } from "./types";
import { ALL_CHORD_TEMPLATES, ChordTemplate } from "./chord-templates";

export class ChordRecognizer {
  private sampleRate: number;
  private fftSize: number;
  private minConfidence: number;
  private minFramesForConfirmation: number;

  // Active templates pool
  private templates: ChordTemplate[];

  // Pre-allocated buffers for Zero-GC
  private chromagramRaw: Float32Array = new Float32Array(12);
  private chromagramNorm: Float32Array = new Float32Array(12);
  private result: ChordResult;

  // Temporal hysteresis tracking
  private candidateChordId: string = "NO_CHORD";
  private consecutiveFrames: number = 0;
  private confirmedChordId: string = "NO_CHORD";
  private confirmedDisplayName: string = "Nenhum Acorde";

  constructor(
    sampleRate: number = 44100,
    fftSize: number = 4096,
    minConfidence: number = 0.72,
    minFramesForConfirmation: number = 8
  ) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.minConfidence = minConfidence;
    this.minFramesForConfirmation = minFramesForConfirmation;
    this.templates = [...ALL_CHORD_TEMPLATES];

    this.result = {
      chordId: "NO_CHORD",
      displayName: "Nenhum Acorde",
      confidence: 0,
      chromagram: this.chromagramNorm,
      rms: 0,
      isGateOpen: false,
    };
  }

  public setSampleRate(sampleRate: number): void {
    this.sampleRate = sampleRate;
  }

  /**
   * Restricts recognition to a subset of chord templates (e.g. active song chords)
   * to enhance discrimination accuracy and eliminate distant harmonic collisions.
   */
  public setActiveChords(chordIds: string[] | null): void {
    if (!chordIds || chordIds.length === 0) {
      this.templates = [...ALL_CHORD_TEMPLATES];
    } else {
      const filtered = ALL_CHORD_TEMPLATES.filter((t) =>
        chordIds.includes(t.chordId)
      );
      this.templates = filtered.length > 0 ? filtered : [...ALL_CHORD_TEMPLATES];
    }
  }

  public resetHysteresis(): void {
    this.candidateChordId = "NO_CHORD";
    this.consecutiveFrames = 0;
    this.confirmedChordId = "NO_CHORD";
    this.confirmedDisplayName = "Nenhum Acorde";
  }

  /**
   * Processes magnitude spectrum in dBFS from AnalyserNode.getFloatFrequencyData().
   * Zero-GC: updates and returns internal ChordResult reference.
   *
   * @param frequencyData Float32Array of length fftSize / 2
   * @param isGateOpen Whether noise gate is currently open
   * @param rms Overall audio signal RMS
   */
  public processSpectrum(
    frequencyData: Float32Array,
    isGateOpen: boolean = true,
    rms: number = 0.05
  ): ChordResult {
    this.result.isGateOpen = isGateOpen;
    this.result.rms = rms;

    // Fast exit if gate is closed or silent
    if (!isGateOpen || rms < 0.008) {
      this.chromagramNorm.fill(0);
      this.resetHysteresis();
      this.result.chordId = "NO_CHORD";
      this.result.displayName = "Nenhum Acorde";
      this.result.confidence = 0;
      return this.result;
    }

    const binCount = frequencyData.length;
    const binWidth = this.sampleRate / this.fftSize;

    // Reset raw chromagram
    this.chromagramRaw.fill(0);

    // Useful acoustic guitar range: 75 Hz to 2200 Hz
    const minBin = Math.max(1, Math.floor(75 / binWidth));
    const maxBin = Math.min(binCount - 1, Math.ceil(2200 / binWidth));

    for (let k = minBin; k <= maxBin; k++) {
      const db = frequencyData[k];
      if (db < -70) continue; // Skip noise floor

      // Convert dB to linear power: 10^(dB / 10)
      const linearPower = Math.pow(10, db / 10);
      const freq = k * binWidth;

      // Continuous pitch semitone: 12 * log2(f / 440) + 69
      const semitone = 12 * (Math.log(freq / 440) / Math.LN2) + 69;
      const pitchClass = ((Math.round(semitone) % 12) + 12) % 12;

      this.chromagramRaw[pitchClass] += linearPower;
    }

    // Step 2: L2 Normalization of Chromagram
    let sumSq = 0;
    for (let i = 0; i < 12; i++) {
      const val = this.chromagramRaw[i];
      sumSq += val * val;
    }

    const norm = Math.sqrt(sumSq + 1e-9);
    for (let i = 0; i < 12; i++) {
      this.chromagramNorm[i] = this.chromagramRaw[i] / norm;
    }

    // Step 3: Cosine Similarity matching via Dot Product
    let bestScore = -1;
    let bestTemplate: ChordTemplate | null = null;

    const templates = this.templates;
    const templateCount = templates.length;

    for (let t = 0; t < templateCount; t++) {
      const tpl = templates[t];
      const vec = tpl.vector;

      let dotProduct = 0;
      for (let i = 0; i < 12; i++) {
        dotProduct += this.chromagramNorm[i] * vec[i];
      }

      if (dotProduct > bestScore) {
        bestScore = dotProduct;
        bestTemplate = tpl;
      }
    }

    // Step 4: Temporal Debouncing & Hysteresis
    if (bestTemplate && bestScore >= this.minConfidence) {
      if (bestTemplate.chordId === this.candidateChordId) {
        this.consecutiveFrames++;
      } else {
        this.candidateChordId = bestTemplate.chordId;
        this.consecutiveFrames = 1;
      }

      if (this.consecutiveFrames >= this.minFramesForConfirmation) {
        this.confirmedChordId = bestTemplate.chordId;
        this.confirmedDisplayName = bestTemplate.displayName;
      }

      // Populate result with immediate best candidate and confidence
      this.result.chordId = bestTemplate.chordId;
      this.result.displayName = bestTemplate.displayName;
      this.result.confidence = bestScore;
    } else {
      this.resetHysteresis();
      this.result.chordId = "NO_CHORD";
      this.result.displayName = "Nenhum Acorde";
      this.result.confidence = Math.max(0, bestScore);
    }

    return this.result;
  }

  public getConfirmedChordId(): string {
    return this.confirmedChordId;
  }

  public getConfirmedDisplayName(): string {
    return this.confirmedDisplayName;
  }
}
