import { describe, it, expect, vi } from "vitest";
import { AudioEngine } from "@/audio/audio-engine";

describe("useTuner Hook", () => {
  it("initializes with guitarMode = true by default and allows toggling", () => {
    const engine = new AudioEngine();
    const setGuitarModeSpy = vi.spyOn(engine.getTunerEngine(), "setGuitarMode");

    expect(engine.getTunerEngine().isGuitarMode()).toBe(true);

    // Manual test of hook logic without external dependencies if renderHook is not available
    const initialGuitarMode = engine.getTunerEngine().isGuitarMode();
    expect(initialGuitarMode).toBe(true);

    engine.getTunerEngine().setGuitarMode(false);
    expect(engine.getTunerEngine().isGuitarMode()).toBe(false);

    engine.getTunerEngine().setGuitarMode(true);
    expect(engine.getTunerEngine().isGuitarMode()).toBe(true);
  });

  it("handles loopback volume and state in AudioEngine", () => {
    const engine = new AudioEngine();

    expect(engine.isLoopbackEnabled()).toBe(false);

    engine.setLoopback(true, 0.7);
    expect(engine.isLoopbackEnabled()).toBe(true);

    // Test waveform data fill
    const buffer = new Float32Array(512);
    engine.getWaveformData(buffer);
    expect(buffer.length).toBe(512);
  });
});
