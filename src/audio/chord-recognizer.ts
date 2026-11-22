import { ChordResult } from "./types";
import { ALL_CHORD_TEMPLATES, ChordTemplate } from "./chord-templates";
import {
  GuitarCalibrationProfile,
  GuitarCalibrationService,
} from "./guitar-calibration";

export class ChordRecognizer {
  private sampleRate: number;
  private fftSize: number;
  private minConfidence: number;
  private minFramesForConfirmation: number;

  // Active templates pool
  private templates: ChordTemplate[];
  private activeChordFilter: string[] | null = null;
  private calibrationProfile: GuitarCalibrationProfile | null = null;

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
    minConfidence: number = 0.58,
    minFramesForConfirmation: number = 4
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

    // Load custom guitar calibration from localStorage if available
    this.loadCalibrationFromStorage();
  }

  public setSampleRate(sampleRate: number): void {
    this.sampleRate = sampleRate;
  }

  /**
   * Sets or updates custom guitar calibration profile.
   * Replaces default chord vectors with user's real acoustic chord chromagrams.
   */
  public setCalibrationProfile(profile: GuitarCalibrationProfile | null): void {
    this.calibrationProfile = profile;
    this.rebuildTemplates();
  }

  public getCalibrationProfile(): GuitarCalibrationProfile | null {
    return this.calibrationProfile;
  }

  public loadCalibrationFromStorage(): void {
    try {
      const stored = GuitarCalibrationService.loadProfile();
      if (stored) {
        this.calibrationProfile = stored;
        this.rebuildTemplates();
      }
    } catch {}
  }

  private rebuildTemplates(): void {
    // Clone base chord templates to avoid mutating constant ALL_CHORD_TEMPLATES
    const baseTemplates: ChordTemplate[] = ALL_CHORD_TEMPLATES.map((t) => ({
      chordId: t.chordId,
      displayName: t.displayName,
      root: t.root,
      vector: new Float32Array(t.vector),
    }));

    // If custom chord calibration exists, inject user's real calibrated chromagrams
    if (this.calibrationProfile?.chords) {
      for (const chordId of Object.keys(this.calibrationProfile.chords)) {
        const cal = this.calibrationProfile.chords[chordId];
        const existing = baseTemplates.find((t) => t.chordId === chordId);
        if (existing) {
          existing.vector = new Float32Array(cal.chromagram);
        } else {
          baseTemplates.push({
            chordId: cal.chordId,
            displayName: cal.displayName,
            root: 0,
            vector: new Float32Array(cal.chromagram),
          });
        }
      }
    }

    if (!this.activeChordFilter || this.activeChordFilter.length === 0) {
      this.templates = baseTemplates;
    } else {
      const filtered = baseTemplates.filter((t) =>
        this.activeChordFilter!.includes(t.chordId)
      );
      this.templates = filtered.length > 0 ? filtered : baseTemplates;
    }
  }

  /**
   * Restricts recognition to a subset of chord templates (e.g. active song chords)
   * to enhance discrimination accuracy and eliminate distant harmonic collisions.
   */
  public setActiveChords(chordIds: string[] | null): void {
    this.activeChordFilter = chordIds;
    this.rebuildTemplates();
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

    // Dynamic noise floor: find peakDb in acoustic guitar range
    let peakDb = -120;
    for (let k = minBin; k <= maxBin; k++) {
      if (frequencyData[k] > peakDb) {
        peakDb = frequencyData[k];
      }
    }

    // Dynamic floor: peakDb - 35 dBFS, clamped at minimum -75 dBFS
    const minDb = Math.max(peakDb - 35, -75);

    for (let k = minBin; k <= maxBin; k++) {
      const db = frequencyData[k];
      if (db < minDb) continue;

      // Linear magnitude with dynamic floor: 10^(db / 20)
      const mag = Math.pow(10, db / 20);
      // Soft magnitude compression (mag^0.7) to balance triads and tetrads
      const power = Math.pow(mag, 0.7);
      const freq = k * binWidth;

      // Continuous pitch semitone: 12 * log2(f / 440) + 69
      const semitone = 12 * (Math.log(freq / 440) / Math.LN2) + 69;
      const pitchClass = ((Math.round(semitone) % 12) + 12) % 12;

      this.chromagramRaw[pitchClass] += power;
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

    // Step 3: Cosine Similarity matching via Dot Product with Triad/Tetrad Balancing
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

      let score = dotProduct;

      // Balance triads and tetrads:
      // 1. 7th chords: if 7th interval is weaker than 55% of the root in chromagram,
      // it is acoustic harmonic bleed (e.g. 3rd harmonic of minor 3rd), so penalize false tetrad
      if (tpl.chordId.endsWith("7") || tpl.chordId.endsWith("m7")) {
        const seventhClass = (tpl.root + 10) % 12;
        if (this.chromagramNorm[seventhClass] < 0.55 * this.chromagramNorm[tpl.root]) {
          score *= 0.93;
        }
      }

      // 2. D6add9_Fsharp: requires prominent ringing E (pitchClass 4) >= 0.35
      // to avoid overshadowing Bm7 which shares the other 4 notes
      if (tpl.chordId === "D6add9_Fsharp") {
        if (this.chromagramNorm[4] < 0.35) {
          score *= 0.90;
        }
      }

      // 3. Minor 7th vs relative major triad (e.g. Am7 vs C):
      // If root A is distinctly present in the chromagram (>= 0.25), give tetrad proper consideration
      if (tpl.chordId === "C" && this.chromagramNorm[9] > 0.25) {
        score *= 0.95;
      }

      if (score > bestScore) {
        bestScore = score;
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
