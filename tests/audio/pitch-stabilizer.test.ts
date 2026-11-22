import { describe, it, expect } from "vitest";
import { PitchStabilizer } from "@/audio/pitch-stabilizer";
import { GUITAR_STRINGS } from "@/audio/types";

describe("PitchStabilizer (Anti-Jitter, Schmitt Trigger, Sigmoidal EMA, Zero-GC)", () => {
  it("eliminates micro-jitter within deadband (< 0.25 cents) at 440 Hz", () => {
    const stabilizer = new PitchStabilizer({
      deadbandCents: 0.25,
      minAlpha: 0.12,
    });

    // Prime stabilizer with exact 440 Hz
    stabilizer.process(440.0, 0.95, true, null, 16.6);
    stabilizer.process(440.0, 0.95, true, null, 16.6);
    const initial = stabilizer.process(440.0, 0.95, true, null, 16.6);

    const initialFreq = initial.smoothedFrequency;
    expect(initialFreq).toBeCloseTo(440.0, 3);

    // Feed micro-jitter within +/- 0.20 cents:
    // +0.2 cents = 440 * 2^(0.2 / 1200) ~ 440.0508 Hz
    const jitterHigh = 440 * Math.pow(2, 0.2 / 1200);
    const outHigh = stabilizer.process(jitterHigh, 0.95, true, null, 16.6);
    expect(outHigh.smoothedFrequency).toBe(initialFreq);

    // -0.15 cents = 440 * 2^(-0.15 / 1200) ~ 440.038 Hz
    const jitterLow = 440 * Math.pow(2, -0.15 / 1200);
    const outLow = stabilizer.process(jitterLow, 0.95, true, null, 16.6);
    expect(outLow.smoothedFrequency).toBe(initialFreq);
  });

  it("exhibits rapid tracking (high alpha >= 0.75) on abrupt transition from 82.41 Hz to 110.0 Hz", () => {
    const stabilizer = new PitchStabilizer({
      minAlpha: 0.12,
      maxAlpha: 0.8,
      inflectionCents: 12.0,
      sigmoidSlope: 4.0,
    });

    // Stabilize on E2 (82.41 Hz)
    for (let i = 0; i < 5; i++) {
      stabilizer.process(82.41, 0.95, true, null, 16.6);
    }
    const e2Out = stabilizer.process(82.41, 0.95, true, null, 16.6);
    expect(e2Out.noteName).toBe("E");
    expect(e2Out.octave).toBe(2);

    // Sudden transition to A2 (110.0 Hz, 500 cents jump)
    // Within 4 frames (~66ms < 100ms), reading should reach > 105 Hz
    for (let i = 0; i < 4; i++) {
      stabilizer.process(110.0, 0.95, true, null, 16.6);
    }
    const a2Out = stabilizer.process(110.0, 0.95, true, null, 16.6);
    expect(a2Out.noteName).toBe("A");
    expect(a2Out.octave).toBe(2);
    expect(a2Out.smoothedFrequency).toBeGreaterThan(105.0);
  });

  it("prevents frantic note toggling using Schmitt Trigger hysteresis (+/- 65 cents)", () => {
    const stabilizer = new PitchStabilizer({
      hysteresisCents: 65.0,
      confirmationFrames: 4,
    });

    // Prime at exact E2 = 82.41 Hz (MIDI 40)
    for (let i = 0; i < 5; i++) {
      stabilizer.process(82.41, 0.95, true, null, 16.6);
    }
    expect(stabilizer.process(82.41, 0.95, true, null, 16.6).noteName).toBe("E");

    // Oscillation in borderline flat territory (-58 to -62 cents below E2):
    // E2 is at MIDI 40, D#2 is at MIDI 39 (-100 cents).
    // The -50 cents boundary would normally flip to D# in naive round(midi),
    // but with 65-cent hysteresis, -58 cents and -62 cents MUST remain E2!
    const freqMinus58c = 82.41 * Math.pow(2, -58 / 1200);
    const freqMinus62c = 82.41 * Math.pow(2, -62 / 1200);

    for (let i = 0; i < 6; i++) {
      const f = i % 2 === 0 ? freqMinus58c : freqMinus62c;
      const out = stabilizer.process(f, 0.9, true, null, 16.6);
      expect(out.noteName).toBe("E");
      expect(out.octave).toBe(2);
    }
  });

  it("triggers DANGER_BREAK alert on 1st string (E4) when cents > +45.0", () => {
    const stabilizer = new PitchStabilizer();
    const e4String = GUITAR_STRINGS.find((s) => s.stringNumber === 1)!;

    // E4 + 48 cents = 329.63 * 2^(48 / 1200) ~ 338.89 Hz
    const dangerFreq = 329.63 * Math.pow(2, 48 / 1200);
    const out = stabilizer.process(dangerFreq, 0.9, true, e4String, 16.6);

    expect(out.isDangerBreak).toBe(true);
    expect(out.tuningAction).toBe("DANGER_BREAK");
    expect(out.action).toBe("DANGER_BREAK");
    expect(out.instruction).toContain("CUIDADO: RISCO DE QUEBRA");
  });

  it("reports correct beginner tuning actions (TIGHTEN, LOOSEN, IN_TUNE)", () => {
    const a2String = GUITAR_STRINGS.find((s) => s.stringNumber === 5)!;

    // Flat: -15 cents -> TIGHTEN
    const stabFlat = new PitchStabilizer();
    const flatFreq = 110.0 * Math.pow(2, -15 / 1200);
    const flatOut = stabFlat.process(flatFreq, 0.9, true, a2String, 16.6);
    expect(flatOut.tuningAction).toBe("TIGHTEN");
    expect(flatOut.instruction).toContain("APERTE");

    // Sharp: +20 cents -> LOOSEN
    const stabSharp = new PitchStabilizer();
    const sharpFreq = 110.0 * Math.pow(2, 20 / 1200);
    const sharpOut = stabSharp.process(sharpFreq, 0.9, true, a2String, 16.6);
    expect(sharpOut.tuningAction).toBe("LOOSEN");
    expect(sharpOut.instruction).toContain("AFROUXE");

    // In Tune: +2.0 cents -> IN_TUNE
    const stabInTune = new PitchStabilizer();
    const inTuneFreq = 110.0 * Math.pow(2, 2.0 / 1200);
    const inTuneOut = stabInTune.process(inTuneFreq, 0.9, true, a2String, 16.6);
    expect(inTuneOut.tuningAction).toBe("IN_TUNE");
    expect(inTuneOut.instruction).toBe("AFINADO!");
    expect(inTuneOut.inTune).toBe(true);
  });

  it("freezes reading gracefully for 400ms on gate closure before resetting to IDLE", () => {
    const stabilizer = new PitchStabilizer({ decayFreezeMs: 400 });

    // Play steady A4
    stabilizer.process(440.0, 0.95, true, null, 16.6);
    stabilizer.process(440.0, 0.95, true, null, 16.6);

    // Gate closes (isGateOpen = false)
    // At t = 200ms (within 400ms decay window), retains frozen reading
    const frozenOut = stabilizer.process(-1, 0, false, null, 200);
    expect(frozenOut.noteName).toBe("A");
    expect(frozenOut.smoothedFrequency).toBeCloseTo(440.0, 1);

    // At t = 450ms total decay, resets to IDLE
    const idleOut = stabilizer.process(-1, 0, false, null, 250);
    expect(idleOut.tuningAction).toBe("IDLE");
    expect(idleOut.noteName).toBe("-");
    expect(idleOut.smoothedFrequency).toBe(-1);
  });
});
