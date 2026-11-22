import {
  AudioEngineStatus,
  TunerResult,
  ChordResult,
} from "./types";
import { getSafeAudioConstraints } from "./audio-constraints";
import { TunerEngine } from "./tuner-engine";
import { ChordRecognizer } from "./chord-recognizer";

export class AudioEngine {
  private status: AudioEngineStatus = "uninitialized";
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;
  private tunerAnalyser: AnalyserNode | null = null;
  private chordAnalyser: AnalyserNode | null = null;
  private loopbackGain: GainNode | null = null;
  private loopbackEnabled: boolean = false;
  private loopbackVolume: number = 1.0;

  private tunerEngine: TunerEngine;
  private chordRecognizer: ChordRecognizer;

  // Zero-GC pre-allocated arrays
  private timeBuffer: Float32Array<ArrayBuffer>; // 2048 samples
  private freqBuffer: Float32Array<ArrayBuffer>; // 2048 bins (4096 / 2)

  private rafId: number | null = null;
  private lastFrameTimestamp: number = 0;

  // Callbacks
  public onTunerUpdate?: (result: TunerResult) => void;
  public onChordUpdate?: (result: ChordResult) => void;
  public onStatusChange?: (status: AudioEngineStatus) => void;

  constructor() {
    this.timeBuffer = new Float32Array(new ArrayBuffer(2048 * 4));
    this.freqBuffer = new Float32Array(new ArrayBuffer(2048 * 4)); // 4096 fftSize / 2

    this.tunerEngine = new TunerEngine(44100, 2048, 0.15);
    this.chordRecognizer = new ChordRecognizer(44100, 4096, 0.72, 8);
  }

  public getStatus(): AudioEngineStatus {
    return this.status;
  }

  public getAudioContext(): AudioContext | null {
    return this.audioCtx;
  }

  public getTunerEngine(): TunerEngine {
    return this.tunerEngine;
  }

  public getChordRecognizer(): ChordRecognizer {
    return this.chordRecognizer;
  }

  /**
   * Enables or disables microphone monitor loopback to destination.
   * Starts disabled (gain = 0) by default to prevent acoustic feedback / Larsen effect.
   */
  public setLoopback(enabled: boolean, volume: number = 1.0): void {
    this.loopbackEnabled = enabled;
    this.loopbackVolume = Math.max(0, Math.min(2.0, volume));
    if (this.loopbackGain && this.audioCtx) {
      const gainVal = enabled ? this.loopbackVolume : 0;
      this.loopbackGain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
    }
  }

  public isLoopbackEnabled(): boolean {
    return this.loopbackEnabled;
  }

  /**
   * Fills outputArray with raw time-domain waveform data (oscilloscope / VU meter).
   * Zero-GC: operates on caller-provided Float32Array.
   */
  public getWaveformData(outputArray: Float32Array): void {
    if (this.tunerAnalyser) {
      this.tunerAnalyser.getFloatTimeDomainData(
        outputArray as unknown as Float32Array<ArrayBuffer>
      );
    } else {
      outputArray.fill(0);
    }
  }

  private setStatus(newStatus: AudioEngineStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.onStatusChange?.(newStatus);
    }
  }

  /**
   * Initializes the Web Audio graph from microphone input.
   * MUST be invoked inside a synchronous user gesture handler.
   */
  public async start(): Promise<void> {
    if (this.status === "running") return;

    this.setStatus("requesting");

    try {
      // 1. Capture microphone with safe constraints
      const constraints = getSafeAudioConstraints();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.mediaStream = stream;

      // 2. Initialize AudioContext (dynamically reading sampleRate)
      const AudioCtxConstructor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtxConstructor();
      this.audioCtx = ctx;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      // Propagate true hardware sample rate (e.g. 48000 on mobile/airpods)
      const sampleRate = ctx.sampleRate;
      this.tunerEngine.setSampleRate(sampleRate);
      this.chordRecognizer.setSampleRate(sampleRate);

      // Listen for OS audio interruption on mobile
      ctx.addEventListener("statechange", () => {
        if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") {
          this.setStatus("suspended");
        } else if (ctx.state === "running") {
          this.setStatus("running");
        }
      });

      // 3. Build DSP graph
      // Source -> HighPassFilter (65 Hz, Q=0.707) -> tunerAnalyser & chordAnalyser
      this.sourceNode = ctx.createMediaStreamSource(stream);

      // Loopback monitor node (microphone return, default gain 0)
      const loopback = ctx.createGain();
      loopback.gain.setValueAtTime(
        this.loopbackEnabled ? this.loopbackVolume : 0,
        ctx.currentTime
      );
      this.loopbackGain = loopback;
      this.sourceNode.connect(loopback);
      loopback.connect(ctx.destination);

      const hpf = ctx.createBiquadFilter();
      hpf.type = "highpass";
      hpf.frequency.setValueAtTime(65, ctx.currentTime);
      hpf.Q.setValueAtTime(0.707, ctx.currentTime);
      this.highPassFilter = hpf;

      const tunerAna = ctx.createAnalyser();
      tunerAna.fftSize = 2048;
      tunerAna.smoothingTimeConstant = 0.0;
      this.tunerAnalyser = tunerAna;

      const chordAna = ctx.createAnalyser();
      chordAna.fftSize = 4096;
      chordAna.smoothingTimeConstant = 0.0;
      this.chordAnalyser = chordAna;

      this.sourceNode.connect(hpf);
      hpf.connect(tunerAna);
      hpf.connect(chordAna);

      this.setStatus("running");
      this.lastFrameTimestamp = performance.now();
      this.startLoop();
    } catch (err) {
      console.error("AudioEngine failed to start:", err);
      this.setStatus("error");
      await this.stop();
      throw err;
    }
  }

  /**
   * Continuous 60 FPS processing loop via requestAnimationFrame (Zero-GC).
   */
  private startLoop = (): void => {
    if (this.status !== "running") return;

    const now = performance.now();
    const deltaMs = Math.max(1, now - this.lastFrameTimestamp);
    this.lastFrameTimestamp = now;

    // 1. Process Monophonic Tuner Engine
    if (this.tunerAnalyser && this.onTunerUpdate) {
      this.tunerAnalyser.getFloatTimeDomainData(this.timeBuffer);
      const tunerResult = this.tunerEngine.process(this.timeBuffer, deltaMs);
      this.onTunerUpdate(tunerResult);
    }

    // 2. Process Polyphonic Chord Recognizer
    if (this.chordAnalyser && this.onChordUpdate) {
      this.chordAnalyser.getFloatFrequencyData(this.freqBuffer);
      const isGateOpen = this.tunerEngine.getNoiseGate().getIsOpen();
      const rms = this.tunerEngine.getNoiseGate().getLastRms();
      const chordResult = this.chordRecognizer.processSpectrum(
        this.freqBuffer,
        isGateOpen,
        rms
      );
      this.onChordUpdate(chordResult);
    }

    this.rafId = requestAnimationFrame(this.startLoop);
  };

  /**
   * Completely tears down the audio pipeline and releases all resources.
   */
  public async stop(): Promise<void> {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.mediaStream) {
      const tracks = this.mediaStream.getTracks();
      for (const track of tracks) {
        track.stop();
      }
      this.mediaStream = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    if (this.loopbackGain) {
      try {
        this.loopbackGain.disconnect();
      } catch {}
      this.loopbackGain = null;
    }

    if (this.highPassFilter) {
      try {
        this.highPassFilter.disconnect();
      } catch {}
      this.highPassFilter = null;
    }

    if (this.tunerAnalyser) {
      try {
        this.tunerAnalyser.disconnect();
      } catch {}
      this.tunerAnalyser = null;
    }

    if (this.chordAnalyser) {
      try {
        this.chordAnalyser.disconnect();
      } catch {}
      this.chordAnalyser = null;
    }

    if (this.audioCtx && this.audioCtx.state !== "closed") {
      try {
        await this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }

    this.setStatus("uninitialized");
  }
}
