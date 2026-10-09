export const getBackendBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/$/, '');
  }
  return 'http://10.8.3.8:8000';
};

export const getWebSocketUrl = (): string => {
  // Prefer an explicit VITE_TRANSLATE_WS_URL if provided
  const explicitWs = import.meta.env.VITE_TRANSLATE_WS_URL;
  if (explicitWs && typeof explicitWs === 'string' && explicitWs.trim().length > 0) {
    return explicitWs.trim();
  }
  // Fallback: derive from VITE_BACKEND_URL
  const httpUrl = getBackendBaseUrl();
  let wsUrl = httpUrl.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
  if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
    wsUrl = `ws://${wsUrl}`;
  }
  return `${wsUrl}/ws/translate`;
};

export interface HealthCheckResult {
  isHealthy: boolean;
  url: string;
  wsUrl: string;
  error?: string;
}

export async function checkBackendHealth(): Promise<HealthCheckResult> {
  const baseUrl = getBackendBaseUrl();
  const wsUrl = getWebSocketUrl();
  const endpoint = `${baseUrl}/health`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return {
        isHealthy: true,
        url: baseUrl,
        wsUrl,
      };
    }

    return {
      isHealthy: false,
      url: baseUrl,
      wsUrl,
      error: `Server responded with HTTP status ${res.status}`,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'Backend health check timed out (4s)'
          : err.message
        : 'Failed to reach backend server';

    return {
      isHealthy: false,
      url: baseUrl,
      wsUrl,
      error: message,
    };
  }
}
