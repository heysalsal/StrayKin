import React, { useState, useEffect } from 'react';
import { useLazyAuth } from '../hooks/useLazyAuth';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';

export default function LoginPage() {
  const { registerWithEmail, loginWithEmail, upgradeToGoogleAccount, resendVerification, resetPassword } = useLazyAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [authError, setAuthError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!isLogin && !termsAccepted) return;
    
    try {
      if (isLogin) {
        const res = await loginWithEmail(email, pin);
        if (res?.needsVerification) {
          alert('Welcome back! Please do not forget to verify your email. You can resend the link from your Account page.');
        }
        sessionStorage.removeItem('map_center');
        sessionStorage.removeItem('map_zoom');
        navigate('/account');
      } else {
        const res = await registerWithEmail(email, pin, displayName);
        sessionStorage.removeItem('map_center');
        sessionStorage.removeItem('map_zoom');
        if (res?.needsVerification) {
          setNeedsVerification(true);
        } else {
          navigate('/account');
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') setAuthError('Invalid email or PIN.');
      else if (err.code === 'auth/email-already-in-use') setAuthError('Email already registered.');
      else if (err.code === 'auth/operation-not-allowed') setAuthError('Email/Password login is not enabled in Firebase > Authentication > Sign-in method.');
      else setAuthError(err.message || 'An error occurred. Please try again.');
    }
  };

  const isRegisterFormValid = !!(email && pin.length === 6 && displayName && termsAccepted);
  const isLoginFormValid = !!(email && pin.length === 6);
  const canSubmit = isLogin ? isLoginFormValid : isRegisterFormValid;

  if (needsVerification) {
    return (
      <div className="h-full w-full bg-slate-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-sm text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Check your email</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            We've sent a verification link to <strong>{email}</strong> from noreply@straykin.com. Please click the link to verify your account.
          </p>
          <div className="space-y-3">
             <button 
               onClick={async () => {
                 if (resendCooldown > 0) return;
                 try {
                   await resendVerification();
                   alert("Verification email resent!");
                   setResendCooldown(30);
                 } catch (e: any) {
                   alert("Could not resend: " + e.message);
                 }
               }}
               disabled={resendCooldown > 0}
               className={`w-full py-4 text-white rounded-xl font-bold shadow-md transition-colors ${resendCooldown > 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}`}
             >
               {resendCooldown > 0 ? `Wait ${resendCooldown}s` : 'Resend Email'}
             </button>
             <button 
               onClick={() => navigate('/account')}
               className="w-full py-4 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
             >
               Continue to Account
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-slate-100 overflow-y-auto flex flex-col font-sans">
      <div className="bg-white px-4 py-8 shadow-sm relative z-10 rounded-b-[2rem] flex items-center gap-4">
        <button 
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-black text-slate-900 leading-tight">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="text-xs font-bold text-slate-500 mt-0.5">
            {isLogin ? 'Sign in to continue saving strays' : 'Join our network of caretakers'}
          </p>
        </div>
      </div>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
          {authError && (
            <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100">
              {authError}
            </div>
          )}
          {!isLogin && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Display Name</label>
              <input 
                type="text" 
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required={!isLogin}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm placeholder-slate-400 mt-1 focus:outline-orange-500 focus:bg-white"
                placeholder="e.g. StraySaver"
              />
            </div>
          )}
          
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm placeholder-slate-400 mt-1 focus:outline-orange-500 focus:bg-white"
              placeholder="you@example.com"
            />
          </div>
          
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">6-Digit PIN</label>
            <input 
              type="password" 
              value={pin}
              onChange={handlePinChange}
              required
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm placeholder-slate-400 mt-1 focus:outline-orange-500 focus:bg-white tracking-[0.5em] font-mono text-center"
              placeholder="••••••"
            />
            {isLogin && (
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!email) {
                      setAuthError('Please enter your email address first to reset your PIN.');
                      return;
                    }
                    try {
                      await resetPassword(email);
                      alert('A password reset link has been sent to your email.');
                    } catch (e: any) {
                      setAuthError(e.message || 'Could not send reset email.');
                    }
                  }}
                  className="text-[10px] font-bold text-orange-500 hover:text-orange-600 transition-colors"
                >
                  Forgot your PIN?
                </button>
              </div>
            )}
          </div>

          {!isLogin && (
            <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-start gap-3">
                <input 
                  type="checkbox" 
                  required 
                  id="terms"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 shrink-0 w-4 h-4 text-orange-500 rounded focus:ring-orange-500 disabled:opacity-50"
                  title=""
                />
                <label htmlFor="terms" className="text-xs text-slate-500 leading-relaxed font-medium">
                  I agree to the <a href="/terms" target="_blank" className="font-bold text-orange-500 mx-0.5">Terms & Conditions</a> and <a href="/privacy" target="_blank" className="font-bold text-orange-500 mx-0.5">Privacy Policy</a>
                </label>
              </div>
            </div>
          )}

          <button 
            type="submit"
            disabled={!canSubmit}
            className={`w-full text-white font-black py-4 rounded-xl transition-all shadow-md mt-4 ${canSubmit ? 'bg-orange-500 hover:bg-orange-600 active:scale-95 shadow-orange-200' : 'bg-slate-300 shadow-slate-200 cursor-not-allowed'}`}
          >
            {isLogin ? 'Sign In' : 'Register'}
          </button>
        </form>

        <div className="mt-8 flex flex-col gap-5">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-300" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-black">
              <span className="bg-slate-100 px-3 text-slate-400">Or continue with</span>
            </div>
          </div>
          
          <button
            onClick={async () => {
              try {
                await upgradeToGoogleAccount();
                sessionStorage.removeItem('map_center');
                sessionStorage.removeItem('map_zoom');
                navigate('/account');
              } catch (e) {
                setAuthError('Google sign in failed.');
              }
            }}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-700 font-black py-4 rounded-xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm border border-slate-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
               <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
               <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
               <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
               <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google
          </button>
        </div>

        <div className="mt-8 text-center">
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setAuthError('');
            }}
            className="text-sm font-bold text-slate-500 hover:text-orange-500 transition-colors"
          >
            {isLogin ? "Don't have an account? Register" : "Already have an account? Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}
