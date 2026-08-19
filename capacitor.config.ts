import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.skyforge.game',
  appName: 'SKYFORGE',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0b1220',
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
};

export default config;
