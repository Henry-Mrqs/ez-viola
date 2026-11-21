import { describe, it, expect } from "vitest";
import { getSafeAudioConstraints } from "@/audio/audio-constraints";

describe("Audio Constraints", () => {
  it("provides defensive constraints disabling voice telecommunication filters", () => {
    const constraints = getSafeAudioConstraints();
    expect(constraints.video).toBe(false);
    expect(constraints.audio).toBeDefined();

    const audio = constraints.audio as MediaTrackConstraints;
    expect(audio.echoCancellation).toEqual({ ideal: false });
    expect(audio.noiseSuppression).toEqual({ ideal: false });
    expect(audio.autoGainControl).toEqual({ ideal: false });
    expect(audio.channelCount).toEqual({ ideal: 1 });
  });
});
