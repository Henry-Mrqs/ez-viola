import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GuitarHeadstockViewer } from "@/components/tuner/guitar-headstock-viewer";

describe("GuitarHeadstockViewer (SVG Anatomical Headstock & Anti-Panic Guard)", () => {
  it("renders headstock with all 6 pegs and labels", () => {
    const html = renderToStaticMarkup(
      <GuitarHeadstockViewer
        activeStringNumber={6}
        cents={0}
        inTune={true}
        hasSignal={true}
        tuningAction="IN_TUNE"
      />
    );

    expect(html).toContain('data-testid="guitar-headstock-viewer"');
    expect(html).toContain('data-testid="peg-6"');
    expect(html).toContain('data-testid="peg-5"');
    expect(html).toContain('data-testid="peg-4"');
    expect(html).toContain('data-testid="peg-3"');
    expect(html).toContain('data-testid="peg-2"');
    expect(html).toContain('data-testid="peg-1"');
    expect(html).toContain("<svg");
  });

  it("displays 'APERTE A TARRAXA' when string is flat (TIGHTEN / cents < -5)", () => {
    const html = renderToStaticMarkup(
      <GuitarHeadstockViewer
        activeStringNumber={5}
        cents={-25}
        inTune={false}
        hasSignal={true}
        tuningAction="TIGHTEN"
      />
    );

    expect(html).toContain("APERTE A TARRAXA");
    expect(html).toContain("A2");
  });

  it("displays 'AFROUXE A TARRAXA' when string is sharp (LOOSEN / cents > +5)", () => {
    const html = renderToStaticMarkup(
      <GuitarHeadstockViewer
        activeStringNumber={4}
        cents={20}
        inTune={false}
        hasSignal={true}
        tuningAction="LOOSEN"
      />
    );

    expect(html).toContain("AFROUXE A TARRAXA");
    expect(html).toContain("D3");
  });

  it("displays 'CORDA AFINADA!' when inTune is true", () => {
    const html = renderToStaticMarkup(
      <GuitarHeadstockViewer
        activeStringNumber={6}
        cents={0}
        inTune={true}
        hasSignal={true}
        tuningAction="IN_TUNE"
      />
    );

    expect(html).toContain("CORDA AFINADA!");
  });

  it("triggers DANGER_BREAK banner when String 1 (E4) has cents > +45", () => {
    const html = renderToStaticMarkup(
      <GuitarHeadstockViewer
        activeStringNumber={1}
        cents={48}
        inTune={false}
        hasSignal={true}
        tuningAction="DANGER_BREAK"
      />
    );

    expect(html).toContain('data-testid="danger-break-banner"');
    expect(html).toContain("CUIDADO: RISCO DE QUEBRA! AFROUXE A TARRAXA IMEDIATAMENTE");
  });
});
