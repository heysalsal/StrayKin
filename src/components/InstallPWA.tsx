import React, { useState, useEffect } from "react";
import { Download, Share, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { usePWAInstall } from "../hooks/usePWAInstall";

export function InstallPWA() {
  const { deferredPrompt, isIOS, isStandalone, triggerInstall } =
    usePWAInstall();
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
          className="fixed top-0 z-50 w-full px-4 pt-4 pb-2 pointer-events-none mt-[env(safe-area-inset-top)] flex justify-center"
        >
          <div className="bg-slate-800 text-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-slate-700 pointer-events-auto flex items-center justify-between gap-2 w-[320px] h-[50px] min-h-[50px] px-3">
            <div className="flex items-center gap-2 flex-1 overflow-hidden">
              <div className="w-6 h-6 bg-orange-500 rounded-md flex items-center justify-center shrink-0">
                <Share className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 truncate">
                <h3 className="font-bold text-[10px] text-orange-400 leading-tight uppercase tracking-wider">
                  Install App
                </h3>
                <p className="text-[9px] text-slate-300 truncate">
                  Tap <Share className="inline w-2.5 h-2.5 mx-0.5" /> then Add
                  to Home
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 bg-slate-700/50 hover:bg-slate-600 rounded shrink-0 ml-1 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5 text-slate-300" />
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
          className="fixed bottom-0 z-50 w-full px-4 pb-20 pt-4 pointer-events-none mb-[env(safe-area-inset-bottom)] flex justify-center"
        >
          <div className="bg-slate-800 text-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-slate-700 pointer-events-auto flex items-center justify-between gap-2 w-[320px] h-[50px] min-h-[50px] px-3">
            <div className="flex items-center gap-2 flex-1 overflow-hidden">
              <div className="w-6 h-6 bg-orange-500 rounded-md flex items-center justify-center shrink-0">
                <Download className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 truncate">
                <h3 className="font-bold text-[10px] text-white leading-tight uppercase tracking-wider">
                  Install App
                </h3>
                <p className="text-[9px] text-slate-300 truncate">
                  Add to Home Screen
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsDismissed(true)}
                className="text-[10px] font-bold text-slate-400 px-1 py-1 hover:text-slate-300 transition-colors"
              >
                Later
              </button>
              <button
                onClick={handleInstallClick}
                className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] uppercase tracking-wider font-bold px-2.5 py-1.5 rounded transition-colors"
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
