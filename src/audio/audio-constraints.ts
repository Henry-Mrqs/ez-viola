/**
 * Defensive audio constraints for getUserMedia to strictly disable destructive
 * vocal filtering (echo cancellation, noise suppression, AGC) that clips E2 (82 Hz),
 * G3 (196 Hz) and acoustic guitar sustains on Safari iOS and Android Chrome.
 */

export function getSafeAudioConstraints(): MediaStreamConstraints {
  const audioTrackConstraints: MediaTrackConstraints & Record<string, unknown> = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 1,
    googEchoCancellation: false,
    googAutoGainControl: false,
    googNoiseSuppression: false,
    googHighpassFilter: false,
    googTypingNoiseDetection: false,
  };

  return {
    audio: audioTrackConstraints,
    video: false,
  };
}
