import { useState, useEffect } from 'react';

// Shared state
let globalDeferredPrompt: any = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    listeners.forEach(fn => fn());
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(globalDeferredPrompt);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true || document.referrer.includes('android-app://');
      
    if (isStandaloneMode) {
      setIsStandalone(true);
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIPad = userAgent.includes('macintosh') && navigator.maxTouchPoints > 1;
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) || isIPad;
    setIsIOS(isIOSDevice);

    const update = () => {
      setDeferredPrompt(globalDeferredPrompt);
    };
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const triggerInstall = async () => {
    if (globalDeferredPrompt) {
      globalDeferredPrompt.prompt();
      const { outcome } = await globalDeferredPrompt.userChoice;
      if (outcome === 'accepted') {
        globalDeferredPrompt = null;
        setDeferredPrompt(null);
      }
    }
  };

  return { deferredPrompt, isIOS, isStandalone, triggerInstall };
}
