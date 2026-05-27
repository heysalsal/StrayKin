import { useState, useEffect } from 'react';
import { 
  signInAnonymously, 
  GoogleAuthProvider, 
  linkWithPopup, 
  User,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
  signOut
} from 'firebase/auth';
import { auth } from '../config/firebase';

export function useLazyAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Check if we are using the mock API key to avoid throwing errors.
    if (auth.app.options.apiKey === "MOCK_API_KEY") {
      const persistedUser = localStorage.getItem('mock-user-state');
      if (persistedUser) {
        setUser(JSON.parse(persistedUser));
      } else {
        setUser({
          uid: 'mock-anonymous-uid',
          isAnonymous: true,
          // @ts-ignore
          providerData: []
        } as User);
      }
      setLoading(false);
      return;
    }

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
        } catch (err) {
          console.error("Anonymous auth failed (expected with mock config)", err);
          // Set a mock user for MVP demo purposes
          setUser({
            uid: 'mock-anonymous-uid',
            isAnonymous: true,
            // @ts-ignore - Mocking just enough for UI
            providerData: []
          } as User);
          setError(err instanceof Error ? err : new Error('Anonymous auth failed'));
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    if (auth.app.options.apiKey === "MOCK_API_KEY" || user?.uid === 'mock-google-uid') {
      localStorage.removeItem('mock-user-state');
      setUser({
        uid: 'mock-anonymous-uid',
        isAnonymous: true,
        // @ts-ignore
        providerData: []
      } as User);
      return;
    }
    
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const upgradeToGoogleAccount = async () => {
    // For mock MVP handling
    if (user?.uid === 'mock-anonymous-uid') {
       console.log("Mock upgrading to Google account...");
       const mockUser = {
         uid: 'mock-google-uid',
         isAnonymous: false,
         displayName: 'Mock User',
         email: 'user@example.com',
         // @ts-ignore
         providerData: [{ providerId: 'google.com' }]
       } as User;
       setUser(mockUser);
       localStorage.setItem('mock-user-state', JSON.stringify(mockUser));
       return;
    }

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

  const registerWithEmail = async (email: string, password: string, displayName: string) => {
    if (auth.app.options.apiKey === "MOCK_API_KEY" || user?.uid === 'mock-anonymous-uid') {
      const mockUser = {
         uid: `mock-user-${Date.now()}`,
         isAnonymous: false,
         displayName,
         email,
         // @ts-ignore
         providerData: [{ providerId: 'password' }]
      } as User;
      setUser(mockUser);
      localStorage.setItem('mock-user-state', JSON.stringify(mockUser));
      return mockUser;
    }
    // Real implementation would use Firebase Auth email/password signup
    // Not strictly needed for MVP unless backend connected
  };

  const loginWithEmail = async (email: string, password: string) => {
    if (auth.app.options.apiKey === "MOCK_API_KEY" || user?.uid === 'mock-anonymous-uid') {
      const mockUser = {
         uid: `mock-user-${Date.now()}`,
         isAnonymous: false,
         displayName: email.split('@')[0],
         email,
         // @ts-ignore
         providerData: [{ providerId: 'password' }]
      } as User;
      setUser(mockUser);
      localStorage.setItem('mock-user-state', JSON.stringify(mockUser));
      return mockUser;
    }
  };

  return { user, loading, error, upgradeToGoogleAccount, registerWithEmail, loginWithEmail, logout };
}
