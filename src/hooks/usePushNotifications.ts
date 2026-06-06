import { useEffect, useState } from 'react';
import { getMessagingToken } from '../config/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { useLazyAuth } from './useLazyAuth';
import { doc, arrayUnion, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export function usePushNotifications() {
  const { user } = useLazyAuth();
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState(Notification.permission);

  const requestPermission = async () => {
    try {
      const p = await Notification.requestPermission();
      setPermission(p);

      if (p === 'granted') {
        const messaging = await getMessagingToken();
        if (messaging) {
          const currentToken = await getToken(messaging, { 
             // vapidKey is optional but recommended if set up in Firebase console, 
             // without it firebase creates a default.
          });
          
          if (currentToken) {
            setToken(currentToken);
            // Save token to user doc
            if (user && !user.isAnonymous) {
              const userRef = doc(db, "users", user.uid);
              try {
                await updateDoc(userRef, {
                  fcmTokens: arrayUnion(currentToken)
                });
              } catch (e) {
                 console.warn("Could not save FCM token to user", e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error requesting push permission:", error);
    }
  };

  useEffect(() => {
    let unsubscribe = () => {};
    
    async function setupMessageListener() {
      const messaging = await getMessagingToken();
      if (messaging) {
        unsubscribe = onMessage(messaging, (payload) => {
          console.log("[Foreground Push Message]: ", payload);
          // Optional: Show in-app toast or local notification
          if (payload.notification?.title) {
            alert(`${payload.notification.title}\n${payload.notification.body}`);
          }
        });
      }
    }

    if (permission === 'granted') {
      setupMessageListener();
    }

    return () => {
      unsubscribe();
    };
  }, [permission]);

  return { token, permission, requestPermission };
}
