importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDxC3R-dcwbPaNOfGqON5ulAVguD2WMBQU",
  authDomain: "straykin-98cc7.firebaseapp.com",
  projectId: "straykin-98cc7",
  storageBucket: "straykin-98cc7.firebasestorage.app",
  messagingSenderId: "558378395317",
  appId: "1:558378395317:web:346467186cf0aa25f980fc"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'Straykin Notification';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/favicon.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
