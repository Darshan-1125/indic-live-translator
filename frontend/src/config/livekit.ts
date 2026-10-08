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
    // Automatically use mock mode if no URL or Token is provided, or if explicitly forced
    useMockMode: forceMock || !serverUrl || !token,
  };
};

export const isLiveKitConfigured = (): boolean => {
  const config = getLiveKitConfig();
  return Boolean(config.serverUrl && config.token && !config.useMockMode);
};
