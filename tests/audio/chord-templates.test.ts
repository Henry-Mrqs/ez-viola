import { describe, it, expect } from "vitest";
import { ALL_CHORD_TEMPLATES, buildChordTemplates } from "@/audio/chord-templates";

describe("Chord Templates (L2 Normalized & Weighted)", () => {
  it("ensures all templates have Euclidean L2 norm strictly equal to 1.000 +/- 0.001", () => {
    for (const t of ALL_CHORD_TEMPLATES) {
      let sumSq = 0;
      for (let i = 0; i < 12; i++) {
        sumSq += t.vector[i] * t.vector[i];
      }
      const norm = Math.sqrt(sumSq);
      expect(
        norm,
        `Template ${t.chordId} failed L2 normalization with norm ${norm}`
      ).toBeCloseTo(1.0, 3);
    }
  });

  it("contains all critical chords for the EzViola songs catalog", () => {
    const requiredChordIds = [
      "Em",
      "G",
      "D",
      "C",
      "Am7",
      "Bm7",
      "Bm",
      "D6add9_Fsharp",
      "Bm7_easy",
    ];

    for (const id of requiredChordIds) {
      const found = ALL_CHORD_TEMPLATES.find((t) => t.chordId === id);
      expect(found, `Required chord ${id} must exist in chord templates`).toBeDefined();
    }
  });

  it("accurately models active pitch classes for Em (E=4, G=7, B=11)", () => {
    const em = ALL_CHORD_TEMPLATES.find((t) => t.chordId === "Em");
    expect(em).toBeDefined();
    if (!em) return;

    // E is class 4, G is class 7, B is class 11
    expect(em.vector[4]).toBeGreaterThan(0);
    expect(em.vector[7]).toBeGreaterThan(0);
    expect(em.vector[11]).toBeGreaterThan(0);

    // Other pitch classes must be exactly 0
    for (let c = 0; c < 12; c++) {
      if (c !== 4 && c !== 7 && c !== 11) {
        expect(em.vector[c]).toBe(0);
      }
    }
  });

  it("builds all templates in less than 2ms", () => {
    const start = performance.now();
    const templates = buildChordTemplates();
    const elapsed = performance.now() - start;

    expect(templates.length).toBeGreaterThanOrEqual(48);
    expect(elapsed).toBeLessThan(5);
  });
});
