import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AnimatedFretboardGuide,
  FINGER_COLORS,
} from "@/components/guitar/animated-fretboard-guide";

describe("AnimatedFretboardGuide (Player Perspective & Anatomical Finger Colors)", () => {
  it("renders Em (Mi Menor) with Dedo 1 and Dedo 2 and all open strings", () => {
    const html = renderToStaticMarkup(<AnimatedFretboardGuide chordId="Em" />);

    expect(html).toContain('data-testid="animated-fretboard-guide"');
    expect(html).toContain("Mi Menor");
    expect(html).toContain('data-testid="finger-dot-1"');
    expect(html).toContain('data-testid="finger-dot-2"');
    expect(html).toContain('data-testid="open-string-6"');
    expect(html).toContain('data-testid="open-string-1"');
    expect(html).toContain("↓ Baixo");
  });

  it("renders C (Dó Maior) with muted String 6 (✕) and fingers 1, 2, 3", () => {
    const html = renderToStaticMarkup(<AnimatedFretboardGuide chordId="C" />);

    expect(html).toContain("Dó Maior");
    expect(html).toContain('data-testid="muted-string-6"');
    expect(html).toContain("✕");
    expect(html).toContain('data-testid="finger-dot-1"');
    expect(html).toContain('data-testid="finger-dot-2"');
    expect(html).toContain('data-testid="finger-dot-3"');
  });

  it("renders universal finger colors: 1=Blue, 2=Green, 3=Orange, 4=Purple", () => {
    expect(FINGER_COLORS[1].hex).toBe("#3B82F6");
    expect(FINGER_COLORS[2].hex).toBe("#10B981");
    expect(FINGER_COLORS[3].hex).toBe("#F97316");
    expect(FINGER_COLORS[4].hex).toBe("#A855F7");

    const html = renderToStaticMarkup(
      <AnimatedFretboardGuide chordId="G" showFingerLabels={true} />
    );

    expect(html).toContain('data-testid="finger-legend-1"');
    expect(html).toContain('data-testid="finger-legend-2"');
    expect(html).toContain('data-testid="finger-legend-3"');
    expect(html).toContain('data-testid="finger-legend-4"');
  });

  it("displays pedagogical posture tips in Portuguese", () => {
    const html = renderToStaticMarkup(<AnimatedFretboardGuide chordId="Em" />);
    expect(html).toContain("Dica do Professor:");
    expect(html).toContain("martelinhos");
  });
});
