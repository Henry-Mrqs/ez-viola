import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MicMonitor } from "@/components/tuner/mic-monitor";
import { AudioEngine } from "@/audio/audio-engine";

describe("MicMonitor Component", () => {
  it("renders oscilloscope canvas, VU meter dBFS indicators, and headphones alert", () => {
    const engine = new AudioEngine();
    const html = renderToStaticMarkup(
      <MicMonitor
        engine={engine}
        isRunning={true}
        isLoopback={false}
        loopbackVolume={0.75}
        onToggleLoopback={vi.fn()}
        onVolumeChange={vi.fn()}
      />
    );

    // Canvas element for oscilloscope
    expect(html).toContain("<canvas");
    expect(html).toContain("Osciloscópio");
    expect(html).toContain("60 FPS");

    // VU meter & dBFS scale
    expect(html).toContain("VU Meter (dBFS)");
    expect(html).toContain("-60 dB");
    expect(html).toContain("0 dB");

    // Headphones friendly alert
    expect(html).toContain(
      "Recomendado usar fones de ouvido para evitar microfonia (eco) nas caixas de som"
    );

    // Default loopback button state (inactive)
    expect(html).toContain("Ouvir Retorno do Microfone");

    // Volume level display (75%)
    expect(html).toContain("75%");
  });

  it("renders active loopback pulsating state when isLoopback is true", () => {
    const engine = new AudioEngine();
    const html = renderToStaticMarkup(
      <MicMonitor
        engine={engine}
        isRunning={true}
        isLoopback={true}
        loopbackVolume={1.0}
        onToggleLoopback={vi.fn()}
        onVolumeChange={vi.fn()}
      />
    );

    expect(html).toContain("Retorno do Microfone Ativo");
    expect(html).toContain("animate-pulse");
    expect(html).toContain("100%");
  });

  it("renders stopped state with activation prompt when isRunning is false", () => {
    const engine = new AudioEngine();
    const onStart = vi.fn();
    const html = renderToStaticMarkup(
      <MicMonitor
        engine={engine}
        isRunning={false}
        isLoopback={false}
        loopbackVolume={0.5}
        onToggleLoopback={vi.fn()}
        onVolumeChange={vi.fn()}
        onStartMic={onStart}
      />
    );

    expect(html).toContain("Microfone Parado");
    expect(html).toContain("Ativar Microfone");
  });
});
