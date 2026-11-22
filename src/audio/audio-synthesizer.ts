/**
 * 100% Synthetic Web Audio Engine for Metronome, Acoustic Plucks, and Chords.
 * Replaces heavy recorded MP3/WAV assets and time-stretching with zero-footprint,
 * crystalline sub-microsecond Web Audio synthesis.
 */

export class AudioSynthesizer {
  /**
   * Plays a metronome click at an exact AudioContext timestamp.
   * Downbeat: 1000 Hz, 35ms decay. Upbeat: 800 Hz, 25ms decay.
   */
  public static playMetronomeClick(
    audioCtx: AudioContext,
    time: number,
    isDownbeat: boolean
  ): void {
    if (!audioCtx || audioCtx.state === "closed") return;

    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(isDownbeat ? 1000 : 800, time);

      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + (isDownbeat ? 0.035 : 0.025));

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(time);
      osc.stop(time + (isDownbeat ? 0.035 : 0.025));
    } catch (e) {
      console.warn("Could not schedule metronome click:", e);
    }
  }

  /**
   * Crystalline success ting chime in 1760 Hz (A6) with 350ms decay.
   */
  public static playConfirmationTing(audioCtx: AudioContext, time: number): void {
    if (!audioCtx || audioCtx.state === "closed") return;

    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1760, time);

      gain.gain.setValueAtTime(0.25, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(time);
      osc.stop(time + 0.35);
    } catch (e) {
      console.warn("Could not schedule confirmation ting:", e);
    }
  }

  /**
   * Plays progressive calibration feedback chimes:
   * Step 1: 880 Hz (A5), 30ms
   * Step 2: 1174.66 Hz (D6), 30ms
   * Step 3: 1760 Hz (A6) crystalline confirmation ting (350ms decay)
   */
  public static playCalibrationStepChime(
    audioCtx: AudioContext,
    step: 1 | 2 | 3,
    time: number
  ): void {
    if (!audioCtx || audioCtx.state === "closed") return;
    try {
      if (step === 1) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, time);
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(time);
        osc.stop(time + 0.03);
      } else if (step === 2) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1174.66, time);
        gain.gain.setValueAtTime(0.22, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(time);
        osc.stop(time + 0.03);
      } else {
        this.playConfirmationTing(audioCtx, time);
      }
    } catch (e) {
      console.warn("Could not schedule calibration chime:", e);
    }
  }

  /**
   * Subtle damped thud for Miss feedback.
   */
  public static playDampedMissSound(audioCtx: AudioContext, time: number): void {
    if (!audioCtx || audioCtx.state === "closed") return;

    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(130, time);
      osc.frequency.exponentialRampToValueAtTime(60, time + 0.08);

      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(time);
      osc.stop(time + 0.08);
    } catch (e) {
      console.warn("Could not schedule miss sound:", e);
    }
  }

  /**
   * Simulates a plucked acoustic guitar string using subtractive synthesis
   * with dynamic low-pass envelope (fast attack, decaying brightness).
   */
  public static playSynthesizedNote(
    audioCtx: AudioContext,
    frequency: number,
    time: number,
    durationSec: number = 1.0,
    gainLevel: number = 0.2
  ): void {
    if (!audioCtx || audioCtx.state === "closed" || frequency <= 20) return;

    try {
      const osc = audioCtx.createOscillator();
      const filter = audioCtx.createBiquadFilter();
      const gain = audioCtx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(frequency, time);

      // Filter sweep to mimic natural string brightness decay
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(3500, frequency * 6), time);
      filter.frequency.exponentialRampToValueAtTime(
        Math.min(600, frequency * 2),
        time + Math.min(durationSec, 0.4)
      );

      // ADSR Amplitude Envelope
      const attackTime = 0.008;
      const decayDuration = Math.max(0.1, durationSec);

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(gainLevel, time + attackTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + decayDuration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(time);
      osc.stop(time + decayDuration);
    } catch (e) {
      console.warn("Could not schedule synthesized note:", e);
    }
  }

  /**
   * Plays a synthesized guitar chord with natural arpeggiated strumming (downstrum delta).
   */
  public static playSynthesizedChord(
    audioCtx: AudioContext,
    frequencies: number[],
    time: number,
    durationSec: number = 2.0,
    strumDeltaSec: number = 0.018 // 18ms between strings
  ): void {
    if (!audioCtx || audioCtx.state === "closed" || frequencies.length === 0) return;

    const perStringGain = 0.3 / Math.sqrt(frequencies.length);

    for (let i = 0; i < frequencies.length; i++) {
      const stringTime = time + i * strumDeltaSec;
      const noteFreq = frequencies[i];
      if (noteFreq > 0) {
        this.playSynthesizedNote(
          audioCtx,
          noteFreq,
          stringTime,
          durationSec - i * strumDeltaSec,
          perStringGain
        );
      }
    }
  }
}
