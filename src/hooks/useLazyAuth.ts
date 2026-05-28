import { useState, useEffect } from 'react';
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
    // Listen to auth state
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
      } else {
        // Try to sign in anonymously if no user is found
        try {
          await setPersistence(auth, browserLocalPersistence);
          const cred = await signInAnonymously(auth);
          setUser(cred.user);
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
          setUser(null);
          setError(null);
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
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
      return result.user;
    } catch (err) {
      console.error("Failed to link Google account", err);
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
      return { user: result.user, needsVerification: true };
    } catch (err) {
      throw err;
    }
  };

  const loginWithEmail = async (email: string, pin: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, pin);
      setUser(result.user);
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

  return { user, loading, error, upgradeToGoogleAccount, registerWithEmail, loginWithEmail, logout, resendVerification, resetPassword };
}

