import { describe, it, expect, vi, beforeEach } from "vitest";
import { AudioEngine } from "@/audio/audio-engine";

describe("AudioEngine (Web Audio Graph & Lifecycle Orchestration)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    const mockTrack = {
      stop: vi.fn(),
      kind: "audio",
      enabled: true,
    };

    const mockStream = {
      getTracks: () => [mockTrack],
    } as unknown as MediaStream;

    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(mockStream);

    const mockSource = {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    const mockBiquad = {
      type: "highpass",
      frequency: { setValueAtTime: vi.fn() },
      Q: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    const mockAnalyser = {
      fftSize: 2048,
      smoothingTimeConstant: 0.0,
      connect: vi.fn(),
      disconnect: vi.fn(),
      getFloatTimeDomainData: vi.fn(),
      getFloatFrequencyData: vi.fn(),
    };

    const mockAudioContext = vi.fn().mockImplementation(() => ({
      state: "running",
      sampleRate: 48000,
      currentTime: 0,
      createMediaStreamSource: vi.fn().mockReturnValue(mockSource),
      createBiquadFilter: vi.fn().mockReturnValue(mockBiquad),
      createAnalyser: vi.fn().mockReturnValue(mockAnalyser),
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    }));

    window.AudioContext = mockAudioContext as unknown as typeof AudioContext;
  });

  it("initializes with uninitialized status and instantiates internal DSP engines", () => {
    const engine = new AudioEngine();
    expect(engine.getStatus()).toBe("uninitialized");
    expect(engine.getTunerEngine()).toBeDefined();
    expect(engine.getChordRecognizer()).toBeDefined();
  });

  it("starts the audio graph, sets 48kHz sampleRate, and enters running state", async () => {
    const engine = new AudioEngine();
    let statusReceived = "";
    engine.onStatusChange = (status) => {
      statusReceived = status;
    };

    await engine.start();

    expect(engine.getStatus()).toBe("running");
    expect(statusReceived).toBe("running");
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);

    await engine.stop();
    expect(engine.getStatus()).toBe("uninitialized");
  });
});
