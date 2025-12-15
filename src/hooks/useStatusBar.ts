import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

interface UseStatusBarOptions {
  style?: 'dark' | 'light' | 'default';
  backgroundColor?: string;
  overlay?: boolean;
}

export function useStatusBar(options: UseStatusBarOptions = {}) {
  const { style = 'dark', backgroundColor = '#ffffff', overlay = false } = options;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const configureStatusBar = async () => {
      try {
        // Set status bar style (dark content for light backgrounds)
        const statusBarStyle = style === 'dark' 
          ? Style.Dark 
          : style === 'light' 
            ? Style.Light 
            : Style.Default;
        
        await StatusBar.setStyle({ style: statusBarStyle });

        // Android-specific: set background color
        if (Capacitor.getPlatform() === 'android') {
          await StatusBar.setBackgroundColor({ color: backgroundColor });
        }

        // Set overlay mode (content behind status bar)
        if (overlay) {
          await StatusBar.setOverlaysWebView({ overlay: true });
        }
      } catch (error) {
        console.error('Failed to configure status bar:', error);
      }
    };

    configureStatusBar();
  }, [style, backgroundColor, overlay]);

  const setDarkContent = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await StatusBar.setStyle({ style: Style.Dark });
    } catch (error) {
      console.error('Failed to set dark content:', error);
    }
  };

  const setLightContent = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await StatusBar.setStyle({ style: Style.Light });
    } catch (error) {
      console.error('Failed to set light content:', error);
    }
  };

  const hide = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await StatusBar.hide();
    } catch (error) {
      console.error('Failed to hide status bar:', error);
    }
  };

  const show = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await StatusBar.show();
    } catch (error) {
      console.error('Failed to show status bar:', error);
    }
  };

  return { setDarkContent, setLightContent, hide, show };
}
