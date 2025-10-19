import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) {
      return;
    }

    const initPushNotifications = async () => {
      try {
        // Request permission to use push notifications
        const result = await PushNotifications.requestPermissions();

        if (result.receive === 'granted') {
          // Register with Apple / Google to receive push via APNS/FCM
          await PushNotifications.register();
        } else {
          console.log('Push notification permission denied');
        }
      } catch (error) {
        console.error('Error initializing push notifications:', error);
      }
    };

    // Add listeners
    const addListeners = async () => {
      // On successful registration
      await PushNotifications.addListener('registration', async (token) => {
        console.log('Push registration success, token:', token.value);

        // Save the token to the database
        try {
          const platform = Capacitor.getPlatform();
          
          await supabase.from('device_tokens').upsert({
            user_id: user.id,
            token: token.value,
            platform: platform,
          });

          console.log('Device token saved to database');
        } catch (error) {
          console.error('Error saving device token:', error);
        }
      });

      // On registration error
      await PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on registration:', error);
      });

      // Show notification when app is open
      await PushNotifications.addListener(
        'pushNotificationReceived',
        (notification) => {
          console.log('Push notification received:', notification);
          toast.info(notification.title || 'New Notification', {
            description: notification.body,
          });
        }
      );

      // Handle notification tap
      await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (notification) => {
          console.log('Push notification action performed:', notification);
          // You can add navigation logic here based on notification data
        }
      );
    };

    initPushNotifications();
    addListeners();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [user]);
}
