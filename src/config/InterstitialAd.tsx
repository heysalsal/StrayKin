import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AdBanner } from '../components/AdBanner';
import { X } from 'lucide-react';

interface InterstitialAdProps {
  isOpen: boolean;
  targetAlias?: string;
  onComplete: () => void;
  onCancel?: () => void;
}

export function InterstitialAd({ isOpen, targetAlias = 'Pet', onComplete, onCancel }: InterstitialAdProps) {
  const [timeLeft, setTimeLeft] = useState(5);
  const [canClose, setCanClose] = useState(false);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeLeft(5);
      setCanClose(false);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setCanClose(true);
            // We no longer auto navigate, wait for button click.
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

  const handleGoTo = () => {
    if (canClose) {
      onComplete();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto"
         >
           <div className="relative w-full max-w-[400px] h-[80vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center">
              
              <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
                 {canClose ? (
                   <button
                     onClick={handleGoTo}
                     className="px-4 py-2 rounded-full font-bold text-white text-sm bg-orange-600 shadow-lg shadow-orange-200/50 hover:bg-orange-700 active:scale-95 transition-all flex items-center gap-1"
                   >
                     Go To {targetAlias} <span className="text-lg leading-none">›</span>
                   </button>
                 ) : (
                   <div className="px-4 py-2 bg-slate-100/90 backdrop-blur-md text-slate-400 font-bold text-sm rounded-full shadow-sm border border-slate-200/50">
                     Wait {timeLeft}s
                   </div>
                 )}
              </div>

              <div className="w-full flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 relative pointer-events-auto">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest absolute top-5 left-0 w-full text-center z-10 pointer-events-none">Advertisement</p>
                
                {/* Skyscraper format wrapper */}
                <div className="flex-1 w-full h-full flex items-center justify-center mt-12 mb-4 pointer-events-auto overflow-hidden">
                   <AdBanner format="skyscraper" />
                </div>
              </div>
           </div>
         </motion.div>
      )}
    </AnimatePresence>
  );
}
