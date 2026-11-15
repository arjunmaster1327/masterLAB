import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.masterlab.diagnostics',
  appName: 'Master Lab',
  webDir: 'dist',
  android: {
    allowMixedContent: false
  }
};

export default config;
