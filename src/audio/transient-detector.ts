export interface TransientEvent {
  isOnset: boolean;
  rms: number;
  deltaRms: number;
  spectralFlux: number;
  odfValue: number;
  isRejected: boolean;
  rejectionReason?: "LOW_CLARITY" | "HIGH_CENTROID" | "WRONG_STRING_WINDOW";
  timestamp: number;
}

export class TransientDetector {
  private sampleRate: number;
  private fftSize: number;
  private binWidth: number;
  private minBin: number;
  private maxBin: number;

  // Zero-GC pre-allocated arrays
  private prevMagnitudes: Float32Array;
  private currentMagnitudes: Float32Array;
  private prevRms: number = 0;
  private cooldownTimerMs: number = 0;

  // Adaptive background statistics (running EMA)
  private odfMean: number = 0.05;
  private odfVariance: number = 0.01;

  // Pre-allocated result struct for Zero-GC
  private result: TransientEvent;

  constructor(sampleRate: number = 44100, fftSize: number = 2048) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.binWidth = sampleRate / fftSize;

    // Freq range 70 Hz to 8000 Hz
    this.minBin = Math.max(1, Math.floor(70 / this.binWidth));
    this.maxBin = Math.min(
      Math.floor(fftSize / 2) - 1,
      Math.ceil(8000 / this.binWidth)
    );

    const halfBins = Math.floor(fftSize / 2);
    this.prevMagnitudes = new Float32Array(halfBins);
    this.currentMagnitudes = new Float32Array(halfBins);

    this.odfMean = 0.02;
    this.odfVariance = 0.005;

    this.result = {
      isOnset: false,
      rms: 0,
      deltaRms: 0,
      spectralFlux: 0,
      odfValue: 0,
      isRejected: false,
      timestamp: 0,
    };
  }

  public reset(): void {
    this.prevRms = 0;
    this.cooldownTimerMs = 0;
    this.odfMean = 0.02;
    this.odfVariance = 0.005;
    this.prevMagnitudes.fill(0);
    this.currentMagnitudes.fill(0);

    this.result.isOnset = false;
    this.result.rms = 0;
    this.result.deltaRms = 0;
    this.result.spectralFlux = 0;
    this.result.odfValue = 0;
    this.result.isRejected = false;
    this.result.rejectionReason = undefined;
    this.result.timestamp = 0;
  }

  public getSampleRate(): number {
    return this.sampleRate;
  }

  public setSampleRate(sampleRate: number): void {
    this.sampleRate = sampleRate;
    this.binWidth = sampleRate / this.fftSize;
    this.minBin = Math.max(1, Math.floor(70 / this.binWidth));
    this.maxBin = Math.min(
      Math.floor(this.fftSize / 2) - 1,
      Math.ceil(3500 / this.binWidth)
    );
  }

  public process(
    timeBuffer: Float32Array,
    freqBuffer: Float32Array,
    clarity: number,
    targetFreq?: number,
    detectedFreq?: number,
    deltaMs: number = 16.6
  ): TransientEvent {
    const N = timeBuffer.length;
    let sumSq = 0;
    for (let i = 0; i < N; i++) {
      const v = timeBuffer[i];
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / N);
    const deltaRms = rms - this.prevRms;
    this.prevRms = rms;

    // Convert frequency buffer (dBFS or linear) and compute half-wave rectified spectral flux
    const numBins = Math.min(freqBuffer.length, this.currentMagnitudes.length);
    let spectralFlux = 0;
    let weightedFreqSum = 0;
    let totalMagnitude = 0;

    for (let k = 0; k < numBins; k++) {
      // AnalyserNode.getFloatFrequencyData produces dBFS values (typically -100 to 0)
      const rawVal = freqBuffer[k];
      let mag = 0;
      if (rawVal > -100) {
        // If rawVal is in dBFS (<= 0), convert: 10^(db/20)
        // If rawVal is already linear (> 0), use directly
        mag = rawVal <= 0 ? Math.pow(10, rawVal / 20) : rawVal;
      }
      this.currentMagnitudes[k] = mag;

      if (k >= this.minBin && k <= this.maxBin) {
        const diff = mag - this.prevMagnitudes[k];
        // Half-wave rectification: H(x) = (x + |x|) / 2 (only positive energy surges)
        if (diff > 0) {
          spectralFlux += diff;
        }
      }

      const freq = k * this.binWidth;
      weightedFreqSum += freq * mag;
      totalMagnitude += mag;
    }

    // Copy current to previous for next frame
    for (let k = 0; k < numBins; k++) {
      this.prevMagnitudes[k] = this.currentMagnitudes[k];
    }

    // Spectral Centroid
    const spectralCentroid =
      totalMagnitude > 1e-6 ? weightedFreqSum / totalMagnitude : 0;

    // Combined Onset Detection Function (ODF)
    const normDeltaRms = Math.min(1.0, Math.max(0, deltaRms) / 0.04);
    const normSpectralFlux = Math.min(1.0, spectralFlux / 2.0);
    const odf = 0.5 * normDeltaRms + 0.5 * normSpectralFlux;

    // Update adaptive background statistics (EMA)
    const odfStd = Math.sqrt(Math.max(1e-6, this.odfVariance));
    const adaptiveThreshold = this.odfMean + 2.5 * odfStd + 0.15;

    // Only update background when not in peak onset
    if (odf < adaptiveThreshold) {
      this.odfMean = 0.95 * this.odfMean + 0.05 * odf;
      const diff = odf - this.odfMean;
      this.odfVariance = 0.95 * this.odfVariance + 0.05 * (diff * diff);
    }

    if (this.cooldownTimerMs > 0) {
      this.cooldownTimerMs = Math.max(0, this.cooldownTimerMs - deltaMs);
    }

    const candidateOnset =
      this.cooldownTimerMs === 0 &&
      odf > adaptiveThreshold &&
      rms > 0.012;

    this.result.rms = rms;
    this.result.deltaRms = deltaRms;
    this.result.spectralFlux = spectralFlux;
    this.result.odfValue = odf;
    this.result.timestamp = Date.now();

    if (!candidateOnset) {
      this.result.isOnset = false;
      this.result.isRejected = false;
      this.result.rejectionReason = undefined;
      return this.result;
    }

    // Rejection filters
    // Criterion 1: Clarity YIN >= 0.70 (Rejects body knocks / taps with low harmonic clarity)
    if (clarity < 0.7) {
      this.result.isOnset = false;
      this.result.isRejected = true;
      this.result.rejectionReason = "LOW_CLARITY";
      return this.result;
    }

    // Criterion 2: Spectral Centroid <= 3500 Hz (Rejects fret scraping / finger friction)
    if (spectralCentroid > 3500) {
      this.result.isOnset = false;
      this.result.isRejected = true;
      this.result.rejectionReason = "HIGH_CENTROID";
      return this.result;
    }

    // Criterion 3: String pitch window (+/- 350 cents or harmonic multiples)
    // Acoustic guitar strings frequently radiate strong 2nd (2.0x) or 3rd (3.0x) harmonics on attack.
    if (
      targetFreq !== undefined &&
      targetFreq > 0 &&
      detectedFreq !== undefined &&
      detectedFreq > 0
    ) {
      const centsDiff = Math.abs(
        1200 * (Math.log(detectedFreq / targetFreq) / Math.LN2)
      );

      const octaveRatio = detectedFreq / targetFreq;
      const isHarmonic =
        Math.abs(octaveRatio - 2.0) < 0.15 ||
        Math.abs(octaveRatio - 3.0) < 0.2 ||
        Math.abs(octaveRatio - 0.5) < 0.08;

      if (centsDiff > 350 && !isHarmonic) {
        this.result.isOnset = false;
        this.result.isRejected = true;
        this.result.rejectionReason = "WRONG_STRING_WINDOW";
        return this.result;
      }
    }

    // Confirmed legitimate onset!
    this.result.isOnset = true;
    this.result.isRejected = false;
    this.result.rejectionReason = undefined;
    this.cooldownTimerMs = 450.0; // 450ms cooldown

    return this.result;
  }
}
