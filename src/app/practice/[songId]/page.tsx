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
import { GuitarChordDiagram } from "@/components/chord-diagram/chord-diagram";
import { Button } from "@/components/ui/button";
import {
  Play,
  ArrowLeft,
  Sliders,
  Smartphone,
  Music,
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

          {/* Review Chords Used in this song */}
          {Object.keys(song.chordsUsed).length > 0 && (
            <div className="w-full max-w-2xl p-6 rounded-3xl bg-slate-800/40 border border-slate-700/60">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                Acordes desta Lição (revise a digitação):
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-6">
                {Object.values(song.chordsUsed).map((chordDef) => (
                  <div
                    key={chordDef.chordId}
                    className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-sm"
                  >
                    <GuitarChordDiagram chord={chordDef} width={120} height={150} />
                  </div>
                ))}
              </div>
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
          <div className="rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
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
