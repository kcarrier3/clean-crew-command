import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // App ID format: reverse domain notation — update this to your actual domain
  // e.g., if your domain is summitfacilitiesgroup.com, use: com.summitfacilitiesgroup.crewcompass
  appId: 'com.summitfacilitiesgroup.crewcompass',
  appName: 'Crew Compass',
  webDir: 'dist',
  // NOTE: Remove the `server` block below when building for production (native app stores).
  // The server block is only used for live-reload during development.
  // For production builds, Capacitor will bundle the web app from the `dist` folder.
  // server: {
  //   url: 'https://clean-crew-command.lovable.app',
  //   cleartext: false
  // },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#ffffff',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: '#ffffff',
  },
  android: {
    backgroundColor: '#ffffff',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
