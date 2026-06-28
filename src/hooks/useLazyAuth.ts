import { useState, useEffect, useCallback } from 'react';
import { 
  signInAnonymously, 
  GoogleAuthProvider, 
  linkWithPopup, 
  User,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../config/firebase';

export function useLazyAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // 1. Initial check
    if (auth.currentUser) {
        setUser(auth.currentUser);
        setLoading(false);
    }

    // 2. Listen to auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      // Update user in Firestore
      if (currentUser && !currentUser.isAnonymous) {
        try {
          const { doc, setDoc } = await import('firebase/firestore');
          const { db } = await import('../config/firebase');
          
          await setDoc(doc(db, 'users', currentUser.uid), {
            uid: currentUser.uid,
            email: currentUser.email || null,
            displayName: currentUser.displayName || null,
            photoURL: currentUser.photoURL || null,
            isAnonymous: currentUser.isAnonymous,
            lastLoginAt: new Date().toISOString()
          }, { merge: true });
        } catch (err) {
          console.error("Failed to record user in Firestore:", err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const signInAnonymouslyIfNeeded = useCallback(async () => {
    if (auth.currentUser) return auth.currentUser;
    try {
      await setPersistence(auth, browserLocalPersistence);
      const cred = await signInAnonymously(auth);
      setUser(cred.user);
      return cred.user;
    } catch (err: any) {
      if (err?.code === 'auth/admin-restricted-operation' || err?.message?.includes('admin-restricted-operation')) {
        console.log(
          "ℹ️ Firebase Anonymous Sign-In is currently disabled in your Firebase Console.\n" +
          "To enable real persistent anonymous check-ins, go to:\n" +
          "👉 Firebase Console > Authentication > Sign-in method > Enable 'Anonymous' provider.\n" +
          "Falling back to local session-based user authentication."
        );
      } else {
        console.error("Anonymous auth failed", err);
      }
      return null;
    }
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const upgradeToGoogleAccount = async () => {
    if (!auth.currentUser) return null;
    
    // If the user already has linked Google (not anonymous)
    if (!auth.currentUser.isAnonymous) {
       return auth.currentUser;
    }

    const provider = new GoogleAuthProvider();
    try {
      const result = await linkWithPopup(auth.currentUser, provider);
      setUser(result.user);
      
      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const { db } = await import('../config/firebase');
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid,
          email: result.user.email || null,
          displayName: result.user.displayName || null,
          photoURL: result.user.photoURL || null,
          isAnonymous: result.user.isAnonymous,
          lastLoginAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error("Failed to record user in Firestore after Google link:", err);
      }
      
      return result.user;
    } catch (err: any) {
      console.error("Failed to link Google account", err);
      if (err?.code === 'auth/unauthorized-domain') {
        alert(`Authentication failed: Unauthorized domain.\n\nPlease add "${window.location.hostname}" to your Firebase Console under Authentication -> Settings -> Authorized domains.`);
      }
      setError(err instanceof Error ? err : new Error('Google link failed'));
      throw err;
    }
  };

  const registerWithEmail = async (email: string, pin: string, displayName: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pin);
      await updateProfile(result.user, { displayName });
      await sendEmailVerification(result.user);
      setUser(result.user);
      
      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const { db } = await import('../config/firebase');
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid,
          email: result.user.email || null,
          displayName: displayName || null,
          photoURL: result.user.photoURL || null,
          isAnonymous: result.user.isAnonymous,
          lastLoginAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error("Failed to record user in Firestore during registration:", err);
      }
      
      return { user: result.user, needsVerification: true };
    } catch (err) {
      throw err;
    }
  };

  const loginWithEmail = async (email: string, pin: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, pin);
      setUser(result.user);
      
      if (!result.user.isAnonymous) {
        try {
          const { doc, setDoc } = await import('firebase/firestore');
          const { db } = await import('../config/firebase');
          await setDoc(doc(db, 'users', result.user.uid), {
            uid: result.user.uid,
            email: result.user.email || null,
            displayName: result.user.displayName || null,
            photoURL: result.user.photoURL || null,
            isAnonymous: result.user.isAnonymous,
            lastLoginAt: new Date().toISOString()
          }, { merge: true });
        } catch (err) {
          console.error("Failed to update user in Firestore during login:", err);
        }
      }
      
      return { user: result.user, needsVerification: !result.user.emailVerified };
    } catch (err) {
      throw err;
    }
  };

  const resendVerification = async () => {
    const currentUser = auth.currentUser || user;
    if (currentUser && !currentUser.emailVerified) {
      await sendEmailVerification(currentUser);
    } else if (!currentUser) {
      throw new Error("No user is currently signed in. Please log in first to resend.");
    } else {
      throw new Error("Email is already verified!");
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      console.error("Password reset failed", err);
      throw err;
    }
  };

  return { user, loading, error, upgradeToGoogleAccount, registerWithEmail, loginWithEmail, logout, resendVerification, resetPassword, signInAnonymouslyIfNeeded };
}

