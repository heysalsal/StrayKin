import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { APP_UPDATES } from '../data/updates';
import { motion, AnimatePresence } from 'motion/react';

export default function UpdateLogPage() {
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(APP_UPDATES[0]?.id || null);

  const toggleAccordion = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 relative overflow-hidden">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4 shadow-sm relative z-10 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h1 className="text-xl font-bold text-slate-900 absolute left-1/2 -translate-x-1/2">
          Update Log
        </h1>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {APP_UPDATES.map((update, idx) => {
          const isExpanded = expandedId === update.id;
          
          return (
            <div key={update.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
              {idx === 0 && (
                <div className="absolute top-0 right-0 bg-primary-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl z-10">
                  LATEST
                </div>
              )}
              
              <button 
                onClick={() => toggleAccordion(update.id)}
                className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${idx === 0 ? 'bg-primary-50 text-primary-500' : 'bg-slate-100 text-slate-600'}`}>
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-800 text-base leading-tight">{update.title}</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span className="font-medium">Version {update.id}</span>
                      <span>•</span>
                      <span>{update.date}</span>
                    </div>
                  </div>
                </div>
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-slate-100 text-slate-700' : 'text-slate-400'}`}>
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-1">
                      <ul className="space-y-3 pt-4 border-t border-slate-100">
                        {update.changes.map((change, i) => (
                          <li key={i} className="flex gap-3 text-slate-600">
                            <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${idx === 0 ? 'text-primary-500' : 'text-slate-400'}`} />
                            <span className="text-sm leading-relaxed">{change}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        
        <div className="py-8 text-center text-slate-400 text-sm">
          You're up to date!
        </div>
      </div>
    </div>
  );
}
