export interface LiveKitConfig {
  serverUrl: string;
  token: string;
  useMockMode: boolean;
}

export const getLiveKitConfig = (): LiveKitConfig => {
  const serverUrl = import.meta.env.VITE_LIVEKIT_URL || '';
  const token = import.meta.env.VITE_LIVEKIT_TOKEN || '';
  const forceMock = import.meta.env.VITE_USE_MOCK_MODE === 'true';

  return {
    serverUrl,
    token,
    // Only use mock mode if explicitly forced via VITE_USE_MOCK_MODE=true
    useMockMode: forceMock,
  };
};

export const isLiveKitConfigured = (): boolean => {
  const config = getLiveKitConfig();
  return Boolean(config.serverUrl && config.token && !config.useMockMode);
};
