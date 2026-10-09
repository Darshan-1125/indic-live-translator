import asyncio
import logging
from typing import Awaitable, Callable, Optional

from livekit import rtc

logger = logging.getLogger(__name__)

AudioCallback = Callable[
    [str, str, bytes],
    Awaitable[None],
]


class LiveKitAudioReceiver:
    """Receives remote LiveKit audio and forwards frames to the AI pipeline."""

    def __init__(
        self,
        session_id: str,
        on_audio: AudioCallback,
    ) -> None:
        self.session_id = session_id
        self.on_audio = on_audio
        self.room: Optional[rtc.Room] = None
        self._tasks: set[asyncio.Task] = set()

    async def connect(self, url: str, token: str) -> rtc.Room:
        self.room = rtc.Room()

        self.room.on(
            "track_subscribed",
            self._on_track_subscribed,
        )

        self.room.on(
            "track_unsubscribed",
            self._on_track_unsubscribed,
        )

        await self.room.connect(url, token)

        logger.info(
            "LiveKit receiver connected: session=%s room=%s",
            self.session_id,
            self.room.name,
        )

        # Pick up audio tracks that already existed before we joined.
        for participant in self.room.remote_participants.values():
            for publication in participant.track_publications.values():
                track = publication.track

                if isinstance(track, rtc.RemoteAudioTrack):
                    self._start_track(
                        participant.identity,
                        track,
                    )

        return self.room

    def _on_track_subscribed(
        self,
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        if not isinstance(track, rtc.RemoteAudioTrack):
            return

        logger.info(
            "Remote audio subscribed: session=%s speaker=%s track=%s",
            self.session_id,
            participant.identity,
            track.sid,
        )

        self._start_track(
            participant.identity,
            track,
        )

    def _on_track_unsubscribed(
        self,
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        logger.info(
            "Remote audio unsubscribed: session=%s speaker=%s",
            self.session_id,
            participant.identity,
        )

    def _start_track(
        self,
        speaker_id: str,
        track: rtc.RemoteAudioTrack,
    ) -> None:
        task = asyncio.create_task(
            self._consume_track(
                speaker_id,
                track,
            )
        )

        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _consume_track(
        self,
        speaker_id: str,
        track: rtc.RemoteAudioTrack,
    ) -> None:
        logger.info(
            "Starting audio stream: session=%s speaker=%s",
            self.session_id,
            speaker_id,
        )

        stream = rtc.AudioStream(
            track,
            sample_rate=16000,
            num_channels=1,
        )

        try:
            async for event in stream:
                frame = event.frame

                audio_bytes = frame.to_wav_bytes()

                if not audio_bytes:
                    continue

                await self.on_audio(
                    self.session_id,
                    speaker_id,
                    audio_bytes,
                )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Audio stream failed: session=%s speaker=%s",
                self.session_id,
                speaker_id,
            )

    async def disconnect(self) -> None:
        for task in list(self._tasks):
            task.cancel()

        if self._tasks:
            await asyncio.gather(
                *self._tasks,
                return_exceptions=True,
            )

        self._tasks.clear()

        if self.room is not None:
            await self.room.disconnect()
            self.room = None

        logger.info(
            "LiveKit receiver disconnected: session=%s",
            self.session_id,
        )