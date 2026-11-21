import { describe, it, expect } from "vitest";
import { evaluateHit, calculateStars } from "@/hooks/useConveyorGame";

describe("Hit Detection & Timing Windows (Game Engine)", () => {
  it("TC-01: classifies delta <= 50ms with high confidence as 'perfect'", () => {
    // 0ms exact on time
    expect(evaluateHit(0.0, true, 0.9)).toBe("perfect");
    // +35ms slightly late
    expect(evaluateHit(0.035, true, 0.95)).toBe("perfect");
    // -45ms slightly early
    expect(evaluateHit(-0.045, true, 0.88)).toBe("perfect");
  });

  it("TC-02: classifies 51ms to 120ms with acceptable confidence as 'good'", () => {
    // +80ms
    expect(evaluateHit(0.08, true, 0.85)).toBe("good");
    // -110ms
    expect(evaluateHit(-0.11, true, 0.75)).toBe("good");
  });

  it("TC-03: classifies delta > 120ms or false harmonic match as 'miss'", () => {
    // Out of time window (+150ms)
    expect(evaluateHit(0.15, true, 0.9)).toBe("miss");
    // In time but wrong chord/note
    expect(evaluateHit(0.02, false, 0.9)).toBe("miss");
    // In time but low confidence (< 0.70)
    expect(evaluateHit(0.08, true, 0.5)).toBe("miss");
  });

  it("calculates star thresholds accurately based on accuracy percentage", () => {
    expect(calculateStars(100)).toBe(3);
    expect(calculateStars(95)).toBe(3);
    expect(calculateStars(94.9)).toBe(2);
    expect(calculateStars(80)).toBe(2);
    expect(calculateStars(79.9)).toBe(1);
    expect(calculateStars(60)).toBe(1);
    expect(calculateStars(59.9)).toBe(0);
  });
});
