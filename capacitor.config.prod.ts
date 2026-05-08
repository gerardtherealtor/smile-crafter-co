import type { CapacitorConfig } from '@capacitor/cli';

// PRODUCTION Capacitor config — used for App Store / Play Store builds.
// No `server.url`, so the app ships the bundled web code in `dist/`
// instead of trying to load the Lovable preview URL.
//
// HOW TO MAKE A STORE BUILD (run on your own machine):
//   1. mv capacitor.config.ts        capacitor.config.dev.ts
//   2. mv capacitor.config.prod.ts   capacitor.config.ts
//   3. npm install
//   4. npm run build
//   5. npx cap sync
//   6. npx capacitor-assets generate   # regenerates icon + splash from /resources
//   7. npx cap open ios   (or  npx cap open android)
//   8. Archive & upload from Xcode / Android Studio.
//
// After uploading, swap the configs back so live preview keeps hot-reloading.

const config: CapacitorConfig = {
  appId: 'com.dwaynenoeconstruction.app',
  appName: 'Dwayne Noe Construction',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
