import { GUITAR_STRINGS, NOTE_NAMES } from "./types";
import { YinDetector } from "./yin-detector";

export interface StringCalibrationData {
  stringNumber: number; // 6 a 1
  name: string; // E2, A2, D3, G3, B3, E4
  targetFrequency: number;
  measuredFrequency: number;
  centsOffset: number;
  harmonics: { frequency: number; amplitudeDb: number }[];
  clarity: number;
}

export interface ChordCalibrationData {
  chordId: string;
  displayName: string;
  chromagram: number[]; // 12 classes C..B normalizadas
  capturedAt: number;
}

export interface GuitarCalibrationProfile {
  version: number;
  updatedAt: number;
  strings: Record<number, StringCalibrationData>;
  chords: Record<string, ChordCalibrationData>;
}

export const CALIBRATION_STORAGE_KEY = "ez_viola_guitar_calibration";

export class GuitarCalibrationService {
  /**
   * Captures string frequency, cents offset, clarity, and harmonic profile from audio buffers.
   *
   * @param timeBuffer Raw time-domain samples (e.g. 2048 samples)
   * @param freqBuffer Frequency-domain spectrum in dBFS (AnalyserNode.getFloatFrequencyData)
   * @param sampleRate Hardware audio sample rate (e.g. 44100 or 48000)
   * @param stringNumber Guitar string number (6 for low E2, down to 1 for high E4)
   */
  public static captureString(
    timeBuffer: Float32Array,
    freqBuffer: Float32Array,
    sampleRate: number,
    stringNumber: number
  ): StringCalibrationData {
    const stringSpec = GUITAR_STRINGS.find((s) => s.stringNumber === stringNumber) ?? {
      stringNumber,
      name: `Corda ${stringNumber}`,
      targetFrequency: 110.0,
      noteName: "A",
      octave: 2,
      midiNote: 45,
      color: "#10B981",
    };

    // 1. Fundamental frequency and clarity via YIN Algorithm
    const yin = new YinDetector(sampleRate, timeBuffer.length, 0.15);
    const pitch = yin.detect(timeBuffer);

    const measuredFreq =
      pitch.frequency > 0 ? pitch.frequency : stringSpec.targetFrequency;
    const clarity = pitch.clarity;

    // Cents offset relative to standard target: 1200 * log2(f_measured / f_target)
    const centsOffset =
      Math.round(
        1200 * (Math.log(measuredFreq / stringSpec.targetFrequency) / Math.LN2) * 10
      ) / 10;

    // 2. Harmonics detection from FFT spectrum
    const binCount = freqBuffer.length;
    const fftSize = binCount * 2;
    const binWidth = sampleRate / fftSize;

    const harmonics: { frequency: number; amplitudeDb: number }[] = [];

    // Extract first 6 harmonics (h = 1 fundamental, h = 2..6 overtones)
    for (let h = 1; h <= 6; h++) {
      const targetHarmonicFreq = measuredFreq * h;
      if (targetHarmonicFreq >= sampleRate / 2) break;

      const targetBin = Math.round(targetHarmonicFreq / binWidth);
      let peakDb = -120;
      let peakBin = targetBin;

      // Search +/- 3 bins around target bin for exact local peak
      const searchStart = Math.max(1, targetBin - 3);
      const searchEnd = Math.min(binCount - 2, targetBin + 3);

      for (let b = searchStart; b <= searchEnd; b++) {
        if (freqBuffer[b] > peakDb) {
          peakDb = freqBuffer[b];
          peakBin = b;
        }
      }

      // Parabolic peak refinement
      let binDelta = 0;
      if (peakBin > 0 && peakBin < binCount - 1) {
        const y1 = freqBuffer[peakBin - 1];
        const y2 = freqBuffer[peakBin];
        const y3 = freqBuffer[peakBin + 1];
        const denom = y1 - 2 * y2 + y3;
        if (Math.abs(denom) > 1e-5) {
          binDelta = (0.5 * (y1 - y3)) / denom;
          binDelta = Math.max(-0.5, Math.min(0.5, binDelta));
        }
      }

      const exactFreq = (peakBin + binDelta) * binWidth;

      harmonics.push({
        frequency: Math.round(exactFreq * 10) / 10,
        amplitudeDb: Math.round(peakDb * 10) / 10,
      });
    }

    return {
      stringNumber,
      name: stringSpec.name,
      targetFrequency: stringSpec.targetFrequency,
      measuredFrequency: Math.round(measuredFreq * 100) / 100,
      centsOffset,
      harmonics,
      clarity: Math.round(clarity * 100) / 100,
    };
  }

  /**
   * Captures real-world acoustic chord chromagram vector (12-PCP) from frequency spectrum.
   * Uses linear magnitude with dynamic floor and soft compression (mag^0.7).
   */
  public static captureChord(
    freqBuffer: Float32Array,
    sampleRate: number,
    chordId: string,
    displayName: string
  ): ChordCalibrationData {
    const binCount = freqBuffer.length;
    const fftSize = binCount * 2;
    const binWidth = sampleRate / fftSize;

    const minBin = Math.max(1, Math.floor(75 / binWidth));
    const maxBin = Math.min(binCount - 1, Math.ceil(2200 / binWidth));

    // Dynamic noise floor
    let peakDb = -120;
    for (let k = minBin; k <= maxBin; k++) {
      if (freqBuffer[k] > peakDb) {
        peakDb = freqBuffer[k];
      }
    }

    const minDb = Math.max(peakDb - 35, -75);
    const chromagramRaw = new Float32Array(12);

    for (let k = minBin; k <= maxBin; k++) {
      const db = freqBuffer[k];
      if (db < minDb) continue;

      const mag = Math.pow(10, db / 20);
      const power = Math.pow(mag, 0.7);
      const freq = k * binWidth;

      const semitone = 12 * (Math.log(freq / 440) / Math.LN2) + 69;
      const pitchClass = ((Math.round(semitone) % 12) + 12) % 12;

      chromagramRaw[pitchClass] += power;
    }

    // L2 Normalization
    let sumSq = 0;
    for (let i = 0; i < 12; i++) {
      sumSq += chromagramRaw[i] * chromagramRaw[i];
    }
    const norm = Math.sqrt(sumSq + 1e-9);
    const normalizedChroma: number[] = [];
    for (let i = 0; i < 12; i++) {
      normalizedChroma.push(Math.round((chromagramRaw[i] / norm) * 1000) / 1000);
    }

    return {
      chordId,
      displayName,
      chromagram: normalizedChroma,
      capturedAt: Date.now(),
    };
  }

  /**
   * Loads calibration profile from localStorage. Returns null if not present or invalid.
   */
  public static loadProfile(): GuitarCalibrationProfile | null {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }

    try {
      const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as GuitarCalibrationProfile;
      if (!parsed || typeof parsed !== "object" || !parsed.strings || !parsed.chords) {
        return null;
      }

      return parsed;
    } catch (err) {
      console.warn("Failed to load guitar calibration profile:", err);
      return null;
    }
  }

  /**
   * Returns stored profile or a new blank default profile if none exists.
   */
  public static getProfile(): GuitarCalibrationProfile {
    const stored = this.loadProfile();
    if (stored) return stored;

    return {
      version: 1,
      updatedAt: Date.now(),
      strings: {},
      chords: {},
    };
  }

  /**
   * Saves calibration profile to localStorage.
   */
  public static saveProfile(profile: GuitarCalibrationProfile): void {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    try {
      profile.updatedAt = Date.now();
      localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(profile));
    } catch (err) {
      console.error("Failed to save guitar calibration profile:", err);
    }
  }

  /**
   * Records or updates calibration for one specific string.
   */
  public static updateStringCalibration(
    data: StringCalibrationData
  ): GuitarCalibrationProfile {
    const profile = this.getProfile();
    profile.strings[data.stringNumber] = data;
    this.saveProfile(profile);
    return profile;
  }

  /**
   * Records or updates calibration for one specific chord.
   */
  public static updateChordCalibration(
    data: ChordCalibrationData
  ): GuitarCalibrationProfile {
    const profile = this.getProfile();
    profile.chords[data.chordId] = data;
    this.saveProfile(profile);
    return profile;
  }

  /**
   * Clears saved calibration profile from localStorage.
   */
  public static clearProfile(): void {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    try {
      localStorage.removeItem(CALIBRATION_STORAGE_KEY);
    } catch {}
  }

  /**
   * Generates a readable diagnostic report in text format with exact frequencies,
   * offsets, harmonics, and chord chromagrams for 1-click clipboard copy.
   */
  public static generateDiagnosticReport(
    customProfile?: GuitarCalibrationProfile
  ): string {
    const profile = customProfile ?? this.getProfile();
    const dateStr = new Date(profile.updatedAt).toLocaleString("pt-BR");

    const lines: string[] = [
      "==================================================================",
      "EZVIOLA - RELATÓRIO DE CALIBRAÇÃO ACÚSTICA DO VIOLÃO & MICROFONE",
      "==================================================================",
      `Data da Calibração: ${dateStr}`,
      `Versão do Perfil: ${profile.version}`,
      "",
      "--- 1. RESPOSTA ESPECTRAL POR CORDA (6 a 1) ---",
    ];

    const stringKeys = [6, 5, 4, 3, 2, 1];
    let calibratedStringCount = 0;

    for (const strNum of stringKeys) {
      const data = profile.strings[strNum];
      if (!data) {
        lines.push(`Corda ${strNum}: [NÃO CALIBRADA]`);
        continue;
      }

      calibratedStringCount++;
      const sign = data.centsOffset >= 0 ? "+" : "";
      lines.push(
        `Corda ${strNum} (${data.name}):`
      );
      lines.push(
        `  Alvo: ${data.targetFrequency.toFixed(2)} Hz | Medido: ${data.measuredFrequency.toFixed(2)} Hz (Desvio: ${sign}${data.centsOffset.toFixed(1)} cents) | Clareza: ${(data.clarity * 100).toFixed(0)}%`
      );

      if (data.harmonics && data.harmonics.length > 0) {
        const hLines = data.harmonics.map((h, i) => {
          const isFund = i === 0;
          const label = isFund ? "H1 (Fund)" : `H${i + 1}`;
          return `${label}: ${h.frequency.toFixed(1)} Hz (${h.amplitudeDb.toFixed(1)} dBFS)`;
        });
        lines.push(`  Harmônicos: ${hLines.join(" | ")}`);
      }
    }

    lines.push("");
    lines.push("--- 2. ASSINATURAS HARMÔNICAS DE ACORDES (CROMAGRAMAS L2) ---");

    const chordKeys = Object.keys(profile.chords);
    if (chordKeys.length === 0) {
      lines.push("[NENHUM ACORDE CALIBRADO]");
    } else {
      for (const chordId of chordKeys) {
        const chord = profile.chords[chordId];
        lines.push(`[${chord.chordId}] ${chord.displayName}:`);

        // Find top 4 prominent classes
        const classScores = chord.chromagram.map((val, idx) => ({
          note: NOTE_NAMES[idx],
          val,
        }));
        classScores.sort((a, b) => b.val - a.val);
        const topClasses = classScores
          .slice(0, 4)
          .map((c) => `${c.note}: ${c.val.toFixed(3)}`)
          .join(", ");

        const vectorStr = chord.chromagram
          .map((v, i) => `${NOTE_NAMES[i]}:${v.toFixed(2)}`)
          .join(" ");

        lines.push(`  PCP: ${vectorStr}`);
        lines.push(`  Classes Principais: ${topClasses}`);
      }
    }

    lines.push("");
    lines.push("--- 3. PAYLOAD JSON DE CALIBRAÇÃO (PARA IMPORTAÇÃO) ---");
    lines.push(JSON.stringify(profile, null, 2));
    lines.push("==================================================================");

    return lines.join("\n");
  }
}
