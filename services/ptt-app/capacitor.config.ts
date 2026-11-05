import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vn.pttads.ptt',
  appName: 'PTT',
  webDir: 'www',
  server: {
    url: 'https://rs.pttads.vn/crm/csd/chat?shell=native',
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: ['rs.pttads.vn'],
  },
  ios: { contentInset: 'automatic' },
  android: { allowMixedContent: false },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
