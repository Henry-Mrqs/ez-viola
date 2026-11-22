"use client";

import React, { useState, useEffect } from "react";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { getSongById, CATALOG_SONGS } from "@/songs/catalog";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useAudioClock } from "@/hooks/useAudioClock";
import { useConveyorGame } from "@/hooks/useConveyorGame";
import { useWakeLock } from "@/hooks/useWakeLock";
import { ConveyorCanvas } from "@/components/canvas/conveyor-canvas";
import { GameHud } from "@/components/feedback/game-hud";
import { SpeedControls } from "@/components/feedback/speed-controls";
import { ResultsModal } from "@/components/feedback/results-modal";
import { AnimatedFretboardGuide } from "@/components/guitar/animated-fretboard-guide";
import { LiveTelemetryPanel } from "@/components/tuner/live-telemetry-panel";
import { TunerResult } from "@/audio/types";
import { Button } from "@/components/ui/button";
import { clsx } from "clsx";
import {
  Play,
  ArrowLeft,
  Sliders,
  Smartphone,
  Music,
  Activity,
} from "lucide-react";

export default function PracticeSongPage() {
  const params = useParams();
  const songId = params?.songId as string;
  const song = getSongById(songId);

  if (!song) {
    notFound();
  }

  const { engine, isRunning, start: startAudio } = useAudioEngine();
  const clock = useAudioClock(engine.getAudioContext(), song.bpm);
  const game = useConveyorGame(song, clock, engine.getAudioContext());
  const { requestWakeLock, releaseWakeLock } = useWakeLock();

  const [hasStarted, setHasStarted] = useState(false);
  const [showPortraitNotice, setShowPortraitNotice] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [tunerResult, setTunerResult] = useState<TunerResult | undefined>(undefined);
  const [selectedReviewChord, setSelectedReviewChord] = useState<string>(
    Object.keys(song.chordsUsed)[0] || "Em"
  );

  // Release wake lock on unmount
  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  // Detect orientation for mobile stand UX
  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window !== "undefined") {
        const isPortrait = window.innerHeight > window.innerWidth && window.innerWidth < 768;
        setShowPortraitNotice(isPortrait);
      }
    };

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    return () => window.removeEventListener("resize", checkOrientation);
  }, []);

  // Connect DSP updates from AudioEngine to Game Engine
  useEffect(() => {
    engine.onTunerUpdate = (tunerRes) => {
      setTunerResult(tunerRes);
      game.onTunerUpdate(tunerRes);
    };

    engine.onChordUpdate = (chordRes) => {
      game.onChordUpdate(chordRes);
    };
  }, [engine, game]);

  // Set active chords on the recognizer to optimize discrimination
  useEffect(() => {
    const chordKeys = Object.keys(song.chordsUsed);
    if (chordKeys.length > 0) {
      engine.getChordRecognizer().setActiveChords(chordKeys);
    }
  }, [engine, song]);

  // Start the lesson session
  const handleStartLesson = async () => {
    try {
      if (!isRunning) {
        await startAudio();
      }
      await requestWakeLock();
      setHasStarted(true);
      game.resetGame();
      clock.start();
    } catch (err) {
      console.error("Failed to start lesson audio:", err);
    }
  };

  const handleRestart = () => {
    game.resetGame();
    clock.start();
  };

  // Find next song for end modal
  const currentIndex = CATALOG_SONGS.findIndex((s) => s.id === song.id);
  const nextSong =
    currentIndex >= 0 && currentIndex < CATALOG_SONGS.length - 1
      ? CATALOG_SONGS[currentIndex + 1]
      : undefined;

  return (
    <div className="flex-1 flex flex-col justify-between max-w-6xl mx-auto w-full px-2 sm:px-6 py-4">
      {/* Top Bar with Navigation and Tuner Shortcut */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2">
        <Link
          href="/practice"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Catálogo</span>
        </Link>

        <Link href="/tuner">
          <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-slate-300">
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Afinador Rápido</span>
          </Button>
        </Link>
      </div>

      {/* Portrait orientation prompt on small screens */}
      {showPortraitNotice && hasStarted && (
        <div className="mb-2 p-2 rounded-xl bg-sky-950/60 border border-sky-500/40 text-sky-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 rotate-90 text-sky-400 flex-shrink-0" />
            <span>Dica: gire o celular na horizontal para melhor visão da esteira.</span>
          </div>
          <button
            onClick={() => setShowPortraitNotice(false)}
            className="text-xs text-sky-400 hover:text-white font-bold px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Pre-Start Screen: Chord overview & Start Button */}
      {!hasStarted && (
        <div className="flex-1 flex flex-col items-center justify-center py-6 text-center space-y-6 my-auto">
          <div className="space-y-2 max-w-md mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
              <Music className="w-3.5 h-3.5" />
              <span>{song.genre} • {song.bpm} BPM</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-white">{song.title}</h1>
            <p className="text-sm text-slate-400 font-medium">{song.artist}</p>
          </div>

          {/* Review Chords Used in this song with Anatomical Guide */}
          {Object.keys(song.chordsUsed).length > 0 && (
            <div className="w-full max-w-2xl p-6 rounded-3xl bg-slate-800/40 border border-slate-700/60">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Guia Anatômico de Dedos (clique no acorde para visualizar):
              </h2>

              <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                {Object.keys(song.chordsUsed).map((chordKey) => (
                  <button
                    key={chordKey}
                    onClick={() => setSelectedReviewChord(chordKey)}
                    className={clsx(
                      "px-3 py-1.5 rounded-xl font-bold text-xs transition-all",
                      selectedReviewChord === chordKey
                        ? "bg-blue-600 text-white shadow-md shadow-blue-950"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    )}
                  >
                    {chordKey}
                  </button>
                ))}
              </div>

              <AnimatedFretboardGuide
                chordId={selectedReviewChord}
                className="w-full shadow-none bg-slate-900/60"
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
            <Button
              size="lg"
              onClick={handleStartLesson}
              className="gap-2.5 text-base px-8 shadow-emerald-500/25"
            >
              <Play className="w-5 h-5 fill-current" />
              Começar a Tocar Agora
            </Button>
          </div>
        </div>
      )}

      {/* Active Game Screen */}
      {hasStarted && (
        <div className="flex-1 flex flex-col justify-between space-y-3">
          {/* Top HUD with Score, Combo, Progress & Wait Overlay */}
          <GameHud
            song={song}
            scoreState={game.scoreState}
            currentTime={clock.getCurrentTime()}
            isWaiting={game.isWaiting}
            activeWaitEvent={game.activeWaitEvent}
          />

          {/* Conveyor Belt 2D Canvas */}
          <div className="relative rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
            <ConveyorCanvas
              song={song}
              getCurrentTime={clock.getCurrentTime}
              speed={clock.speed}
              isPaused={clock.isPaused}
              isWaitModeActive={game.isWaiting}
              activeWaitEvent={game.activeWaitEvent}
              lastHitFeedback={game.lastFeedback}
              feedbackTimestamp={game.feedbackTimestamp}
            />

            {/* Wait Mode Anatomical Fretboard Guide Overlay */}
            {game.isWaiting && game.activeWaitEvent?.chordId && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
                <div className="w-full max-w-md">
                  <div className="text-center mb-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
                      Modo Espera • Toque o Acorde para Continuar
                    </span>
                  </div>
                  <AnimatedFretboardGuide
                    chordId={game.activeWaitEvent.chordId}
                    className="w-full shadow-2xl border-slate-700 bg-slate-900"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Speed Controls & Toggles */}
          <SpeedControls
            speed={clock.speed}
            onSetSpeed={clock.setSpeed}
            enableMetronome={clock.enableMetronome}
            onToggleMetronome={() => clock.setEnableMetronome(!clock.enableMetronome)}
            isPlaying={clock.isPlaying}
            isPaused={clock.isPaused}
            onTogglePause={() => (clock.isPaused ? clock.resume() : clock.pause())}
            onRestart={handleRestart}
            enableWaitMode={game.enableWaitMode}
            onToggleWaitMode={() => game.setEnableWaitMode(!game.enableWaitMode)}
          />

          {/* Permanent Live Chord Guidance During Practice (Current + Next) */}
          {(() => {
            const currentSongTime = clock.getCurrentTime();
            const upcomingEvents = song.timeline.filter((ev) => ev.timeSec >= currentSongTime - 0.4);
            const currentActiveEvent = upcomingEvents[0];
            const nextUpcomingEvent = upcomingEvents.find(
              (ev, idx) => idx > 0 && ev.chordId && ev.chordId !== currentActiveEvent?.chordId
            );

            const activeChordId = currentActiveEvent?.chordId || Object.keys(song.chordsUsed)[0] || "Em";
            const nextChordId = nextUpcomingEvent?.chordId;

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
                {/* Current Chord Fretboard Guide */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Acorde Atual (Posicione os Dedos):
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {song.chordsUsed[activeChordId]?.displayName || activeChordId}
                    </span>
                  </div>
                  <AnimatedFretboardGuide
                    chordId={activeChordId}
                    className="w-full shadow-none bg-slate-950/70 border-slate-800"
                  />
                </div>

                {/* Next Chord Preview + Telemetry button */}
                <div className="flex flex-col justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      A Seguir (Prepare a Mão):
                    </span>
                    {nextChordId ? (
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-xl font-black text-sky-400 font-mono block">
                          {song.chordsUsed[nextChordId]?.displayName || nextChordId}
                        </span>
                        <span className="text-[11px] text-slate-400 mt-1 block">
                          Próxima troca em breve
                        </span>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/50 text-slate-500 text-xs italic">
                        Finalizando a música...
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowTelemetry(!showTelemetry)}
                      className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                    >
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{showTelemetry ? "Ocultar Telemetria" : "📊 Telemetria do Mic"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Collapsible Live Telemetry Panel */}
          {showTelemetry && (
            <LiveTelemetryPanel
              engine={engine}
              tunerResult={tunerResult}
              className="mt-2"
            />
          )}
        </div>
      )}

      {/* End of Song Results Modal */}
      <ResultsModal
        isOpen={game.scoreState.isFinished}
        scoreState={game.scoreState}
        onPlayAgain={handleRestart}
        nextSongId={nextSong?.id}
      />
    </div>
  );
}
