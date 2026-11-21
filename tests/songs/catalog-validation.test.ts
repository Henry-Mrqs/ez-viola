import { describe, it, expect } from "vitest";
import { CATALOG_SONGS, getSongById } from "@/songs/catalog";
import { validateSongSchema } from "@/songs/song-schema";

describe("Catalog & SongSchema Validation", () => {
  it("successfully validates all 5 catalog songs at runtime", () => {
    expect(CATALOG_SONGS.length).toBe(5);

    for (const song of CATALOG_SONGS) {
      expect(song.id).toBeDefined();
      expect(song.title.length).toBeGreaterThan(0);
      expect(song.bpm).toBeGreaterThan(30);
      expect(song.timeline.length).toBeGreaterThan(0);
      expect(song.tuning.length).toBe(6);

      // Verify chronology of events
      for (let i = 1; i < song.timeline.length; i++) {
        expect(song.timeline[i].timeSec).toBeGreaterThanOrEqual(
          song.timeline[i - 1].timeSec
        );
      }
    }
  });

  it("retrieves each song correctly by id", () => {
    const ids = [
      "exercise-open-strings-fingerpicking",
      "exercise-open-chords-em-g-d-c",
      "song-horse-with-no-name",
      "song-knockin-on-heavens-door",
      "song-tempo-perdido",
    ];

    for (const id of ids) {
      const found = getSongById(id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(id);
    }
  });

  it("throws validation errors on corrupted song data", () => {
    expect(() => validateSongSchema(null)).toThrow();
    expect(() => validateSongSchema({})).toThrow();
    expect(() =>
      validateSongSchema({
        id: "bad id with spaces",
        title: "Test",
        artist: "Test",
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        durationSec: 10,
        tuning: ["E2", "A2", "D3", "G3", "B3", "E4"],
        chordsUsed: {},
        timeline: [],
      })
    ).toThrow();
  });
});
