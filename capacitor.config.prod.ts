import type { CapacitorConfig } from '@capacitor/cli';

// Production Capacitor config — use this when building for App Store / Play Store submission.
//
// HOW TO USE FOR A STORE BUILD (on your local machine):
//   1. Rename `capacitor.config.ts`        -> `capacitor.config.dev.ts`
//   2. Rename `capacitor.config.prod.ts`   -> `capacitor.config.ts`
//   3. npm run build && npx cap sync
//   4. Open in Xcode / Android Studio and archive/upload.
//
// The key difference: no `server.url`, so the app ships the bundled web code
// instead of loading from the Lovable preview URL.

const config: CapacitorConfig = {
  appId: 'app.lovable.63e9c6d103b74733bb79e489d68e05c6',
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
