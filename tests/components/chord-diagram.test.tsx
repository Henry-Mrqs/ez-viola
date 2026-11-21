import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GuitarChordDiagram } from "@/components/chord-diagram/chord-diagram";
import { CATALOG_SONGS } from "@/songs/catalog";
import { ChordDefinition } from "@/songs/song-schema";

describe("GuitarChordDiagram (SVG Visual Renderer)", () => {
  it("renders without error for all unique chords in the catalog", () => {
    const allChords = new Map<string, ChordDefinition>();
    for (const song of CATALOG_SONGS) {
      for (const [key, chord] of Object.entries(song.chordsUsed)) {
        if (!allChords.has(key)) {
          allChords.set(key, chord);
        }
      }
    }

    expect(allChords.size).toBeGreaterThanOrEqual(6);

    for (const [, chord] of allChords.entries()) {
      const html = renderToStaticMarkup(<GuitarChordDiagram chord={chord} />);
      expect(html).toContain("<svg");
      expect(html).toContain('viewBox="0 0 160 200"');
      expect(html).toContain(chord.displayName);
    }
  });

  it("renders barre chords with rect element (Bm)", () => {
    const tempoPerdido = CATALOG_SONGS.find((s) => s.id === "song-tempo-perdido");
    const bmChord = tempoPerdido?.chordsUsed["Bm"];
    expect(bmChord).toBeDefined();

    if (bmChord) {
      const html = renderToStaticMarkup(<GuitarChordDiagram chord={bmChord} />);
      expect(html).toContain("<rect");
      expect(html).toContain("2ª"); // baseFret label
    }
  });
});
