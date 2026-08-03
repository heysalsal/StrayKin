import React, { useState, useEffect } from 'react';
import { X, Sparkles, CheckCircle2 } from 'lucide-react';
import { APP_UPDATES, LATEST_UPDATE_ID } from '../data/updates';
import { motion, AnimatePresence } from 'motion/react';

export default function UpdateLogModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if the user has seen the latest update
    const lastSeen = localStorage.getItem('last_seen_update_id');
    if (lastSeen !== LATEST_UPDATE_ID) {
      // Delay opening slightly for better UX
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('last_seen_update_id', LATEST_UPDATE_ID);
  };

  const latestUpdate = APP_UPDATES[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative z-10 flex flex-col"
          >
            <div className="bg-gradient-to-br from-primary-500 to-primary-600 p-6 text-white relative">
              <button 
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              
              <h2 className="text-2xl font-black mb-1">What's New</h2>
              <p className="text-primary-100 font-medium">Version {latestUpdate.id}</p>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="mb-2">
                <h3 className="font-bold text-slate-800 text-lg">{latestUpdate.title}</h3>
                <p className="text-sm text-slate-500 mb-4">{latestUpdate.date}</p>
              </div>
              
              <ul className="space-y-3">
                {latestUpdate.changes.map((change, idx) => (
                  <li key={idx} className="flex gap-3 text-slate-600">
                    <CheckCircle2 className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
                    <span className="text-sm leading-relaxed">{change}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={handleClose}
                className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-2xl hover:bg-slate-800 transition-colors active:scale-95"
              >
                Got it, thanks!
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
