import { describe, it, expect, vi } from "vitest";
import { AudioSynthesizer } from "@/audio/audio-synthesizer";

function createMockAudioContext() {
  const destination = {} as AudioDestinationNode;

  const createGain = vi.fn(() => ({
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  }));

  const createOscillator = vi.fn(() => ({
    type: "sine",
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }));

  const createBiquadFilter = vi.fn(() => ({
    type: "lowpass",
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  }));

  return {
    state: "running" as AudioContextState,
    currentTime: 10.0,
    destination,
    createGain,
    createOscillator,
    createBiquadFilter,
  } as unknown as AudioContext;
}

describe("AudioSynthesizer", () => {
  it("schedules downbeat and upbeat metronome clicks accurately", () => {
    const mockCtx = createMockAudioContext();

    AudioSynthesizer.playMetronomeClick(mockCtx, 10.0, true);
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
    expect(mockCtx.createGain).toHaveBeenCalledTimes(1);

    AudioSynthesizer.playMetronomeClick(mockCtx, 11.0, false);
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
  });

  it("schedules confirmation ting chime at 1760 Hz", () => {
    const mockCtx = createMockAudioContext();

    AudioSynthesizer.playConfirmationTing(mockCtx, 12.0);
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
  });

  it("schedules miss sound without error", () => {
    const mockCtx = createMockAudioContext();

    AudioSynthesizer.playDampedMissSound(mockCtx, 12.0);
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
  });

  it("schedules strummed chord across multiple string frequencies", () => {
    const mockCtx = createMockAudioContext();
    const emFreqs = [82.41, 123.47, 164.81, 196.0, 246.94, 329.63]; // 6 strings

    AudioSynthesizer.playSynthesizedChord(mockCtx, emFreqs, 15.0, 2.0);

    // Should create 6 oscillators and 6 filters for the 6 strings
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(6);
    expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(6);
    expect(mockCtx.createGain).toHaveBeenCalledTimes(6);
  });
});
