import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

// Mock configuration (replace with real Firebase config from Firebase console)
const firebaseConfig = {
  apiKey: "MOCK_API_KEY",
  authDomain: "pawmap-mock.firebaseapp.com",
  projectId: "pawmap-mock",
  storageBucket: "pawmap-mock.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:mock123",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, { experimentalForceLongPolling: true });

