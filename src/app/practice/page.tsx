import React from "react";
import { CATALOG_SONGS } from "@/songs/catalog";
import { SongCard } from "@/components/catalog/song-card";
import { Music, Sliders } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PracticeGalleryPage() {
  return (
    <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Music className="w-5 h-5 text-emerald-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Galeria de Lições & Músicas
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Pratique no seu violão acústico ou clássico com esteira 2D e o paciente Wait Mode
          </p>
        </div>

        <Link href="/tuner">
          <Button variant="outline" size="sm" className="gap-2 text-xs">
            <Sliders className="w-4 h-4 text-purple-400" />
            Afinar Violão Primeiro
          </Button>
        </Link>
      </div>

      {/* Songs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {CATALOG_SONGS.map((song) => (
          <SongCard key={song.id} song={song} />
        ))}
      </div>
    </div>
  );
}
