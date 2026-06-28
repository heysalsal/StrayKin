import React, { createContext, useContext, useState, ReactNode } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ErrorContextType {
  showError: (message: string) => void;
  hideError: () => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error("useError must be used within an ErrorProvider");
  }
  return context;
};

export const ErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showError = (message: string) => {
    setErrorMsg(message);
    // Optional: auto-hide after 5 seconds
    // setTimeout(() => setErrorMsg(null), 5000);
  };

  const hideError = () => {
    setErrorMsg(null);
  };

  return (
    <ErrorContext.Provider value={{ showError, hideError }}>
      {children}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 inset-x-4 md:inset-x-auto md:right-6 md:w-96 z-[9999] flex flex-col pointer-events-none"
          >
            <div className="bg-red-500 text-white p-4 rounded-xl shadow-2xl flex items-start gap-3 pointer-events-auto">
               <div className="bg-red-600/30 p-2 rounded-lg flex-shrink-0">
                 <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
               </div>
               <div className="flex-1 min-w-0 pr-1">
                 <h4 className="font-bold text-sm mb-0.5">Error Occurred</h4>
                 <p className="text-white/90 text-xs leading-relaxed break-words">{errorMsg}</p>
               </div>
               <button onClick={hideError} strokeWidth={3} className="text-white/70 hover:text-white transition-colors p-1 -mr-2 flex-shrink-0">
                 <X className="w-4 h-4" />
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ErrorContext.Provider>
  );
};
