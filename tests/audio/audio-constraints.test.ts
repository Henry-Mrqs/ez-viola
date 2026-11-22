import { describe, it, expect } from "vitest";
import { getSafeAudioConstraints } from "@/audio/audio-constraints";

describe("Audio Constraints", () => {
  it("provides defensive constraints disabling voice telecommunication filters", () => {
    const constraints = getSafeAudioConstraints();
    expect(constraints.video).toBe(false);
    expect(constraints.audio).toBeDefined();

    const audio = constraints.audio as Record<string, unknown>;
    expect(audio.echoCancellation).toBe(false);
    expect(audio.noiseSuppression).toBe(false);
    expect(audio.autoGainControl).toBe(false);
    expect(audio.channelCount).toBe(1);
    expect(audio.googEchoCancellation).toBe(false);
  });
});
