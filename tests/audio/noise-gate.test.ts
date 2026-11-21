import { describe, it, expect } from "vitest";
import { NoiseGate } from "@/audio/noise-gate";

describe("NoiseGate (Schmitt Trigger with 6 dB Hysteresis)", () => {
  it("keeps gate closed on silent or low noise buffer", () => {
    const gate = new NoiseGate({ thresholdOpen: 0.02, thresholdClose: 0.01 });
    const silentBuffer = new Float32Array(2048).fill(0.002);

    const isOpen = gate.process(silentBuffer);
    expect(isOpen).toBe(false);
    expect(gate.getLastRms()).toBeCloseTo(0.002, 3);
  });

  it("opens gate immediately on strong acoustic burst", () => {
    const gate = new NoiseGate({ thresholdOpen: 0.02, thresholdClose: 0.01 });
    const strongBuffer = new Float32Array(2048).fill(0.05);

    const isOpen = gate.process(strongBuffer);
    expect(isOpen).toBe(true);
    expect(gate.getLastRms()).toBeCloseTo(0.05, 3);
  });

  it("exhibits 6 dB hysteresis: stays open in the intermediate threshold region", () => {
    const gate = new NoiseGate({
      thresholdOpen: 0.02,
      thresholdClose: 0.01,
      releaseTimeMs: 100,
    });

    // 1. Initially closed in intermediate region (0.015)
    const midBuffer = new Float32Array(2048).fill(0.015);
    expect(gate.process(midBuffer, 16)).toBe(false);

    // 2. Strong pulse opens it
    const burst = new Float32Array(2048).fill(0.04);
    expect(gate.process(burst, 16)).toBe(true);

    // 3. Drop to intermediate region (0.015, which is > 0.010 thresholdClose)
    // Should remain OPEN indefinitely while above thresholdClose
    expect(gate.process(midBuffer, 16)).toBe(true);
    expect(gate.process(midBuffer, 16)).toBe(true);
    expect(gate.process(midBuffer, 50)).toBe(true);
  });

  it("closes gate smoothly after release time when signal falls below thresholdClose", () => {
    const gate = new NoiseGate({
      thresholdOpen: 0.02,
      thresholdClose: 0.01,
      releaseTimeMs: 100,
    });

    // Open gate
    const burst = new Float32Array(2048).fill(0.05);
    gate.process(burst, 16);
    expect(gate.getIsOpen()).toBe(true);

    // Fall to below thresholdClose (0.005)
    const quietBuffer = new Float32Array(2048).fill(0.005);

    // First frame (16ms elapsed): still in release window (< 100ms)
    expect(gate.process(quietBuffer, 16)).toBe(true);

    // Next frames: total 80ms elapsed, still open
    expect(gate.process(quietBuffer, 64)).toBe(true);

    // Frame that pushes past 100ms total release: closes gate
    expect(gate.process(quietBuffer, 30)).toBe(false);
    expect(gate.getIsOpen()).toBe(false);
  });

  it("calibrates thresholds correctly based on room floor and guitar peak", () => {
    const gate = new NoiseGate();
    gate.calibrate(0.01, 0.1); // floor: 0.01, peak: 0.1
    // expected thresholdOpen = 0.01 + 0.35 * (0.1 - 0.01) = 0.01 + 0.0315 = 0.0415
    expect(gate.getThresholdOpen()).toBeCloseTo(0.0415, 3);
    // expected thresholdClose = 0.0415 * 0.5 = 0.02075 (-6 dB)
    expect(gate.getThresholdClose()).toBeCloseTo(0.02075, 3);
  });
});
