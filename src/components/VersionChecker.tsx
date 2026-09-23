import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';

export default function VersionChecker() {
  const [updating, setUpdating] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);

  useEffect(() => {
    // Check if we just updated after a reload
    const updateFlag = sessionStorage.getItem('app_just_updated_notification');
    if (updateFlag) {
      sessionStorage.removeItem('app_just_updated_notification');
      setJustUpdated(true);
      const t = setTimeout(() => setJustUpdated(false), 3500);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const performHardReload = async () => {
      if (updating) return;
      setUpdating(true);
      sessionStorage.setItem('app_just_updated_notification', 'true');

      // Purge all Service Worker and HTTP caches
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (e) {
        console.warn('[VersionChecker] Failed to clear caches:', e);
      }

      // Instruct service worker to take over
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }

      // Smoothly reload after 1 second so user sees the updating state
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    };

    const checkVersion = async () => {
      try {
        const cacheBuster = Date.now();
        // Fetch version from server endpoint with no-cache headers
        const res = await fetch(`/api/version?t=${cacheBuster}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
        });

        if (!res.ok) return;
        const data = await res.json();
        const serverVersion = String(data?.version || '');

        if (!serverVersion || isCancelled) return;

        const currentVersion = sessionStorage.getItem('app_current_version');

        if (!currentVersion) {
          // First time this session, record the version
          sessionStorage.setItem('app_current_version', serverVersion);
        } else if (currentVersion !== serverVersion) {
          console.log(
            `[VersionChecker] New version detected: server=${serverVersion} vs client=${currentVersion}. Updating...`
          );
          sessionStorage.setItem('app_current_version', serverVersion);
          performHardReload();
        }
      } catch (err) {
        // Silently ignore network failures (e.g. offline)
      }
    };

    // Check on mount
    checkVersion();

    // Check whenever tab/app becomes visible (user returns to app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic check every 60 seconds
    const interval = setInterval(checkVersion, 60000);

    return () => {
      isCancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [updating]);

  if (updating) {
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[10001] bg-slate-900/95 text-white px-4 py-2.5 rounded-full shadow-2xl border border-slate-700/60 backdrop-blur-md flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-4 duration-300">
        <RefreshCw className="w-4 h-4 text-orange-400 animate-spin" />
        <span>Updating to latest version...</span>
      </div>
    );
  }

  if (justUpdated) {
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[10001] bg-emerald-600/95 text-white px-4 py-2 rounded-full shadow-2xl border border-emerald-400/40 backdrop-blur-md flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-4 duration-300">
        <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
        <span>Straykin updated to latest version!</span>
      </div>
    );
  }

  return null;
}
