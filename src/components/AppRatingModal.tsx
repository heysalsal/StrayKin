import React, { useState, useEffect } from 'react';
import { Star, X, Send, Sparkles, AlertCircle, CheckCircle2, MessageSquare, ThumbsUp } from 'lucide-react';
import { useLazyAuth } from '../hooks/useLazyAuth';

export const triggerAppRating = (force: boolean = false) => {
  if (typeof window !== 'undefined') {
    if (!force) {
      const alreadyRated = localStorage.getItem('has_rated_app');
      const snoozedUntil = localStorage.getItem('app_rating_snoozed_until');
      if (alreadyRated === 'true') return;
      if (snoozedUntil && Date.now() < Number(snoozedUntil)) return;
    }
    window.dispatchEvent(new CustomEvent('show_app_rating'));
  }
};

const COMMON_ISSUES = [
  '📷 Camera / AI scan issue',
  '📍 Location or GPS inaccurate',
  '🐌 App is slow or lagging',
  '❓ Difficult to use / Confusing',
  '⚠️ App crash or error',
  'Other issue',
];

export default function AppRatingModal() {
  const { user } = useLazyAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [context, setContext] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const handleOpen = () => {
      setRating(0);
      setHoverRating(0);
      setContext('');
      setSuggestion('');
      setSelectedTag(null);
      setSubmitted(false);
      setIsOpen(true);
    };

    window.addEventListener('show_app_rating', handleOpen);
    return () => window.removeEventListener('show_app_rating', handleOpen);
  }, []);

  if (!isOpen) return null;

  const handleClose = () => {
    if (!submitted) {
      // Snooze for 3 days if dismissed without submitting
      localStorage.setItem('app_rating_snoozed_until', String(Date.now() + 3 * 86400000));
    }
    setIsOpen(false);
  };

  const isLowRating = rating > 0 && rating <= 3;
  const isHighRating = rating >= 4;

  const canSubmit =
    rating > 0 &&
    (!isLowRating || context.trim().length >= 3 || selectedTag !== null) &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);

    try {
      const isNativeAndroid =
        typeof window !== 'undefined' &&
        ((window as any).AndroidLauncher || navigator.userAgent.includes('StraykinAndroidApp'));
      const platform = isNativeAndroid ? 'Android Native App' : 'Web / PWA';

      const payload = {
        rating,
        context: isLowRating ? context.trim() : undefined,
        feedback: isHighRating ? suggestion.trim() : undefined,
        tags: selectedTag ? [selectedTag] : undefined,
        platform,
        userEmail: user?.email || (user?.isAnonymous ? 'Anonymous Guest' : undefined),
      };

      await fetch('/api/app-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      localStorage.setItem('has_rated_app', 'true');
      localStorage.removeItem('app_rating_snoozed_until');
      setSubmitted(true);

      setTimeout(() => {
        setIsOpen(false);
      }, 1800);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      // Still mark as done so user isn't trapped
      localStorage.setItem('has_rated_app', 'true');
      setSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
      }, 1500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRatingLabel = () => {
    const current = hoverRating || rating;
    switch (current) {
      case 1:
        return 'Very Dissatisfied';
      case 2:
        return 'Dissatisfied';
      case 3:
        return 'It was okay';
      case 4:
        return 'Good Experience!';
      case 5:
        return 'Loved it! 🎉';
      default:
        return 'Tap a star to rate';
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 px-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-orange-50 to-amber-50">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐱</span>
            <h3 className="font-black text-slate-800 text-base">Rate Your Experience</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-white/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-4">
          {submitted ? (
            <div className="py-8 flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-in zoom-in">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h4 className="text-lg font-black text-slate-800">Thank You!</h4>
              <p className="text-xs text-slate-500 max-w-[240px]">
                Your feedback directly helps us protect and care for more stray animals.
              </p>
            </div>
          ) : (
            <>
              {/* Question & Stars */}
              <div className="flex flex-col items-center text-center gap-2 pt-1">
                <p className="text-xs font-semibold text-slate-500">
                  How was your experience submitting a stray?
                </p>

                {/* Stars */}
                <div className="flex items-center gap-2 py-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = (hoverRating || rating) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => {
                          setRating(star);
                          if (star >= 4) {
                            setSelectedTag(null);
                          }
                        }}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 focus:outline-none active:scale-125 transition-transform"
                      >
                        <Star
                          className={`w-9 h-9 transition-colors ${
                            isFilled
                              ? 'text-amber-400 fill-amber-400 drop-shadow-sm'
                              : 'text-slate-200 hover:text-slate-300'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                <span
                  className={`text-xs font-bold transition-colors ${
                    rating === 5
                      ? 'text-amber-600'
                      : rating === 4
                      ? 'text-emerald-600'
                      : rating > 0
                      ? 'text-rose-600'
                      : 'text-slate-400'
                  }`}
                >
                  {getRatingLabel()}
                </span>
              </div>

              {/* Conditional context or suggestion */}
              {isLowRating && (
                <div className="flex flex-col gap-2.5 bg-rose-50/70 border border-rose-100 rounded-2xl p-3.5 animate-in fade-in duration-200">
                  <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>What problem did you encounter? *</span>
                  </div>

                  {/* Common issue chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_ISSUES.map((issue) => (
                      <button
                        key={issue}
                        type="button"
                        onClick={() => {
                          setSelectedTag(selectedTag === issue ? null : issue);
                          if (!context) setContext(issue);
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all text-left ${
                          selectedTag === issue
                            ? 'bg-rose-500 text-white shadow-sm'
                            : 'bg-white text-slate-600 border border-rose-200/70 hover:bg-rose-100/50'
                        }`}
                      >
                        {issue}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Tell us more about what went wrong so we can fix it..."
                    rows={3}
                    className="w-full text-xs p-2.5 rounded-xl border border-rose-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>
              )}

              {rating === 5 && (
                <div className="flex flex-col gap-2 bg-amber-50/60 border border-amber-100 rounded-2xl p-3.5 animate-in fade-in duration-200">
                  <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Have any suggestions for next features?</span>
                  </div>
                  <textarea
                    value={suggestion}
                    onChange={(e) => setSuggestion(e.target.value)}
                    placeholder="Tell us any feature or improvement you'd like to see! (Optional)"
                    rows={2}
                    className="w-full text-xs p-2.5 rounded-xl border border-amber-200/70 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              )}

              {rating === 4 && (
                <div className="flex flex-col gap-2 bg-emerald-50/60 border border-emerald-100 rounded-2xl p-3.5 animate-in fade-in duration-200">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                    <ThumbsUp className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>What would make it 5 stars?</span>
                  </div>
                  <textarea
                    value={suggestion}
                    onChange={(e) => setSuggestion(e.target.value)}
                    placeholder="Tell us what we can improve! (Optional)"
                    rows={2}
                    className="w-full text-xs p-2.5 rounded-xl border border-emerald-200/70 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-3 px-4 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-center"
                >
                  Maybe Later
                </button>
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                  className={`flex-[1.4] py-3 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md ${
                    canSubmit
                      ? 'bg-orange-500 hover:bg-orange-600 text-white active:scale-95 shadow-orange-500/25'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
