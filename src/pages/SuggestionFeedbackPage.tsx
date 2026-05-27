import { ArrowLeft, Send } from 'lucide-react';
import { useState, useEffect } from 'react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function SuggestionFeedbackPage() {
  const navigate = useNavigate();
  const [suggestionType, setSuggestionType] = useState('Feedback');
  const [text, setText] = useState('');
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);

  useEffect(() => {
    const lastSubmitStr = localStorage.getItem('last_suggestion_time');
    if (lastSubmitStr) {
      const lastSubmit = parseInt(lastSubmitStr, 10);
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - lastSubmit < oneWeek) {
        setCooldownEnd(lastSubmit + oneWeek);
      } else {
        localStorage.removeItem('last_suggestion_time');
      }
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate sending to Telegram
    console.log(`Sending to Telegram: [${suggestionType}] ${text}`);
    
    // Set 1-week cooldown
    const now = Date.now();
    localStorage.setItem('last_suggestion_time', now.toString());
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    setCooldownEnd(now + oneWeek);
    setText('');
  };

  const isCooldown = cooldownEnd && cooldownEnd > Date.now();
  const cooldownDays = cooldownEnd ? Math.ceil((cooldownEnd - Date.now()) / (24 * 60 * 60 * 1000)) : 0;

  return (
    <div className="h-full w-full bg-slate-100 overflow-y-auto flex flex-col font-sans">
      <div className="bg-white px-4 py-8 shadow-sm relative z-10 rounded-b-[2rem] flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-black text-slate-900">Suggestion & Feedback</h2>
      </div>

      <div className="p-6">
        {isCooldown ? (
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 text-center py-10">
             <div className="w-20 h-20 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
               <Send className="w-10 h-10 ml-1" />
             </div>
             <h3 className="text-xl font-black text-slate-900 mb-2">Thank you!</h3>
             <p className="text-sm text-slate-500 font-medium">
               Your feedback has been submitted to our team inbox. Please wait {cooldownDays} day{cooldownDays !== 1 ? 's' : ''} before submitting another suggestion. We appreciate your patience!
             </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 space-y-4">
            <div>
               <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Category</label>
               <select 
                 value={suggestionType}
                 onChange={e => setSuggestionType(e.target.value)}
                 className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm font-bold mt-1 focus:outline-orange-500 focus:bg-white"
               >
                 <option value="Feature Request">Feature Request</option>
                 <option value="Bug Report">Bug Report</option>
                 <option value="General Feedback">General Feedback</option>
               </select>
            </div>
            <div>
               <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Details</label>
               <textarea
                 value={text}
                 onChange={e => setText(e.target.value)}
                 required
                 rows={6}
                 className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm placeholder-slate-400 mt-1 focus:outline-orange-500 focus:bg-white resize-none"
                 placeholder="Tell us what's on your mind. We read every message!"
               />
            </div>
            <button 
              type="submit"
              disabled={!text.trim()}
              className="w-full bg-orange-500 text-white font-black py-4 rounded-xl hover:bg-orange-600 transition-all active:scale-95 shadow-md shadow-orange-200 mt-4 disabled:opacity-50"
            >
              Submit Feedback
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
