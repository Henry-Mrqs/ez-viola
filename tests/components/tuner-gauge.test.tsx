import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TunerGauge } from "@/components/canvas/tuner-gauge";

describe("TunerGauge Component", () => {
  it("renders canvas element", () => {
    const html = renderToStaticMarkup(
      <TunerGauge
        cents={0}
        inTune={false}
        isGateOpen={false}
        hasPitch={false}
      />
    );

    expect(html).toContain("<canvas");
    expect(html).toContain("Aguardando sinal do violão...");
  });

  it("displays locked string badge when guitar string is detected", () => {
    // stringIndex = 0 corresponds to String 6 (E2, 82.4 Hz)
    const html = renderToStaticMarkup(
      <TunerGauge
        cents={2.0}
        inTune={false}
        isGateOpen={true}
        hasPitch={true}
        stringIndex={0}
      />
    );

    expect(html).toContain("Corda 6: E2 (82.4 Hz) • Estável");
  });

  it("displays locked string badge with Afinada when inTune is true", () => {
    const html = renderToStaticMarkup(
      <TunerGauge
        cents={0.5}
        inTune={true}
        isGateOpen={true}
        hasPitch={true}
        stringIndex={0}
      />
    );

    expect(html).toContain("Corda 6: E2 (82.4 Hz) • Afinada");
  });

  it("displays chromatic note badge when pitch is detected without specific string match", () => {
    const html = renderToStaticMarkup(
      <TunerGauge
        cents={-3.0}
        inTune={false}
        isGateOpen={true}
        hasPitch={true}
        stringIndex={-1}
        noteName="C"
        octave={3}
        frequency={130.8}
      />
    );

    expect(html).toContain("Nota: C3 (130.8 Hz) • Detectada");
  });
});
