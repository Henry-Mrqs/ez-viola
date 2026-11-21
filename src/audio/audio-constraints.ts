/**
 * Defensive audio constraints for getUserMedia to prevent destructive
 * vocal filtering (echo cancellation, noise suppression, AGC) that clips E2 (82 Hz)
 * and harmonic guitar sustains on Safari iOS and Android Chrome.
 */

export function getSafeAudioConstraints(): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: { ideal: false },
      noiseSuppression: { ideal: false },
      autoGainControl: { ideal: false },
      channelCount: { ideal: 1 },
    },
    video: false,
  };
}
