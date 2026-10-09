/**
 Resamples Float32 audio samples from any input sample rate (e.g., 44100Hz or 48000Hz)
 down to exactly 16000Hz mono, converting each sample into signed 16-bit PCM little-endian.
 */
export function resampleAndConvertToPCM16(
  inputData: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number = 16000
): Int16Array {
  if (inputSampleRate === targetSampleRate) {
    const pcm = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm;
  }

  const sampleRatio = inputSampleRate / targetSampleRate;
  const targetLength = Math.round(inputData.length / sampleRatio);
  const pcm = new Int16Array(targetLength);

  for (let i = 0; i < targetLength; i++) {
    const originalPos = i * sampleRatio;
    const indexLow = Math.floor(originalPos);
    const indexHigh = Math.min(indexLow + 1, inputData.length - 1);
    const fraction = originalPos - indexLow;

    // Linear interpolation between consecutive samples
    const sample =
      inputData[indexLow] * (1 - fraction) + inputData[indexHigh] * fraction;

    // Clamp [-1.0, 1.0] and scale to 16-bit signed PCM integer
    const clamped = Math.max(-1, Math.min(1, sample));
    pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  return pcm;
}

/**
 Converts an Int16Array or ArrayBuffer into Base64 string safely without stack overflow.
 */
export function pcmToBase64(pcmBuffer: Int16Array): string {
  const bytes = new Uint8Array(
    pcmBuffer.buffer,
    pcmBuffer.byteOffset,
    pcmBuffer.byteLength
  );
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;

  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }

  return btoa(binary);
}
