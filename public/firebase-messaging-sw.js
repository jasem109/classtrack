// firebase-messaging-sw.js
// Handles background push notifications when the app is closed

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDtUbSlCxFlyfDG6_-O-81BCZhg8nBn6po",
  authDomain: "myweb-8702b.firebaseapp.com",
  projectId: "myweb-8702b",
  storageBucket: "myweb-8702b.firebasestorage.app",
  messagingSenderId: "962539939915",
  appId: "1:962539939915:web:62eb6fc672cc6a9f9bc5ce"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message:', payload);

  const { title, body } = payload.notification || {};
  const notifTitle = title || 'ClassTrack';
  const notifBody  = body  || 'You have a new notification';

  self.registration.showNotification(notifTitle, {
    body: notifBody,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'classtrack-notif',
    requireInteraction: true,
    data: { url: '/index.html' },
    actions: [
      { action: 'open', title: 'Open ClassTrack' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  });
});

// Click on notification opens the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('classtrack') || client.url.includes('myweb-8702b')) {
          return client.focus();
        }
      }
      return clients.openWindow('/index.html');
    })
  );
});
