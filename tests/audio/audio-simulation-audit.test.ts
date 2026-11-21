import { describe, it, expect } from "vitest";
import { YinDetector } from "@/audio/yin-detector";
import { TunerEngine } from "@/audio/tuner-engine";
import { ChordRecognizer } from "@/audio/chord-recognizer";
import { NoiseGate } from "@/audio/noise-gate";
import { GUITAR_STRINGS } from "@/audio/types";
import {
  generateSineWave,
  generateFftFromFrequencies,
} from "../helpers/synthetic-audio";

describe("Auditoria de Simulação de Áudio — Provas Matemáticas Rigorosas", () => {
  const SAMPLE_RATES = [44100, 48000];

  describe("1. Injeção de Frequências Exatas das 6 Cordas do Violão (±1 cent)", () => {
    const STANDARD_STRINGS = [
      { stringNumber: 6, name: "E2", note: "E", octave: 2, midi: 40, freq: 82.41, index: 0 },
      { stringNumber: 5, name: "A2", note: "A", octave: 2, midi: 45, freq: 110.00, index: 1 },
      { stringNumber: 4, name: "D3", note: "D", octave: 3, midi: 50, freq: 146.83, index: 2 },
      { stringNumber: 3, name: "G3", note: "G", octave: 3, midi: 55, freq: 196.00, index: 3 },
      { stringNumber: 2, name: "B3", note: "B", octave: 3, midi: 59, freq: 246.94, index: 4 },
      { stringNumber: 1, name: "E4", note: "E", octave: 4, midi: 64, freq: 329.63, index: 5 },
    ];

    for (const sampleRate of SAMPLE_RATES) {
      it(`comprova precisão <= 1 cent e nota MIDI exata para as 6 cordas a ${sampleRate} Hz`, () => {
        const yin = new YinDetector(sampleRate, 2048, 0.15);
        const tuner = new TunerEngine(sampleRate, 2048, 1.0);

        for (const str of STANDARD_STRINGS) {
          const buffer = generateSineWave(str.freq, sampleRate, 0.1, 0.8);

          // 1. Verificação direta no Algoritmo YIN
          const yinRes = yin.detect(buffer);
          expect(yinRes.frequency).toBeGreaterThan(0);
          expect(yinRes.clarity).toBeGreaterThan(0.9);

          const yinCentsError = Math.abs(1200 * Math.log2(yinRes.frequency / str.freq));
          expect(
            yinCentsError,
            `YIN: Corda ${str.name} a ${sampleRate}Hz desvio foi ${yinCentsError.toFixed(3)} cents`
          ).toBeLessThanOrEqual(1.0);

          // 2. Verificação no TunerEngine
          const tunerRes = tuner.process(buffer);
          expect(tunerRes.isGateOpen).toBe(true);
          expect(tunerRes.noteName).toBe(str.note);
          expect(tunerRes.octave).toBe(str.octave);
          expect(tunerRes.midiNote).toBe(str.midi);
          expect(tunerRes.stringIndex).toBe(str.index);
          expect(Math.abs(tunerRes.cents)).toBeLessThanOrEqual(1.0);
          expect(tunerRes.inTune).toBe(true);
          expect(tunerRes.clarity).toBeGreaterThan(0.9);
        }
      });
    }
  });

  describe("2. Injeção de Frequências Desafinadas (Comportamento da Agulha e Status InTune)", () => {
    const sampleRate = 44100;

    it("comprova que E2 + 4 Hz (86.41 Hz) aponta agulha para agudo (positivo) e desativa inTune", () => {
      const tuner = new TunerEngine(sampleRate, 2048, 1.0);
      tuner.setTargetString(6); // Trava na 6ª corda (E2 = 82.41 Hz)

      // E2 + 4 Hz = 86.41 Hz (+82 cents sharp em relação a E2)
      const buffer = generateSineWave(86.41, sampleRate, 0.1, 0.8);
      const res = tuner.process(buffer);

      expect(res.noteName).toBe("E");
      expect(res.octave).toBe(2);
      expect(res.targetFrequency).toBeCloseTo(82.41, 1);
      // Agulha deve apontar para o lado direito/positivo (sharp)
      expect(res.cents).toBeGreaterThan(5.0);
      // Indicador verde DEVE estar desativado
      expect(res.inTune).toBe(false);
    });

    it("comprova que E2 + 2 Hz (84.41 Hz) em modo cromático livre detecta E2 e desativa inTune", () => {
      const tuner = new TunerEngine(sampleRate, 2048, 1.0);
      // E2 + 2 Hz = 84.41 Hz (+41.5 cents sharp de E2, ainda dentro do semitom de E2)
      const buffer = generateSineWave(84.41, sampleRate, 0.1, 0.8);
      const res = tuner.process(buffer);

      expect(res.noteName).toBe("E");
      expect(res.octave).toBe(2);
      expect(res.cents).toBeGreaterThan(5.0);
      expect(res.inTune).toBe(false);
    });

    it("comprova que A2 - 3 Hz (107.00 Hz) aponta agulha para grave (negativo) e desativa inTune", () => {
      const tuner = new TunerEngine(sampleRate, 2048, 1.0);

      // A2 - 3 Hz = 107.00 Hz (-47.9 cents flat em relação a 110.00 Hz)
      const buffer = generateSineWave(107.00, sampleRate, 0.1, 0.8);
      const res = tuner.process(buffer);

      expect(res.noteName).toBe("A");
      expect(res.octave).toBe(2);
      expect(res.midiNote).toBe(45);
      // Agulha deve apontar para a esquerda/negativo (flat)
      expect(res.cents).toBeLessThan(-5.0);
      // Indicador verde DEVE estar desativado
      expect(res.inTune).toBe(false);
    });

    it("comprova resposta para G3 + 3 Hz (199.00 Hz) e B3 - 4 Hz (242.94 Hz)", () => {
      const tuner = new TunerEngine(sampleRate, 2048, 1.0);

      // G3 + 3 Hz = 199.00 Hz (+26 cents sharp)
      const gBuf = generateSineWave(199.00, sampleRate, 0.1, 0.8);
      const gRes = tuner.process(gBuf);
      expect(gRes.noteName).toBe("G");
      expect(gRes.cents).toBeGreaterThan(5.0);
      expect(gRes.inTune).toBe(false);

      // B3 - 4 Hz = 242.94 Hz (-28 cents flat)
      const bBuf = generateSineWave(242.94, sampleRate, 0.1, 0.8);
      const bRes = tuner.process(bBuf);
      expect(bRes.noteName).toBe("B");
      expect(bRes.cents).toBeLessThan(-5.0);
      expect(bRes.inTune).toBe(false);
    });
  });

  describe("3. Injeção de Espectros Sintéticos de Acordes (Reconhecimento >= 0.72 e Rejeição)", () => {
    const sampleRate = 44100;
    const fftSize = 4096;

    const CHORD_TEST_CASES = [
      {
        chordId: "Em",
        displayName: "Em maior/menor",
        freqs: [82.41, 123.47, 164.81, 196.00, 246.94, 329.63], // E2, B2, E3, G3, B3, E4
      },
      {
        chordId: "G",
        displayName: "Sol Maior",
        freqs: [98.00, 123.47, 146.83, 196.00, 246.94, 392.00], // G2, B2, D3, G3, B3, G4
      },
      {
        chordId: "D",
        displayName: "Ré Maior",
        freqs: [146.83, 220.00, 293.66, 369.99], // D3, A3, D4, F#4
      },
      {
        chordId: "C",
        displayName: "Dó Maior",
        freqs: [130.81, 164.81, 196.00, 261.63, 329.63], // C3, E3, G3, C4, E4
      },
      {
        chordId: "Am7",
        displayName: "Lá Menor com 7ª",
        freqs: [110.00, 164.81, 196.00, 261.63, 329.63], // A2, E3, G3, C4, E4
      },
      {
        chordId: "Bm7",
        displayName: "Si Menor com 7ª",
        freqs: [123.47, 146.83, 220.00, 246.94, 369.99], // B2, D3, A3, B3, F#4 (Voicing Bm7_easy de Tempo Perdido)
      },
      {
        chordId: "D6add9_Fsharp",
        displayName: "D6add9/F#",
        freqs: [92.50, 110.00, 146.83, 220.00, 246.94, 329.63], // F#2, A2, D3, A3, B3, E4
      },
    ];

    it("identifica com precisão todos os 7 acordes com similaridade cosseno >= 0.72", () => {
      const recognizer = new ChordRecognizer(sampleRate, fftSize, 0.72, 1);

      for (const tc of CHORD_TEST_CASES) {
        const fft = generateFftFromFrequencies(tc.freqs, sampleRate, fftSize);
        const result = recognizer.processSpectrum(fft, true, 0.05);

        expect(
          result.chordId,
          `Esperava identificar '${tc.chordId}', mas identificou '${result.chordId}'`
        ).toBe(tc.chordId);

        expect(
          result.confidence,
          `Confiança para '${tc.chordId}' foi ${result.confidence.toFixed(3)}, esperava >= 0.72`
        ).toBeGreaterThanOrEqual(0.72);
      }
    });

    it("rejeita acordes divergentes (cross-similarity) com clara separação harmônica", () => {
      const recognizer = new ChordRecognizer(sampleRate, fftSize, 0.72, 1);

      // 1. Ao tocar espectro de Em: rejeita D, C, G e outros acordes do catálogo
      const emFft = generateFftFromFrequencies(
        [82.41, 123.47, 164.81, 196.00, 246.94, 329.63],
        sampleRate,
        fftSize
      );
      const emResult = recognizer.processSpectrum(emFft, true, 0.05);
      expect(emResult.chordId).toBe("Em");
      expect(emResult.chordId).not.toBe("D");
      expect(emResult.chordId).not.toBe("C");
      expect(emResult.chordId).not.toBe("Bm7");

      // 2. Ao tocar espectro de D: rejeita C, Am7, Em
      const dFft = generateFftFromFrequencies(
        [146.83, 220.00, 293.66, 369.99],
        sampleRate,
        fftSize
      );
      const dResult = recognizer.processSpectrum(dFft, true, 0.05);
      expect(dResult.chordId).toBe("D");
      expect(dResult.chordId).not.toBe("C");
      expect(dResult.chordId).not.toBe("Am7");
      expect(dResult.chordId).not.toBe("Em");

      // 3. Ao tocar ruído branco uniforme espectral: nenhum acorde atinge threshold de 0.72
      const noiseFft = new Float32Array(fftSize / 2).fill(-50);
      recognizer.resetHysteresis();
      const noiseResult = recognizer.processSpectrum(noiseFft, true, 0.05);
      expect(noiseResult.chordId).toBe("NO_CHORD");
      expect(noiseResult.confidence).toBeLessThan(0.72);
      expect(noiseResult.displayName).toBe("Nenhum Acorde");
    });
  });

  describe("4. Prova do Noise Gate (Supressão de Ruídos Abaixo do Threshold sem Falsos Positivos)", () => {
    const sampleRate = 44100;

    it("retorna frequência nula (-1), sem nota e zero falsos positivos quando sinal < thresholdOpen", () => {
      const tuner = new TunerEngine(sampleRate, 2048, 1.0, {
        thresholdOpen: 0.015,
        thresholdClose: 0.0075,
      });

      // Simulação de ruído branco de microfone de baixa amplitude (RMS ~ 0.005, bem abaixo de 0.015)
      const lowNoiseBuffer = new Float32Array(2048);
      for (let i = 0; i < lowNoiseBuffer.length; i++) {
        lowNoiseBuffer[i] = (Math.random() - 0.5) * 0.01; // pico ±0.005, RMS ~ 0.0029
      }

      const res = tuner.process(lowNoiseBuffer);

      // Verificação de supressão matemática
      expect(res.isGateOpen).toBe(false);
      expect(res.rms).toBeLessThan(0.015);
      expect(res.frequency).toBe(-1);
      expect(res.smoothedFrequency).toBe(-1);
      expect(res.cents).toBe(0);
      expect(res.inTune).toBe(false);
      expect(res.noteName).toBe("-");
      expect(res.stringIndex).toBe(-1);
    });

    it("abre o gate imediatamente na chegada de sinal acústico válido e fecha após release", () => {
      const gate = new NoiseGate({
        thresholdOpen: 0.015,
        thresholdClose: 0.0075,
        releaseTimeMs: 100,
      });

      // 1. Ruído de piso: gate fechado
      const floorBuf = new Float32Array(2048).fill(0.004);
      expect(gate.process(floorBuf, 16)).toBe(false);

      // 2. Ataque do violão (RMS = 0.06): gate abre no mesmo frame
      const guitarBuf = generateSineWave(110.0, sampleRate, 0.05, 0.5);
      expect(gate.process(guitarBuf, 16)).toBe(true);

      // 3. Região de histerese (RMS = 0.011, entre 0.0075 e 0.015): permanece aberto
      const sustainBuf = new Float32Array(2048).fill(0.011);
      expect(gate.process(sustainBuf, 16)).toBe(true);
      expect(gate.process(sustainBuf, 50)).toBe(true);

      // 4. Retorno ao silêncio total (RMS = 0.001): fecha após decorridos os 100ms
      const silenceBuf = new Float32Array(2048).fill(0.001);
      expect(gate.process(silenceBuf, 50)).toBe(true); // 50ms < 100ms release -> ainda aberto
      expect(gate.process(silenceBuf, 60)).toBe(false); // 110ms > 100ms release -> fecha
      expect(gate.getIsOpen()).toBe(false);
    });
  });
});
