/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// Precache static assets built by Vite
precacheAndRoute((self as any).__WB_MANIFEST || []);

// We don't skip waiting here automatically, but it's okay for PWA plugin's autoUpdate to manage it

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING')
    self.skipWaiting();
});

declare const importScripts: (...urls: string[]) => void;

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "next-489515",
  appId: "1:947258146571:web:2dd66aa09474e5f7d22c0e",
  apiKey: "AIzaSyAiczfp6lTr57-VrZyJXZKWbHKx32kBBtg",
  authDomain: "next-489515.firebaseapp.com",
  storageBucket: "next-489515.firebasestorage.app",
  messagingSenderId: "947258146571"
};

try {
  (self as any).firebase.initializeApp(firebaseConfig);
  const messaging = (self as any).firebase.messaging();

  messaging.onBackgroundMessage((payload: any) => {
    console.log('[sw.ts] Received background message ', payload);
    const notificationTitle = payload.notification?.title || 'New Message';
    
    const notificationOptions: any = {
      body: payload.notification?.body || 'You have a new notification',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: payload.data,
      requireInteraction: true, // Keep it on screen for calls
    };

    if (payload.data?.type === 'call') {
      notificationOptions.actions = [
        { action: 'answer', title: 'Accept' },
        { action: 'reject', title: 'Reject' }
      ];
    }

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch(e) {
  console.log('Firebase messaging not initialized in sw.ts');
}

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  
  let urlToOpen = '/';
  const data = event.notification.data;
  const action = event.action; // 'answer' or 'reject'
  
  if (data) {
    if (data.type === 'message' && data.sender_id) {
       urlToOpen = `/messages?user=${data.sender_id}`;
    } else if (data.type === 'call') {
       if (action === 'reject') {
         // Maybe just open the app with reject action, or ideally ping API to reject. 
         // But opening app to process reject is safest with current architecture.
         urlToOpen = `/?call_id=${data.callId}&action=reject`;
       } else {
         urlToOpen = `/?call_id=${data.callId}&action=answer`;
       }
    } else if (data.url) {
      urlToOpen = data.url;
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients: any) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open the target URL in a new window/tab.
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
