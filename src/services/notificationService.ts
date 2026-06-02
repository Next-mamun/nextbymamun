import { messaging, db, auth } from '@/lib/firebase';
import { getToken } from 'firebase/messaging';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

export const updateFCMTokenInDb = async (token: string) => {
  if (token && auth.currentUser) {
    try {
      await updateDoc(doc(db, 'profiles', auth.currentUser.uid), {
        fcm_token: token,
        updated_at: new Date().toISOString()
      });
      console.log('FCM Token saved to profile:', token.substring(0, 10) + '...');
    } catch (err) {
      console.error('Failed to update FCM token in DB:', err);
    }
  }
};

// Global callback for Android native code to pass the token back
(window as any).setAndroidFCMToken = (token: string) => {
  console.log('Received native FCM token from Android WebView');
  updateFCMTokenInDb(token);
};

export const requestNotificationPermission = async () => {
  // Check if running inside our specific Android WebView with a JavascriptInterface named "AndroidApp"
  if ((window as any).AndroidApp && typeof (window as any).AndroidApp.requestPushPermission === 'function') {
    console.log('Running in Android WebView. Requesting native push permission...');
    (window as any).AndroidApp.requestPushPermission();
    return true; // Token will arrive asynchronously via setAndroidFCMToken
  }

  if (!("Notification" in window)) {
    console.log("This browser does not support desktop notification");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const msg = await messaging();
        if (msg) {
          const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BF1N2MaGEU8mze53cT65jsQZmwTj7-qbNhsqPGuc3cswdZMKu6eYi8Q9gOXNggerRSSvolQhalQIiIiNGNzC8FQ';
          const token = await getToken(msg, {
            vapidKey: vapidKey,
            serviceWorkerRegistration: registration
          });
          await updateFCMTokenInDb(token);
        }
      } catch (tokenErr) {
        console.error('Failed to get FCM token:', tokenErr);
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error requesting notification permission or getting token:", error);
    return false;
  }
};

export const sendPushNotification = async (token: string, title: string, body: string, data?: any) => {
  console.log('Sending push notification to token:', token.substring(0, 10) + '...');
  try {
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, title, body, data }),
    });
    const result = await response.json();
    console.log('Push notification response:', result);
    return result;
  } catch (error) {
    console.error('Error calling send-notification API:', error);
    return { error: 'Failed to send notification' };
  }
};

export const triggerNotification = async (receiverId: string, title: string, body: string, data?: any) => {
  try {
    const userDoc = await getDoc(doc(db, 'profiles', receiverId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.fcm_token) {
        console.log(`Triggering notification for ${receiverId} using token ${userData.fcm_token.substring(0, 10)}...`);
        return await sendPushNotification(userData.fcm_token, title, body, data);
      } else {
        console.log(`No FCM token found for user ${receiverId}`);
      }
    }
  } catch (err) {
    console.error('Failed to trigger notification:', err);
  }
  return null;
};

export const showNotification = (title: string, options?: NotificationOptions) => {
  if (Notification.permission === "granted") {
    // Only show if the tab is not focused or as per user preference
    const notification = new Notification(title, {
      icon: '/favicon.ico', // You can use a generic icon or sender's avatar
      badge: '/favicon.ico',
      ...options
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
};
