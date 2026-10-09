export interface LiveKitTokenRequest {
  room_name: string;
  participant_name: string;
}

export interface LiveKitTokenResponse {
  token: string;
  url: string;
}

export const getBackendUrl = (): string => {
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  return envUrl ? envUrl.trim() : 'http://10.8.3.8:8000';
};

/**
  Requests a temporary LiveKit room access token from the backend server.
  Never logs or persists the received JWT token.
 */
export async function fetchLiveKitToken(
  roomName: string,
  participantName: string
): Promise<LiveKitTokenResponse> {
  const baseUrl = getBackendUrl();
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/livekit/token`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        room_name: roomName,
        participant_name: participantName,
      }),
    });

    if (!response.ok) {
      if (response.status === 400) {
        throw new Error('Invalid room or participant name requested.');
      } else if (response.status === 401 || response.status === 403) {
        throw new Error('Meeting server authorization rejected.');
      } else if (response.status === 404) {
        throw new Error('Meeting token endpoint not found on server.');
      } else if (response.status >= 500) {
        throw new Error('Meeting server internal error. Please try again.');
      } else {
        throw new Error(`Server returned error code ${response.status}.`);
      }
    }

    const data = (await response.json()) as LiveKitTokenResponse;

    if (!data.token || !data.url) {
      throw new Error('Invalid token structure received from server.');
    }

    return data;
  } catch (error: unknown) {
    if (error instanceof TypeError && error.message.toLowerCase().includes('failed to fetch')) {
      throw new Error(
        `Unable to connect to backend server at ${baseUrl}. Please verify backend server status or switch to Mock Mode.`
      );
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to connect to the meeting server. Please try again.');
  }
}
