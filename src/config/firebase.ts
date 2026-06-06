import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, 'ai-studio-a8824e8c-cfd8-459c-ba28-c6aad4888a4d');

let analyticsInstance: any = null;
isAnalyticsSupported().then(yes => yes && firebaseConfig.measurementId ? analyticsInstance = getAnalytics(app) : null);

let messagingInstance: any = null;
export const getMessagingToken = async () => {
    try {
        if (await isSupported()) {
            messagingInstance = getMessaging(app);
            return messagingInstance;
        }
    } catch(err) {
        console.warn('Messaging not supported', err);
    }
    return null;
}

