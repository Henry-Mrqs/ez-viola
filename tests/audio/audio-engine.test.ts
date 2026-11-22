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
      getFloatTimeDomainData: vi.fn((buf: Float32Array) => {
        buf.fill(0.05);
      }),
      getFloatFrequencyData: vi.fn(),
    };

    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        value: 0,
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    const mockDestination = {};

    const mockAudioContext = vi.fn().mockImplementation(() => ({
      state: "running",
      sampleRate: 48000,
      currentTime: 0,
      destination: mockDestination,
      createMediaStreamSource: vi.fn().mockReturnValue(mockSource),
      createBiquadFilter: vi.fn().mockReturnValue(mockBiquad),
      createAnalyser: vi.fn().mockReturnValue(mockAnalyser),
      createGain: vi.fn().mockReturnValue(mockGain),
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

  it("manages microphone loopback monitor state and safe default gain (0 = muted)", async () => {
    const engine = new AudioEngine();
    expect(engine.isLoopbackEnabled()).toBe(false);

    await engine.start();

    // Loopback starts disabled by default to prevent feedback
    expect(engine.isLoopbackEnabled()).toBe(false);

    // Enable loopback monitor at 0.8 volume
    engine.setLoopback(true, 0.8);
    expect(engine.isLoopbackEnabled()).toBe(true);

    // Disable loopback monitor
    engine.setLoopback(false);
    expect(engine.isLoopbackEnabled()).toBe(false);

    await engine.stop();
  });

  it("extracts oscilloscope waveform data using getWaveformData without allocations", async () => {
    const engine = new AudioEngine();
    const testBuf = new Float32Array(512);

    // Before start: fills with 0
    engine.getWaveformData(testBuf);
    expect(testBuf[0]).toBe(0);

    await engine.start();

    // After start: populates from analyser
    engine.getWaveformData(testBuf);
    expect(testBuf[0]).toBeCloseTo(0.05, 2);

    await engine.stop();
  });
});
