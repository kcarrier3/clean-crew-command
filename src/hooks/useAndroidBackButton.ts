import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useNavigate, useLocation } from 'react-router-dom';

interface UseAndroidBackButtonOptions {
  /** Callback to handle tab navigation - return true if handled */
  onTabBack?: () => boolean;
}

export function useAndroidBackButton(options: UseAndroidBackButtonOptions = {}) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return;
    }

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const setupListener = async () => {
      listenerHandle = await App.addListener('backButton', ({ canGoBack }) => {
        // First, check if there's a custom tab handler
        if (options.onTabBack && options.onTabBack()) {
          return;
        }

        // If we're on the main page and can't go back, minimize the app
        if (location.pathname === '/' && !canGoBack) {
          App.minimizeApp();
          return;
        }

        // If we're on auth page, minimize the app
        if (location.pathname === '/auth') {
          App.minimizeApp();
          return;
        }

        // Otherwise, navigate back in history
        if (canGoBack) {
          navigate(-1);
        } else {
          // If no history, go to home
          navigate('/');
        }
      });
    };

    setupListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [navigate, location.pathname, options]);
}
