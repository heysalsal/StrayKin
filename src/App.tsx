/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
import SharePage from './pages/SharePage';
import CommunityPage from './pages/CommunityPage';
import HubDetail from './pages/HubDetail';
import { CatProvider, useCatDatabase } from './context/CatContext';
import { useLazyAuth } from './hooks/useLazyAuth';
import { InstallPWA } from './components/InstallPWA';

import { SettingsProvider } from './context/SettingsContext';
import { ErrorProvider } from './context/ErrorContext';

function SplashScreen({ isReady, onComplete }: { isReady: boolean, onComplete: () => void }) {
  const [fade, setFade] = useState(false);
  const [minTimePassed, setMinTimePassed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimePassed(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isReady && minTimePassed) {
      setFade(true);
      const timer = setTimeout(onComplete, 500);
      return () => clearTimeout(timer);
    }
  }, [isReady, minTimePassed, onComplete]);

  // Max timeout fallback
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setFade(true);
      setTimeout(onComplete, 500);
    }, 3000);
    return () => clearTimeout(fallbackTimer);
  }, [onComplete]);

  return (
    <div className={`absolute inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 pb-8 bg-[#e5e7eb] ${fade ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}>
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
  const { loading: authLoading } = useLazyAuth();
  const { loading: catsLoading } = useCatDatabase();

  const isReady = !authLoading && !catsLoading;

  return (
    <div className="flex flex-col h-screen w-full sm:max-w-md sm:mx-auto sm:border-x sm:border-slate-200 bg-[#e5e7eb] font-sans overflow-hidden sm:shadow-2xl relative">
      {showSplash && <SplashScreen isReady={isReady} onComplete={() => setShowSplash(false)} />}
      <InstallPWA />
      
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
          <Route path="/share" element={<SharePage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/hub/:id" element={<HubDetail />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorProvider>
      <SettingsProvider>
        <CatProvider>
          <Router>
            <MainLayout />
          </Router>
        </CatProvider>
      </SettingsProvider>
    </ErrorProvider>
  );
}
