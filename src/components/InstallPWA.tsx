import React, { useState, useEffect } from 'react';
import { Download, Share, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function InstallPWA() {
  const { deferredPrompt, isIOS, isStandalone, triggerInstall } = usePWAInstall();
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (isIOS && !isStandalone) {
      setShowIOSPrompt(true);
    }
  }, [isIOS, isStandalone]);

  if (isStandalone || isDismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    await triggerInstall();
    setIsDismissed(true);
  };


  if (isIOS && showIOSPrompt) {
    return (
      <AnimatePresence>
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-0 z-50 w-full px-4 pt-4 pb-2 pointer-events-none mt-[env(safe-area-inset-top)]"
        >
          <div className="bg-slate-800 text-white rounded-2xl p-4 shadow-xl border border-slate-700 pointer-events-auto flex items-start gap-4">
            <div className="flex-1">
              <h3 className="font-bold text-sm mb-1 text-orange-400">Install Straykin</h3>
              <p className="text-xs text-slate-300">
                Install this app on your home screen for quick and easy access. 
                Tap the <Share className="inline w-3 h-3 mx-1" /> icon below and select <strong className="text-white">Add to Home Screen</strong>.
              </p>
            </div>
            <button 
              onClick={() => setIsDismissed(true)}
              className="p-1 bg-slate-700/50 hover:bg-slate-700 rounded-full shrink-0"
            >
              <X className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (deferredPrompt) {
    return (
      <AnimatePresence>
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="fixed bottom-0 z-50 w-full px-4 pb-20 pt-4 pointer-events-none mb-[env(safe-area-inset-bottom)]"
        >
          <div className="bg-slate-800 text-white rounded-2xl p-4 shadow-2xl border border-slate-700 pointer-events-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
                <Download className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Add to Home Screen</h3>
                <p className="text-xs text-slate-300">Install Straykin for a better experience</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsDismissed(true)}
                className="text-xs font-bold text-slate-400 px-2 py-2"
              >
                Later
              </button>
              <button 
                onClick={handleInstallClick}
                className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-md"
              >
                Install
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}
