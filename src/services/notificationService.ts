import { messaging, db, auth } from '@/lib/firebase';
import { getToken } from 'firebase/messaging';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

export const cacheFCMTokenForUser = (userId: string, token: string) => {
  if (!userId || !token) return;
  try {
    localStorage.setItem(`fcm_token_${userId}`, token);
  } catch (e) {}
  tokenCache.set(userId, { token, expiry: Date.now() + 7 * 24 * 60 * 60 * 1000 });
};

export const updateFCMTokenInDb = async (token: string) => {
  if (token && auth.currentUser) {
    cacheFCMTokenForUser(auth.currentUser.uid, token);
    try {
      localStorage.setItem('my_fcm_token', token);
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
        const registration = await navigator.serviceWorker.register('/sw.js');
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

const tokenCache = new Map<string, { token: string, expiry: number }>();
let notificationQueue: Array<() => Promise<void>> = [];
let isProcessingQueue = false;

const processQueue = async () => {
  if (isProcessingQueue || notificationQueue.length === 0) return;
  isProcessingQueue = true;
  
  while (notificationQueue.length > 0) {
    const task = notificationQueue.shift();
    if (task) {
      await task();
      await new Promise(resolve => setTimeout(resolve, 300)); // Rate limit buffer
    }
  }
  
  isProcessingQueue = false;
};

export const triggerNotification = async (receiverId: string, title: string, body: string, data?: any) => {
  if (!receiverId) return null;
  // Guard: Never trigger a push notification to oneself
  if (auth.currentUser && (receiverId === auth.currentUser.uid)) {
    console.log('Skipping push notification: sender and receiver are identical.');
    return null;
  }

  const task = async () => {
    try {
      let token = '';
      const cached = tokenCache.get(receiverId);
      if (cached && Date.now() < cached.expiry) {
        token = cached.token;
      } else {
        const localToken = localStorage.getItem(`fcm_token_${receiverId}`);
        if (localToken) {
          token = localToken;
          tokenCache.set(receiverId, { token, expiry: Date.now() + 7 * 24 * 60 * 60 * 1000 });
        } else {
          try {
            const userDoc = await getDoc(doc(db, 'profiles', receiverId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              if (userData.fcm_token) {
                token = userData.fcm_token;
                cacheFCMTokenForUser(receiverId, token);
              }
            }
          } catch (docErr) {
            console.warn('Firestore read skipped/failed for FCM token:', docErr);
          }
        }
      }

      if (token) {
        console.log(`Triggering notification for ${receiverId}...`);
        await sendPushNotification(token, title, body, data);
      } else {
        console.log(`No FCM token found for user ${receiverId}`);
      }
    } catch (err) {
      console.error('Failed to trigger notification:', err);
    }
  };

  notificationQueue.push(task);
  processQueue();
  
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
