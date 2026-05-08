// Native biometric / saved-credential helpers.
// On the web these calls are wrapped in try/catch — the plugin only does work
// inside a Capacitor native shell (iOS/Android). Web users still get the
// browser's built-in password manager autofill via the autoComplete attrs on
// the <input> elements in Auth.tsx.

import { Capacitor } from "@capacitor/core";

const SERVER = "dwaynenoeconstruction.com";

let pluginCache: any = null;
const getPlugin = async () => {
  if (!Capacitor.isNativePlatform()) return null;
  if (pluginCache) return pluginCache;
  try {
    const mod = await import("capacitor-native-biometric");
    pluginCache = mod.NativeBiometric;
    return pluginCache;
  } catch {
    return null;
  }
};

export const isBiometricAvailable = async (): Promise<boolean> => {
  const p = await getPlugin();
  if (!p) return false;
  try {
    const res = await p.isAvailable();
    return !!res?.isAvailable;
  } catch {
    return false;
  }
};

export const hasSavedCredentials = async (): Promise<boolean> => {
  const p = await getPlugin();
  if (!p) return false;
  try {
    const c = await p.getCredentials({ server: SERVER });
    return !!(c?.username && c?.password);
  } catch {
    return false;
  }
};

export const saveCredentials = async (username: string, password: string) => {
  const p = await getPlugin();
  if (!p) return;
  try {
    await p.setCredentials({ username, password, server: SERVER });
  } catch {
    /* noop */
  }
};

export const clearCredentials = async () => {
  const p = await getPlugin();
  if (!p) return;
  try {
    await p.deleteCredentials({ server: SERVER });
  } catch {
    /* noop */
  }
};

export const verifyAndGetCredentials = async (): Promise<
  { username: string; password: string } | null
> => {
  const p = await getPlugin();
  if (!p) return null;
  try {
    await p.verifyIdentity({
      reason: "Sign in to Dwayne Noe Construction",
      title: "Quick Sign In",
      subtitle: "Use Face ID / Touch ID / Fingerprint",
      description: "Authenticate to access your crew portal",
    });
    const c = await p.getCredentials({ server: SERVER });
    if (c?.username && c?.password) return { username: c.username, password: c.password };
    return null;
  } catch {
    return null;
  }
};
