import { Capacitor } from '@capacitor/core';

/**
 * Returns true when the app is running inside the Capacitor native shell
 * (iOS / Android), false in the web/PWA build. Used to hide web-only
 * features (Accounts, Team, CRM, Manager reports) from the mobile app.
 */
export const useIsNativeApp = () => Capacitor.isNativePlatform();

export const isNativeApp = () => Capacitor.isNativePlatform();