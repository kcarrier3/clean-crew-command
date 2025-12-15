import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export function useHaptics() {
  const isNative = Capacitor.isNativePlatform();

  const impact = async (style: ImpactStyle = ImpactStyle.Medium) => {
    if (!isNative) return;
    try {
      await Haptics.impact({ style });
    } catch (error) {
      console.error('Haptic impact failed:', error);
    }
  };

  const notification = async (type: NotificationType = NotificationType.Success) => {
    if (!isNative) return;
    try {
      await Haptics.notification({ type });
    } catch (error) {
      console.error('Haptic notification failed:', error);
    }
  };

  const vibrate = async (duration: number = 300) => {
    if (!isNative) return;
    try {
      await Haptics.vibrate({ duration });
    } catch (error) {
      console.error('Haptic vibrate failed:', error);
    }
  };

  const selectionStart = async () => {
    if (!isNative) return;
    try {
      await Haptics.selectionStart();
    } catch (error) {
      console.error('Haptic selectionStart failed:', error);
    }
  };

  const selectionChanged = async () => {
    if (!isNative) return;
    try {
      await Haptics.selectionChanged();
    } catch (error) {
      console.error('Haptic selectionChanged failed:', error);
    }
  };

  const selectionEnd = async () => {
    if (!isNative) return;
    try {
      await Haptics.selectionEnd();
    } catch (error) {
      console.error('Haptic selectionEnd failed:', error);
    }
  };

  return {
    impact,
    notification,
    vibrate,
    selectionStart,
    selectionChanged,
    selectionEnd,
    ImpactStyle,
    NotificationType,
  };
}
