import { getWebSocketUrl } from './healthService';
import type { BackendWebSocketEvent } from '../types/translation';

export interface TranslationWebSocketCallbacks {
  /** Called for all non-"started" messages after the session is acknowledged */
  onMessage?: (event: BackendWebSocketEvent) => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (error: Event) => void;
}

/**
 * TranslationWebSocketClient wraps the backend WebSocket connection.
 *
 * Critical invariant: no audio chunk can be sent before the backend returns a
 * {"type":"started"} acknowledgement.  This is enforced by:
 *   1. sessionAcknowledged flag – sendAudioChunk is a no-op unless true.
 *   2. sendStartAndWaitForAck – opens the socket, sends "start", then waits
 *      for the ACK (or rejects on timeout / error / close).
 */
export class TranslationWebSocketClient {
  private ws: WebSocket | null = null;
  private callbacks: TranslationWebSocketCallbacks;

  /**
   * True only after the backend returns {"type":"started"}.
   * Audio chunks MUST NOT be sent before this is true.
   */
  private sessionAcknowledged = false;

  /** True after sendStart() has been called (prevents duplicate starts) */
  private startSent = false;

  constructor(callbacks: TranslationWebSocketCallbacks) {
    this.callbacks = callbacks;
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  /**
   * Opens the WebSocket.  Resolves when the socket is open (onopen).
   * Does NOT mean the backend session is ready – call sendStartAndWaitForAck
   * next.
   */
  public connect(url?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const targetUrl = url || getWebSocketUrl();
      try {
        this.ws = new WebSocket(targetUrl);
        this.sessionAcknowledged = false;
        this.startSent = false;

        this.ws.onopen = () => {
          resolve();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          this.handleRawMessage(event);
        };

        this.ws.onerror = (err) => {
          this.callbacks.onError?.(err);
          reject(new Error(`WebSocket connection to ${targetUrl} failed.`));
        };

        this.ws.onclose = (event) => {
          this.sessionAcknowledged = false;
          this.startSent = false;
          this.callbacks.onClose?.(event.code, event.reason);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // START + ACK wait
  // ---------------------------------------------------------------------------

  /**
   * Sends the "start" message and returns a Promise that resolves when the
   * backend sends back {"type":"started"}.
   *
   * Rejects if:
   *   - The socket is not open.
   *   - A "start" was already sent for this session.
   *   - timeoutMs elapses without an ACK.
   *   - The WebSocket is closed or errors before ACK arrives.
   *
   * The ACK listener is installed BEFORE sending "start" so the response
   * cannot be missed even if it arrives synchronously.
   */
  public sendStartAndWaitForAck(
    sessionId: string,
    speakerId: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    timeoutMs = 8000
  ): Promise<void> {
    if (!this.isOpen()) {
      return Promise.reject(new Error('WebSocket is not open. Cannot send start.'));
    }
    if (this.startSent) {
      return Promise.reject(new Error('sendStart called on an already-started session.'));
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timeoutHandle !== null) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        // Remove the temporary ACK listener
        this.ackResolve = null;
        this.ackReject = null;
      };

      const resolveOnce = () => {
        if (settled) return;
        settled = true;
        cleanup();
        this.sessionAcknowledged = true;
        resolve();
      };

      const rejectOnce = (reason: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(reason));
      };

      // Store resolve/reject so handleRawMessage can call them
      this.ackResolve = resolveOnce;
      this.ackReject = rejectOnce;

      // Timeout
      timeoutHandle = setTimeout(() => {
        rejectOnce(`Backend did not acknowledge session start within ${timeoutMs / 1000}s.`);
      }, timeoutMs);

      // Override onclose/onerror to also reject the pending ACK promise
      const wsRef = this.ws!;
      const originalOnClose = wsRef.onclose;
      const originalOnError = wsRef.onerror;

      wsRef.onclose = (event: CloseEvent) => {
        rejectOnce(`WebSocket closed before session was acknowledged (code ${event.code}).`);
        originalOnClose?.call(wsRef, event);
      };

      wsRef.onerror = (event: Event) => {
        rejectOnce('WebSocket error before session was acknowledged.');
        originalOnError?.call(wsRef, event);
      };

      // Send start AFTER installing the listener
      const payload = {
        type: 'start',
        session_id: sessionId,
        speaker_id: speakerId,
        source_language_code: sourceLanguageCode,
        target_language_code: targetLanguageCode,
      };
      this.ws!.send(JSON.stringify(payload));
      this.startSent = true;
      console.debug('[WS] → start sent, waiting for "started" ACK…', { sessionId, speakerId, sourceLanguageCode, targetLanguageCode });
    });
  }

  // Temporary callbacks used only during ACK wait
  private ackResolve: (() => void) | null = null;
  private ackReject: ((reason: string) => void) | null = null;

  // ---------------------------------------------------------------------------
  // Internal message dispatcher
  // ---------------------------------------------------------------------------

  private handleRawMessage(event: MessageEvent): void {
    let data: BackendWebSocketEvent;
    try {
      data = JSON.parse(event.data) as BackendWebSocketEvent;
    } catch (parseError) {
      console.warn('[WS] Received non-JSON WebSocket message:', event.data, parseError);
      return;
    }

    if (data.type === 'started') {
      // Resolve the ACK promise if we are still waiting
      if (this.ackResolve) {
        console.debug('[WS] ← "started" ACK received from backend');
        this.ackResolve();
        // Restore normal handlers (they may have been patched during ACK wait)
        this.restoreNormalHandlers();
      } else if (this.sessionAcknowledged) {
        // Duplicate "started" – ignore safely
        console.debug('[WS] Ignoring duplicate "started" message');
      }
      // Do NOT forward "started" to onMessage – callers handle it via the Promise
      return;
    }

    // All other messages go to the normal message handler
    this.callbacks.onMessage?.(data);
  }

  /** After ACK is received restore the normal onclose/onerror handlers */
  private restoreNormalHandlers(): void {
    if (!this.ws) return;
    this.ws.onclose = (event: CloseEvent) => {
      this.sessionAcknowledged = false;
      this.startSent = false;
      this.callbacks.onClose?.(event.code, event.reason);
    };
    this.ws.onerror = (err: Event) => {
      this.callbacks.onError?.(err);
    };
  }

  // ---------------------------------------------------------------------------
  // Audio streaming
  // ---------------------------------------------------------------------------

  /**
   * Sends a raw PCM base64 audio chunk.
   * Silently drops the chunk if:
   *   - The session has not been acknowledged ("started" not yet received).
   *   - The WebSocket is not open.
   *   - The payload is empty.
   */
  public sendAudioChunk(base64Pcm: string): void {
    if (!this.isOpen()) return;
    if (!this.sessionAcknowledged) {
      // Invariant guard – should never fire if useLiveTranslation is correct
      console.warn('[WS] Dropping audio chunk – session not yet acknowledged by backend.');
      return;
    }
    if (!base64Pcm || base64Pcm.length === 0) return;
    const payload = { type: 'audio', audio: base64Pcm };
    this.ws!.send(JSON.stringify(payload));
  }

  // ---------------------------------------------------------------------------
  // Stop
  // ---------------------------------------------------------------------------

  /**
   * Sends the "stop" message and marks the session as ended.
   * Safe to call even if the session was never acknowledged (will skip send).
   */
  public sendStop(): void {
    if (!this.isOpen()) return;
    if (!this.startSent) {
      console.warn('[WS] sendStop called but start was never sent – skipping.');
      return;
    }
    this.ws!.send(JSON.stringify({ type: 'stop' }));
    this.sessionAcknowledged = false;
    this.startSent = false;
    console.debug('[WS] → stop sent');
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  public isOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public get hasAcknowledgedSession(): boolean {
    return this.sessionAcknowledged;
  }

  public get hasStartedSession(): boolean {
    return this.startSent;
  }

  /** Cancel any pending ACK wait and close the socket. */
  public cancelAndClose(reason = 'Session cancelled by user'): void {
    // Reject a pending ACK promise so the caller doesn't hang
    if (this.ackReject) {
      this.ackReject(reason);
    }
    this.sessionAcknowledged = false;
    this.startSent = false;
    if (this.ws) {
      try {
        if (
          this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING
        ) {
          this.ws.close();
        }
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  public close(): void {
    this.cancelAndClose('Session closed');
  }
}
