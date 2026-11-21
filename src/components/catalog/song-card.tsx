"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { SongSchema } from "@/songs/song-schema";
import { Play, Star, Clock, Music } from "lucide-react";
import { clsx } from "clsx";

interface SongCardProps {
  song: SongSchema;
}

export function SongCard({ song }: SongCardProps) {
  const [starsEarned, setStarsEarned] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("ezviola_progress");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed[song.id]) {
            setStarsEarned(parsed[song.id].bestStars || 0);
            setBestScore(parsed[song.id].bestScore || 0);
          }
        }
      } catch {}
    }
  }, [song.id]);

  const chords = Object.keys(song.chordsUsed);

  const difficultyColors = {
    beginner: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    elementary: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    intermediate: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    advanced: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };

  const difficultyLabels = {
    beginner: "Iniciante",
    elementary: "Básico",
    intermediate: "Intermediário",
    advanced: "Avançado",
  };

  const durationMin = Math.floor(song.durationSec / 60);
  const durationSec = Math.floor(song.durationSec % 60);
  const formattedDuration = `${durationMin}:${durationSec.toString().padStart(2, "0")}`;

  return (
    <Link
      href={`/practice/${song.id}`}
      className="group relative p-6 rounded-3xl bg-slate-800/50 border border-slate-700/60 hover:border-emerald-500/50 hover:bg-slate-800/90 transition-all duration-200 flex flex-col justify-between shadow-lg hover:shadow-emerald-950/20"
    >
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className={clsx(
              "px-2.5 py-1 rounded-full text-xs font-bold border",
              difficultyColors[song.difficulty]
            )}
          >
            {difficultyLabels[song.difficulty]}
          </span>

          {/* Stars */}
          <div className="flex items-center gap-1">
            {[1, 2, 3].map((s) => (
              <Star
                key={s}
                className={clsx(
                  "w-4 h-4",
                  s <= starsEarned
                    ? "fill-amber-400 text-amber-400"
                    : "fill-slate-800 text-slate-700"
                )}
              />
            ))}
          </div>
        </div>

        {/* Title & Artist */}
        <h3 className="text-xl font-black text-white group-hover:text-emerald-400 transition-colors">
          {song.title}
        </h3>
        <div className="flex items-center justify-between text-xs sm:text-sm text-slate-400 font-medium mb-4">
          <span>{song.artist}</span>
          {bestScore > 0 && (
            <span className="text-emerald-400 font-mono font-bold text-xs">
              Recorde: {bestScore.toLocaleString()}
            </span>
          )}
        </div>

        {/* Chords Used */}
        {chords.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            <span className="text-[11px] text-slate-500 font-semibold mr-1">Acordes:</span>
            {chords.map((chordId) => (
              <span
                key={chordId}
                className="px-2 py-0.5 rounded-lg bg-slate-900/90 text-slate-300 border border-slate-800 text-xs font-mono font-bold"
              >
                {chordId}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info & Action */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Music className="w-3.5 h-3.5 text-slate-500" />
            {song.bpm} BPM
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            {formattedDuration}
          </span>
        </div>

        <div className="flex items-center gap-1 font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
          <span>Praticar</span>
          <Play className="w-3.5 h-3.5 fill-current" />
        </div>
      </div>
    </Link>
  );
}
