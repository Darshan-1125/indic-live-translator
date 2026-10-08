import asyncio
import os
import wave

import sounddevice as sd
from dotenv import load_dotenv

from ai.services.saras_streaming import SaarasStreamingASR

SAMPLE_RATE = 16000
CHANNELS = 1
RECORD_SECONDS = 5
OUTPUT_FILE = "ai/tests/mic_test.wav"


def record_microphone():
    print("🎤 Recording for 5 seconds...")
    print("Speak Tamil/Tanglish now!")

    audio = sd.rec(
        int(RECORD_SECONDS * SAMPLE_RATE),
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype="int16",
    )

    sd.wait()

    with wave.open(OUTPUT_FILE, "wb") as wav:
        wav.setnchannels(CHANNELS)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(audio.tobytes())

    print(f"✅ Recording saved: {OUTPUT_FILE}")


async def audio_chunks():
    with open(OUTPUT_FILE, "rb") as f:
        while True:
            chunk = f.read(4096)

            if not chunk:
                break

            yield chunk


async def main():
    load_dotenv("ai/.env")

    if not os.getenv("SARVAM_API_KEY"):
        raise RuntimeError("SARVAM_API_KEY not found")

    record_microphone()

    streamer = SaarasStreamingASR(
        session_id="test-session",
        speaker_id="test-speaker",
        language_code="ta-IN",
        model="saaras:v4",
        mode="codemix",
        sample_rate=16000,
        input_audio_codec="wav",
    )

    print("\n🚀 Sending audio to Saaras...")
    print("--------------------------------")

    last_event = None

    try:
        async for event in streamer.stream(
            audio_chunks(),
            is_final_chunk=True,
        ):
            print(event)

            if event.get("is_final"):
                print("✅ Final transcript received")

            if event.get("text"):
                last_event = event

    except asyncio.CancelledError:
        pass

    print("--------------------------------")

    if last_event:
        print("📝 Final transcript:")
        print(last_event.get("text"))

    print("✅ Saaras streaming test completed")


if __name__ == "__main__":
    asyncio.run(main())