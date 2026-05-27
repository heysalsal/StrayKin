/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import MapView from './components/MapView';
import CatProfile from './pages/CatProfile';
import AllCatsList from './pages/AllCatsList';
import AccountPage from './pages/AccountPage';
import LoginPage from './pages/LoginPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsPage from './pages/TermsPage';
import ContactSupportPage from './pages/ContactSupportPage';
import SuggestionFeedbackPage from './pages/SuggestionFeedbackPage';
import PetProfile from './pages/PetProfile';
import { CatProvider } from './context/CatContext';
import { useLazyAuth } from './hooks/useLazyAuth';

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setFade(true), 1500); // Start fade out
    const timer2 = setTimeout(onComplete, 2000); // Remove splash completely
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, [onComplete]);

  return (
    <div className={`absolute inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none transition-opacity duration-500 pb-8 ${fade ? 'opacity-0' : 'opacity-100'}`}>
      <img 
        src="/logo.png" 
        alt="Straykin Logo" 
        className="w-48 h-48 object-contain animate-in zoom-in duration-500"
        onError={(e) => {
          // If the user hasn't uploaded /logo.png yet, show a fallback emoji
          (e.target as HTMLImageElement).outerHTML = '<div class="text-7xl animate-bounce">🐾</div>';
        }}
      />
    </div>
  );
}

function MainLayout() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <div className="flex flex-col h-screen w-full sm:max-w-md sm:mx-auto sm:border-x sm:border-slate-200 bg-[#e5e7eb] font-sans overflow-hidden sm:shadow-2xl relative">
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      
      <main className="flex-1 relative flex overflow-hidden">
        <Routes>
          <Route path="/" element={<MapView />} />
          <Route path="/cat/:id" element={<CatProfile />} />
          <Route path="/pet/:id" element={<PetProfile />} />
          <Route path="/cats" element={<AllCatsList />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/support" element={<ContactSupportPage />} />
          <Route path="/suggestions" element={<SuggestionFeedbackPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <CatProvider>
      <Router>
        <MainLayout />
      </Router>
    </CatProvider>
  );
}
