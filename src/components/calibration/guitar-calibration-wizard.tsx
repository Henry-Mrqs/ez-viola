"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AudioEngine } from "@/audio/audio-engine";
import {
  GuitarCalibrationService,
  StringCalibrationData,
  ChordCalibrationData,
} from "@/audio/guitar-calibration";
import { GUITAR_STRINGS, NOTE_NAMES } from "@/audio/types";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Sparkles,
  Sliders,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  RotateCcw,
  Music,
  X,
  Activity,
  Layers,
} from "lucide-react";
import { clsx } from "clsx";

interface GuitarCalibrationWizardProps {
  engine: AudioEngine;
  isOpen?: boolean;
  onClose?: () => void;
  standalone?: boolean;
}

const CALIBRATION_CHORDS = [
  { id: "Em", name: "Mi Menor (Em)", desc: "Tríade menor aberta (E - G - B)" },
  { id: "G", name: "Sol Maior (G)", desc: "Tríade maior aberta com 6 cordas (G - B - D)" },
  { id: "D", name: "Ré Maior (D)", desc: "Tríade maior nas 4 cordas agudas (D - F# - A)" },
  { id: "C", name: "Dó Maior (C)", desc: "Tríade maior padrão de 5 cordas (C - E - G)" },
  { id: "Am7", name: "Lá Menor com 7ª (Am7)", desc: "Tétrade menor com 7ª aberta (A - C - E - G)" },
  { id: "Bm7", name: "Si Menor com 7ª (Bm7)", desc: "Tétrade fácil de Tempo Perdido (B - D - F# - A)" },
];

export function GuitarCalibrationWizard({
  engine,
  isOpen = true,
  onClose,
  standalone = false,
}: GuitarCalibrationWizardProps) {
  const [phase, setPhase] = useState<"intro" | "strings" | "chords" | "summary">("intro");
  const [currentStringIdx, setCurrentStringIdx] = useState<number>(0);
  const [currentChordIdx, setCurrentChordIdx] = useState<number>(0);

  const [capturedStrings, setCapturedStrings] = useState<Record<number, StringCalibrationData>>({});
  const [capturedChords, setCapturedChords] = useState<Record<string, ChordCalibrationData>>({});

  // Real-time audio visualizers
  const [liveFreq, setLiveFreq] = useState<number>(-1);
  const [liveClarity, setLiveClarity] = useState<number>(0);
  const [liveRms, setLiveRms] = useState<number>(0);
  const [liveChroma, setLiveChroma] = useState<number[]>(new Array(12).fill(0));
  const [copied, setCopied] = useState<boolean>(false);

  const animationFrameRef = useRef<number | null>(null);

  // Load existing profile on mount
  useEffect(() => {
    const existing = GuitarCalibrationService.loadProfile();
    if (existing) {
      setCapturedStrings(existing.strings || {});
      setCapturedChords(existing.chords || {});
    }
  }, []);

  // Real-time monitoring loop
  useEffect(() => {
    if (!isOpen && !standalone) return;

    const updateLiveVisuals = () => {
      const timeBuf = engine.getTimeBuffer();
      const freqBuf = engine.getFreqBuffer();
      const sampleRate = engine.getSampleRate();

      // RMS
      let sumSq = 0;
      for (let i = 0; i < timeBuf.length; i++) {
        sumSq += timeBuf[i] * timeBuf[i];
      }
      const rms = Math.sqrt(sumSq / timeBuf.length);
      setLiveRms(rms);

      // Tuner live frequency
      const tuner = engine.getTunerEngine();
      const isGateOpen = tuner.getNoiseGate().getIsOpen();

      if (isGateOpen && rms > 0.008) {
        // Compute live chromagram for visual feedback
        const binWidth = sampleRate / 4096;
        const minBin = Math.max(1, Math.floor(75 / binWidth));
        const maxBin = Math.min(freqBuf.length - 1, Math.ceil(2200 / binWidth));

        let peakDb = -120;
        for (let k = minBin; k <= maxBin; k++) {
          if (freqBuf[k] > peakDb) peakDb = freqBuf[k];
        }
        const minDb = Math.max(peakDb - 35, -75);
        const raw = new Float32Array(12);

        for (let k = minBin; k <= maxBin; k++) {
          const db = freqBuf[k];
          if (db < minDb) continue;
          const mag = Math.pow(10, db / 20);
          const power = Math.pow(mag, 0.7);
          const freq = k * binWidth;
          const semitone = 12 * (Math.log(freq / 440) / Math.LN2) + 69;
          const pitchClass = ((Math.round(semitone) % 12) + 12) % 12;
          raw[pitchClass] += power;
        }

        let chromaSumSq = 0;
        for (let i = 0; i < 12; i++) chromaSumSq += raw[i] * raw[i];
        const norm = Math.sqrt(chromaSumSq + 1e-9);
        const normArr = Array.from(raw).map((v) => v / norm);
        setLiveChroma(normArr);
      } else {
        setLiveChroma(new Array(12).fill(0));
      }

      animationFrameRef.current = requestAnimationFrame(updateLiveVisuals);
    };

    animationFrameRef.current = requestAnimationFrame(updateLiveVisuals);

    const prevTunerUpdate = engine.onTunerUpdate;
    engine.onTunerUpdate = (res) => {
      prevTunerUpdate?.(res);
      setLiveFreq(res.smoothedFrequency > 0 ? res.smoothedFrequency : res.frequency);
      setLiveClarity(res.clarity);
    };

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      engine.onTunerUpdate = prevTunerUpdate;
    };
  }, [engine, isOpen, standalone]);

  const currentStringSpec = GUITAR_STRINGS[currentStringIdx];
  const currentChordSpec = CALIBRATION_CHORDS[currentChordIdx];

  const handleCaptureCurrentString = useCallback(() => {
    const timeBuf = engine.getTimeBuffer();
    const freqBuf = engine.getFreqBuffer();
    const sampleRate = engine.getSampleRate();

    const result = GuitarCalibrationService.captureString(
      timeBuf,
      freqBuf,
      sampleRate,
      currentStringSpec.stringNumber
    );

    const updatedProfile = GuitarCalibrationService.updateStringCalibration(result);
    setCapturedStrings({ ...updatedProfile.strings });

    // Instantly notify audio engines
    engine.getTunerEngine().setCalibrationProfile(updatedProfile);
  }, [engine, currentStringSpec]);

  const handleCaptureCurrentChord = useCallback(() => {
    const freqBuf = engine.getFreqBuffer();
    const sampleRate = engine.getSampleRate();

    const result = GuitarCalibrationService.captureChord(
      freqBuf,
      sampleRate,
      currentChordSpec.id,
      currentChordSpec.name
    );

    const updatedProfile = GuitarCalibrationService.updateChordCalibration(result);
    setCapturedChords({ ...updatedProfile.chords });

    // Instantly notify chord recognizer
    engine.getChordRecognizer().setCalibrationProfile(updatedProfile);
  }, [engine, currentChordSpec]);

  const handleCopyReport = async () => {
    const report = GuitarCalibrationService.generateDiagnosticReport();
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      setCopied(false);
    }
  };

  const handleClearCalibration = () => {
    GuitarCalibrationService.clearProfile();
    setCapturedStrings({});
    setCapturedChords({});
    engine.getTunerEngine().setCalibrationProfile(null);
    engine.getChordRecognizer().setCalibrationProfile(null);
  };

  if (!isOpen && !standalone) return null;

  const content = (
    <div className="flex flex-col h-full max-h-[85vh] sm:max-h-[800px] overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-800 bg-slate-900/90">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white">
              Calibração Acústica do Violão & Microfone
            </h2>
            <p className="text-xs text-slate-400">
              Adapta o afinador e o reconhecimento de acordes ao timbre real do seu instrumento
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Fechar Calibração"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 p-2 sm:px-6 bg-slate-950/60 border-b border-slate-800/80 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setPhase("intro")}
          className={clsx(
            "px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5",
            phase === "intro" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"
          )}
        >
          <span>Visão Geral</span>
        </button>
        <button
          onClick={() => setPhase("strings")}
          className={clsx(
            "px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5",
            phase === "strings" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"
          )}
        >
          <span>1. Corda por Corda</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
            {Object.keys(capturedStrings).length}/6
          </span>
        </button>
        <button
          onClick={() => setPhase("chords")}
          className={clsx(
            "px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5",
            phase === "chords" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"
          )}
        >
          <span>2. Acordes Reais</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
            {Object.keys(capturedChords).length}/{CALIBRATION_CHORDS.length}
          </span>
        </button>
        <button
          onClick={() => setPhase("summary")}
          className={clsx(
            "px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5",
            phase === "summary" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"
          )}
        >
          <span>3. Relatório & Salvar</span>
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* PHASE 1: INTRO */}
        {phase === "intro" && (
          <div className="max-w-2xl mx-auto space-y-6 py-4">
            <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                Por que a calibração com o seu violão é essencial?
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Microfones de notebook e celular possuem respostas de frequência próprias: muitos cortam
                graves abaixo de 100 Hz (fazendo as cordas graves <strong>E2</strong> e <strong>A2</strong> parecerem
                oitavadas no 2º harmônico) ou ressoam agudos que distorcem tríades e tétrades.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Fase 1: Cordas Soltas
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Você tocará cada corda solta (da 6ª à 1ª). O algoritmo memoriza a frequência fundamental
                    exata do seu instrumento e mapeia o perfil dos harmônicos para impedir saltos de oitava.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="text-sky-400 font-bold text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Fase 2: Acordes Reais
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Você tocará alguns acordes essenciais (Em, G, D, C, Am7). O EzViola grava a assinatura
                    espectral (cromagrama 12-PCP) com a ressonância e o timbre autêntico do seu violão.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  Ao final, você poderá <strong>copiar o relatório com 1 clique</strong> e colar no chat para
                  acompanhamento e ajustes finos!
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button size="lg" onClick={() => setPhase("strings")} className="gap-2">
                <span>Iniciar Fase 1: Corda por Corda</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* PHASE 2: STRINGS CALIBRATION */}
        {phase === "strings" && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* String Selector Pills */}
            <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
              {GUITAR_STRINGS.map((str, idx) => {
                const isCaptured = capturedStrings[str.stringNumber] !== undefined;
                const isCurrent = idx === currentStringIdx;
                return (
                  <button
                    key={str.stringNumber}
                    onClick={() => setCurrentStringIdx(idx)}
                    className={clsx(
                      "p-2 sm:p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all",
                      isCurrent
                        ? "bg-slate-800 border-emerald-500 ring-2 ring-emerald-500/30 text-white"
                        : isCaptured
                        ? "bg-slate-900/80 border-slate-700 text-emerald-400"
                        : "bg-slate-900/40 border-slate-800 text-slate-500 hover:text-slate-300"
                    )}
                  >
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Corda {str.stringNumber}
                    </span>
                    <span className="text-sm sm:text-base font-black">{str.name}</span>
                    {isCaptured ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-700" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Current Active String Card */}
            <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700 flex flex-col items-center text-center space-y-5">
              <div className="space-y-1">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                  Calibrando Corda {currentStringSpec.stringNumber} de 6
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-white">
                  Toque a Corda {currentStringSpec.name} ({currentStringSpec.noteName}) solta
                </h3>
                <p className="text-xs text-slate-400">
                  Frequência Alvo Padrão: <strong>{currentStringSpec.targetFrequency.toFixed(2)} Hz</strong>
                </p>
              </div>

              {/* Real-time Meter & Frequency */}
              <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-950/80 border border-slate-800 w-full max-w-sm space-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span>Sinal do Microfone em Tempo Real</span>
                </div>

                <div className="text-3xl sm:text-4xl font-mono font-bold text-white tracking-tight">
                  {liveFreq > 0 ? `${liveFreq.toFixed(2)} Hz` : "--- Hz"}
                </div>

                {/* Clarity & RMS status */}
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className={clsx(liveClarity > 0.7 ? "text-emerald-400" : "text-slate-500")}>
                    Clareza: {(liveClarity * 100).toFixed(0)}%
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className={clsx(liveRms > 0.015 ? "text-sky-400" : "text-slate-500")}>
                    Volume RMS: {liveRms.toFixed(3)}
                  </span>
                </div>
              </div>

              {/* Action: Capture button */}
              <div className="flex flex-wrap items-center justify-center gap-3 w-full">
                <Button
                  size="lg"
                  onClick={handleCaptureCurrentString}
                  className="gap-2 shadow-emerald-500/25 px-8"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>
                    {capturedStrings[currentStringSpec.stringNumber]
                      ? "Recapturar Corda " + currentStringSpec.name
                      : "Capturar Corda " + currentStringSpec.name}
                  </span>
                </Button>
              </div>

              {/* Captured String Details */}
              {capturedStrings[currentStringSpec.stringNumber] && (
                <div className="w-full text-left p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-emerald-300 font-bold">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Corda {currentStringSpec.name} calibrada com sucesso!
                    </span>
                    <span>
                      Medido: {capturedStrings[currentStringSpec.stringNumber].measuredFrequency.toFixed(2)} Hz (
                      {capturedStrings[currentStringSpec.stringNumber].centsOffset >= 0 ? "+" : ""}
                      {capturedStrings[currentStringSpec.stringNumber].centsOffset.toFixed(1)} cents)
                    </span>
                  </div>

                  {capturedStrings[currentStringSpec.stringNumber].harmonics?.length > 0 && (
                    <div className="text-[11px] text-slate-300 space-y-1 pt-1 border-t border-emerald-500/20">
                      <span className="font-semibold text-slate-400">Harmônicos captados do seu violão:</span>
                      <div className="flex flex-wrap gap-2">
                        {capturedStrings[currentStringSpec.stringNumber].harmonics.map((h, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300"
                          >
                            H{i + 1}: {h.frequency.toFixed(1)} Hz ({h.amplitudeDb.toFixed(1)} dB)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation Footer */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStringIdx((prev) => Math.max(0, prev - 1))}
                disabled={currentStringIdx === 0}
                className="gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                Corda Anterior
              </Button>

              {currentStringIdx < 5 ? (
                <Button
                  size="sm"
                  onClick={() => setCurrentStringIdx((prev) => Math.min(5, prev + 1))}
                  className="gap-1.5"
                >
                  Próxima Corda
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setPhase("chords")}
                  className="gap-1.5 bg-sky-600 hover:bg-sky-500"
                >
                  Avançar para Acordes
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* PHASE 3: CHORDS CALIBRATION */}
        {phase === "chords" && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Chord Selector Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {CALIBRATION_CHORDS.map((chord, idx) => {
                const isCaptured = capturedChords[chord.id] !== undefined;
                const isCurrent = idx === currentChordIdx;
                return (
                  <button
                    key={chord.id}
                    onClick={() => setCurrentChordIdx(idx)}
                    className={clsx(
                      "px-3 py-2 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all whitespace-nowrap",
                      isCurrent
                        ? "bg-slate-800 border-sky-500 ring-2 ring-sky-500/30 text-white"
                        : isCaptured
                        ? "bg-slate-900/80 border-slate-700 text-emerald-400"
                        : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <span>{chord.id}</span>
                    {isCaptured && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                );
              })}
            </div>

            {/* Chord Capture Workspace */}
            <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700 flex flex-col items-center text-center space-y-5">
              <div className="space-y-1">
                <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">
                  Calibrando Acorde {currentChordIdx + 1} de {CALIBRATION_CHORDS.length}
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-white">
                  Toque o acorde {currentChordSpec.name}
                </h3>
                <p className="text-xs text-slate-400">{currentChordSpec.desc}</p>
              </div>

              {/* Real-time 12-class Chromagram Bar Visualizer */}
              <div className="w-full p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span className="font-semibold text-slate-300">Vetor Croma em Tempo Real (C .. B)</span>
                  <span className="text-[11px] text-slate-500">
                    {liveRms > 0.015 ? "Sinal Acústico Detectado" : "Aguardando batida no violão..."}
                  </span>
                </div>

                <div className="grid grid-cols-12 gap-1 h-24 items-end pt-2">
                  {NOTE_NAMES.map((note, idx) => {
                    const energy = liveChroma[idx] || 0;
                    const heightPercent = Math.min(100, Math.round(energy * 100));
                    return (
                      <div key={note} className="flex flex-col items-center h-full justify-end gap-1">
                        <div
                          className={clsx(
                            "w-full rounded-t transition-all duration-75",
                            energy > 0.35
                              ? "bg-gradient-to-t from-emerald-600 to-teal-400"
                              : energy > 0.15
                              ? "bg-slate-700"
                              : "bg-slate-800/60"
                          )}
                          style={{ height: `${Math.max(6, heightPercent)}%` }}
                        />
                        <span className="text-[10px] font-mono font-bold text-slate-400">{note}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action: Capture button */}
              <div className="flex flex-wrap items-center justify-center gap-3 w-full">
                <Button
                  size="lg"
                  onClick={handleCaptureCurrentChord}
                  className="gap-2 shadow-sky-500/25 bg-sky-600 hover:bg-sky-500 px-8"
                >
                  <Music className="w-5 h-5" />
                  <span>
                    {capturedChords[currentChordSpec.id]
                      ? "Recapturar Acorde " + currentChordSpec.id
                      : "Capturar Acorde " + currentChordSpec.id}
                  </span>
                </Button>
              </div>

              {/* Captured Result Card */}
              {capturedChords[currentChordSpec.id] && (
                <div className="w-full text-left p-4 rounded-xl bg-sky-950/30 border border-sky-500/40 text-xs space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-sky-300 font-bold">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Assinatura de {currentChordSpec.id} gravada com sucesso!
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(capturedChords[currentChordSpec.id].capturedAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-300 flex flex-wrap gap-1.5 pt-1">
                    {capturedChords[currentChordSpec.id].chromagram.map((val, idx) => {
                      if (val < 0.1) return null;
                      return (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300 font-mono"
                        >
                          {NOTE_NAMES[idx]}: {val.toFixed(2)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Footer */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentChordIdx((prev) => Math.max(0, prev - 1))}
                disabled={currentChordIdx === 0}
                className="gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                Acorde Anterior
              </Button>

              {currentChordIdx < CALIBRATION_CHORDS.length - 1 ? (
                <Button
                  size="sm"
                  onClick={() =>
                    setCurrentChordIdx((prev) => Math.min(CALIBRATION_CHORDS.length - 1, prev + 1))
                  }
                  className="gap-1.5"
                >
                  Próximo Acorde
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setPhase("summary")}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-500"
                >
                  Ver Relatório Final
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* PHASE 4: SUMMARY & COPY REPORT */}
        {phase === "summary" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">
                    Perfil Acústico Salvo com Sucesso!
                  </h3>
                  <p className="text-xs text-slate-400">
                    O afinador e o reconhecedor de acordes agora utilizam os harmônicos reais do seu violão
                  </p>
                </div>
              </div>

              {/* Status summary grid */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">
                    Cordas Calibradas
                  </span>
                  <div className="text-xl font-extrabold text-emerald-400">
                    {Object.keys(capturedStrings).length} de 6 cordas
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">
                    Acordes Customizados
                  </span>
                  <div className="text-xl font-extrabold text-sky-400">
                    {Object.keys(capturedChords).length} acordes registrados
                  </div>
                </div>
              </div>

              {/* Prominent Copy Button for User Chat Sharing */}
              <div className="pt-2">
                <Button
                  size="lg"
                  onClick={handleCopyReport}
                  className={clsx(
                    "w-full gap-2 text-sm sm:text-base transition-all",
                    copied
                      ? "bg-emerald-500 text-slate-950 font-black shadow-emerald-500/30"
                      : "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-950/40"
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5 text-slate-950" />
                      <span>Relatório Copiado! Cole agora no Chat do Antigravity</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      <span>Copiar Relatório de Diagnóstico (para colar no Chat)</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Reset defaults */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-700/60 text-xs text-slate-400">
                <span>Deseja recomeçar do zero?</span>
                <button
                  onClick={handleClearCalibration}
                  className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 font-semibold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpar Calibração e Voltar aos Padrões</span>
                </button>
              </div>
            </div>

            {/* Final Action buttons */}
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setPhase("chords")}>
                Voltar aos Acordes
              </Button>

              {onClose && (
                <Button size="sm" onClick={onClose} className="gap-1.5">
                  Concluir e Fechar
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (standalone) {
    return content;
  }

  // Modal Wrapper
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {content}
      </div>
    </div>
  );
}
