import { resampleAndConvertToPCM16, pcmToBase64 } from './resampler';

export interface AudioCaptureCallbacks {
  onAudioChunk: (base64Pcm: string) => void;
  onAudioLevel?: (level: number) => void;
  onError?: (error: Error) => void;
}

export class PCMAudioCaptureManager {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private scriptProcessorNode: ScriptProcessorNode | null = null;
  private isCapturing = false;
  private ownsStream = true;

  // Buffer to accumulate audio until we have roughly 100ms - 200ms chunks (1600 - 3200 samples @ 16kHz)
  private accumulatedSamples: number[] = [];
  private readonly targetChunkSize = 2048; // ~128ms of 16kHz PCM audio

  private callbacks: AudioCaptureCallbacks;

  constructor(callbacks: AudioCaptureCallbacks) {
    this.callbacks = callbacks;
  }

  public async start(existingTrackOrStream?: MediaStreamTrack | MediaStream): Promise<void> {
    if (this.isCapturing) return;

    try {
      if (existingTrackOrStream) {
        this.ownsStream = false;
        if (existingTrackOrStream instanceof MediaStream) {
          this.mediaStream = existingTrackOrStream;
        } else {
          this.mediaStream = new MediaStream([existingTrackOrStream]);
        }
      } else {
        this.ownsStream = true;
        // 1. Request microphone access
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Microphone access is not supported in this browser.');
        }

        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }

      // 2. Initialize AudioContext
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const inputSampleRate = this.audioContext.sampleRate;
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // 3. Try to use AudioWorklet, fallback to ScriptProcessor if needed
      let workletLoaded = false;
      try {
        if (this.audioContext.audioWorklet) {
          // Try loading from static public path or blob URL
          try {
            await this.audioContext.audioWorklet.addModule('/audio-processor.js');
          } catch {
            // In case static path fails, load via Blob URL
            const workletCode = `
              class PCMAudioProcessor extends AudioWorkletProcessor {
                process(inputs) {
                  const input = inputs[0];
                  if (input && input.length > 0 && input[0].length > 0) {
                    this.port.postMessage(input[0]);
                  }
                  return true;
                }
              }
              registerProcessor('pcm-audio-processor', PCMAudioProcessor);
            `;
            const blob = new Blob([workletCode], { type: 'application/javascript' });
            const blobUrl = URL.createObjectURL(blob);
            await this.audioContext.audioWorklet.addModule(blobUrl);
            URL.revokeObjectURL(blobUrl);
          }

          this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-audio-processor');
          this.workletNode.port.onmessage = (event) => {
            if (!this.isCapturing) return;
            const float32Data = event.data as Float32Array;
            this.handleAudioFrame(float32Data, inputSampleRate);
          };

          this.sourceNode.connect(this.workletNode);
          workletLoaded = true;
        }
      } catch (workletError) {
        console.warn('AudioWorklet initialization fallback to ScriptProcessor:', workletError);
        workletLoaded = false;
      }

      // Fallback: ScriptProcessorNode
      if (!workletLoaded) {
        this.scriptProcessorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
        this.scriptProcessorNode.onaudioprocess = (event) => {
          if (!this.isCapturing) return;
          const inputChannel = event.inputBuffer.getChannelData(0);
          this.handleAudioFrame(inputChannel, inputSampleRate);
        };
        this.sourceNode.connect(this.scriptProcessorNode);
        // Connect to destination with zero gain to keep script processor running
        const silentGain = this.audioContext.createGain();
        silentGain.gain.value = 0;
        this.scriptProcessorNode.connect(silentGain);
        silentGain.connect(this.audioContext.destination);
      }

      this.isCapturing = true;
      this.accumulatedSamples = [];
    } catch (err: unknown) {
      this.stop();
      const error =
        err instanceof Error
          ? err
          : new Error('Failed to initialize microphone audio capture.');
      this.callbacks.onError?.(error);
      throw error;
    }
  }

  private handleAudioFrame(inputChannelData: Float32Array, inputSampleRate: number): void {
    // 1. Resample down to 16000 Hz signed 16-bit PCM
    const pcm16 = resampleAndConvertToPCM16(inputChannelData, inputSampleRate, 16000);

    // 2. Measure volume level for UI visualizer
    if (this.callbacks.onAudioLevel) {
      let sum = 0;
      for (let i = 0; i < inputChannelData.length; i++) {
        sum += inputChannelData[i] * inputChannelData[i];
      }
      const rms = Math.sqrt(sum / inputChannelData.length);
      const level = Math.min(1, rms * 5); // Normalized 0.0 - 1.0
      this.callbacks.onAudioLevel(level);
    }

    // 3. Accumulate PCM samples into target chunk size
    for (let i = 0; i < pcm16.length; i++) {
      this.accumulatedSamples.push(pcm16[i]);
    }

    // 4. Emit whenever buffer reaches target chunk size
    while (this.accumulatedSamples.length >= this.targetChunkSize) {
      const chunk = new Int16Array(this.accumulatedSamples.slice(0, this.targetChunkSize));
      this.accumulatedSamples = this.accumulatedSamples.slice(this.targetChunkSize);
      const base64 = pcmToBase64(chunk);
      this.callbacks.onAudioChunk(base64);
    }
  }

  public stop(): void {
    this.isCapturing = false;

    // Discard any remaining buffered samples – do NOT flush via onAudioChunk
    // after stop() because the WebSocket STOP message may already have been
    // sent and sending audio afterward would violate the backend protocol.
    this.accumulatedSamples = [];

    // Disconnect worklet
    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch {
        // ignore
      }
      this.workletNode = null;
    }

    // Disconnect script processor
    if (this.scriptProcessorNode) {
      try {
        this.scriptProcessorNode.disconnect();
      } catch {
        // ignore
      }
      this.scriptProcessorNode = null;
    }

    // Disconnect audio source
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // ignore
      }
      this.sourceNode = null;
    }

    // Stop all media tracks ONLY if this manager owns them
    if (this.mediaStream) {
      if (this.ownsStream) {
        this.mediaStream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });
      }
      this.mediaStream = null;
    }

    // Close AudioContext
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {
        // ignore
      }
      this.audioContext = null;
    }

    this.callbacks.onAudioLevel?.(0);
  }

  public get active(): boolean {
    return this.isCapturing;
  }
}

