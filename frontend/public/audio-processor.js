class PCMAudioProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0 && input[0].length > 0) {
      const channelData = input[0];
      // Send raw channel audio to main thread
      this.port.postMessage(channelData);
    }
    return true;
  }
}

registerProcessor('pcm-audio-processor', PCMAudioProcessor);
