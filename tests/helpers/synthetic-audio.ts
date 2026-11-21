/**
 * Synthetic audio buffer generators for Unit Testing DSP & Tuner Engine
 */

export function generateSineWave(
  frequency: number,
  sampleRate: number,
  durationSec: number,
  amplitude: number = 0.8
): Float32Array {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new Float32Array(numSamples);
  const angularFreq = (2 * Math.PI * frequency) / sampleRate;

  for (let i = 0; i < numSamples; i++) {
    buffer[i] = amplitude * Math.sin(angularFreq * i);
  }
  return buffer;
}

export function generateHarmonicGuitarString(
  f0: number,
  harmonics: number[],
  sampleRate: number,
  durationSec: number
): Float32Array {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new Float32Array(numSamples);

  let totalWeight = 0;
  for (let h = 0; h < harmonics.length; h++) {
    totalWeight += harmonics[h];
  }

  for (let h = 0; h < harmonics.length; h++) {
    const harmonicFreq = f0 * (h + 1);
    if (harmonicFreq > sampleRate / 2) break; // Nyquist limit
    const weight = harmonics[h] / totalWeight;
    const angularFreq = (2 * Math.PI * harmonicFreq) / sampleRate;

    for (let i = 0; i < numSamples; i++) {
      buffer[i] += weight * Math.sin(angularFreq * i);
    }
  }

  return buffer;
}

export function generateChordBuffer(
  frequencies: number[],
  sampleRate: number,
  durationSec: number
): Float32Array {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new Float32Array(numSamples);
  const amp = 0.8 / frequencies.length;

  for (const f of frequencies) {
    const angularFreq = (2 * Math.PI * f) / sampleRate;
    for (let i = 0; i < numSamples; i++) {
      buffer[i] += amp * Math.sin(angularFreq * i);
    }
  }

  return buffer;
}

/**
 * Simulates the output of AnalyserNode.getFloatFrequencyData() in dBFS
 * for a signal containing specific frequencies and their harmonics.
 */
export function generateFftFromFrequencies(
  frequencies: number[],
  sampleRate: number,
  fftSize: number,
  noiseFloorDb: number = -85
): Float32Array {
  const binCount = fftSize / 2;
  const buffer = new Float32Array(binCount);
  buffer.fill(noiseFloorDb);

  const binWidth = sampleRate / fftSize;

  for (const f of frequencies) {
    // Fundamental and 3 harmonics
    const harmonics = [
      { freq: f, db: -15 },
      { freq: f * 2, db: -22 },
      { freq: f * 3, db: -28 },
      { freq: f * 4, db: -35 },
    ];

    for (const { freq, db } of harmonics) {
      if (freq >= sampleRate / 2) continue;
      const targetBin = Math.round(freq / binWidth);

      // Distribute peak across neighbor bins (simulating window leakage)
      for (let delta = -2; delta <= 2; delta++) {
        const bin = targetBin + delta;
        if (bin >= 0 && bin < binCount) {
          const attenuation = Math.abs(delta) * 6; // -6 dB per adjacent bin
          const currentVal = buffer[bin];
          const newVal = db - attenuation;
          if (newVal > currentVal) {
            buffer[bin] = newVal;
          }
        }
      }
    }
  }

  return buffer;
}
