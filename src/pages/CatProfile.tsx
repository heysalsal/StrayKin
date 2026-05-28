import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCatDatabase } from '../hooks/useCatDatabase';
import { useLazyAuth } from '../hooks/useLazyAuth';
import { ChevronLeft, Plus, Check, User, Images, Edit2, Share2, ChevronDown, ChevronUp, History, X } from 'lucide-react';
import { CatRecord } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { AdBanner } from '../components/AdBanner';

import Webcam from 'react-webcam';
export default function CatProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { cats, updateCatSighting } = useCatDatabase(); // We'll need a new updateCatProfile instead, but will add it soon
  const { user, loading, upgradeToGoogleAccount } = useLazyAuth();
  
  const [cat, setCat] = useState<CatRecord | null>(null);
  const [showInterstitial, setShowInterstitial] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowInterstitial(!user || user.isAnonymous);
    }
  }, [user, loading]);
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [mockHistory, setMockHistory] = useState<any[]>([]);

  useEffect(() => {
    // Generate some mock history data when cat loads
    if (cat && mockHistory.length === 0) {
       const h = [];
       const now = Date.now();
       const hr = 3600000;
       // We use the last_check_in as the first item if it exists
       if (cat.last_check_in && cat.last_check_in.timestamp) {
          const ts = (cat.last_check_in.timestamp as any)?.seconds ? (cat.last_check_in.timestamp as any).seconds * 1000 : now;
          h.push({
             id: 'h0',
             time: ts,
             fed: cat.last_check_in.was_fed,
             health: cat.last_check_in.status_health || 'Healthy',
             notes: cat.last_check_in.notes || '',
             user: user?.isAnonymous ? `Pawtaker #${user.uid.substring(user.uid.length - 4)}` : user?.displayName || 'App User'
          });
       }
       for (let i=1; i<=4; i++) {
          h.push({
             id: `h${i}`,
             time: now - (i * 24 * hr) - (Math.random() * hr),
             fed: Math.random() > 0.3,
             health: Math.random() > 0.8 ? 'Needs Attention' : 'Healthy',
             notes: '',
             user: Math.random() > 0.5 ? 'Anonymous' : 'Caretaker'
          });
       }
       setMockHistory(h);
    }
  }, [cat]);

  const [newTagInput, setNewTagInput] = useState('');
  
  // Check-in state
  const [wasFed, setWasFed] = useState<boolean | null>(null);
  const [healthStatus, setHealthStatus] = useState<string>('Healthy');
  const [sightingColor, setSightingColor] = useState('');
  const [sightingType, setSightingType] = useState('');
  const [sightingNeutered, setSightingNeutered] = useState<boolean | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [reportStep, setReportStep] = useState<'camera' | 'form'>('camera');
  const [photoAttempts, setPhotoAttempts] = useState(0);
  const webcamRef = useRef<Webcam>(null);

  const captureWebcam = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setPhotoDataUrl(imageSrc);
      setReportStep('form');
      setIsCameraActive(false);
    }
  }, [webcamRef]);

  const [addToGallery, setAddToGallery] = useState(true);
  const [fedToggle, setFedToggle] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [votesSpentNames, setVotesSpentNames] = useState<number>(0);
  const [votesSpentTraits, setVotesSpentTraits] = useState<number>(0);
  const [votesSpentGallery, setVotesSpentGallery] = useState<number>(0);

  // Settings
  const [userSettings, setUserSettings] = useState({ displayName: '', isAnonymous: false });
  useEffect(() => {
    const saved = localStorage.getItem('user_settings');
    if (saved) setUserSettings(JSON.parse(saved));
  }, []);

  const [votedNames, setVotedNames] = useState<string[]>([]);
  const [votedTraits, setVotedTraits] = useState<string[]>([]);
  const [votedGallery, setVotedGallery] = useState<string[]>([]);

  useEffect(() => {
    if (id) {
      setVotesSpentNames(parseInt(localStorage.getItem(`cat_vote_power_names_${id}`) || '0', 10));
      setVotesSpentTraits(parseInt(localStorage.getItem(`cat_vote_power_traits_${id}`) || '0', 10));
      setVotesSpentGallery(parseInt(localStorage.getItem(`cat_vote_power_gallery_${id}`) || '0', 10));

      setVotedNames(JSON.parse(localStorage.getItem(`cat_voted_names_${id}`) || '[]'));
      setVotedTraits(JSON.parse(localStorage.getItem(`cat_voted_traits_${id}`) || '[]'));
      setVotedGallery(JSON.parse(localStorage.getItem(`cat_voted_gallery_${id}`) || '[]'));
    }
  }, [id]);

  useEffect(() => {
    // In a real app we'd fetch directly from DB if not in local array,
    // but here we wait for cats to load.
    if (id && cats.length > 0) {
      const found = cats.find(c => c.id === id);
      if (found) {
        setCat(found);
      }
    }
  }, [id, cats]);

  const topPhotos: string[] = [];
  if (cat) {
    if (cat.imageUrl) topPhotos.push(cat.imageUrl);
    if (cat.gallery) {
      const sortedGallery = [...cat.gallery].sort((a,b) => b.votes - a.votes);
      sortedGallery.forEach(p => {
         if (p.url !== cat.imageUrl) topPhotos.push(p.url);
      });
    }
  }
  const displayPhotos = topPhotos.slice(0, 3);

  useEffect(() => {
    if (displayPhotos.length > 1) {
      const timer = setInterval(() => {
        setCurrentImageIndex(prev => (prev < displayPhotos.length - 1 ? prev + 1 : 0));
      }, 7000);
      return () => clearInterval(timer);
    }
  }, [displayPhotos.length]);

  if (!cat) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4 text-center bg-[#e5e7eb]">
        <div className="text-slate-500 font-medium">Loading Straykin profile...</div>
      </div>
    );
  }

  // 1. Name Tag Cloud logic
  let sortedNames = [...(cat.names || [])].sort((a, b) => b.votes - a.votes);
  if (sortedNames.length === 0 && cat.name) {
    sortedNames.push({ name: cat.name, votes: 1, suggestedBy: 'system' });
  }
  const topName = sortedNames.length > 0 ? sortedNames[0].name : `Straykin #${cat.id.slice(-4)}`;
  const aliasNames = [...sortedNames];
  if (!aliasNames.find(n => n.name === cat.name)) {
    aliasNames.unshift({ name: cat.name, votes: 0, suggestedBy: 'system' });
  }

  const executeWithVotePower = async (category: 'names' | 'traits' | 'gallery', itemId: string, actionDesc: string) => {
    if (loading) return 0;
    if (!user || user.isAnonymous || !user.emailVerified) {
      setShowLoginModal(true);
      return 0;
    }

    let currentSpent = 0;
    let currentVoted: string[] = [];
    if (category === 'names') { currentSpent = votesSpentNames; currentVoted = votedNames; }
    if (category === 'traits') { currentSpent = votesSpentTraits; currentVoted = votedTraits; }
    if (category === 'gallery') { currentSpent = votesSpentGallery; currentVoted = votedGallery; }

    const isDevoting = currentVoted.includes(itemId.toLowerCase());

    if (!isDevoting && currentSpent >= 3) {
      alert(`You used all 3 votes for ${category} on this Straykin!`);
      return 0;
    }
    
    const newSpent = isDevoting ? currentSpent - 1 : currentSpent + 1;
    const newVoted = isDevoting 
      ? currentVoted.filter(id => id !== itemId.toLowerCase())
      : [...currentVoted, itemId.toLowerCase()];

    if (category === 'names') {
      setVotesSpentNames(newSpent);
      setVotedNames(newVoted);
    }
    if (category === 'traits') {
      setVotesSpentTraits(newSpent);
      setVotedTraits(newVoted);
    }
    if (category === 'gallery') {
      setVotesSpentGallery(newSpent);
      setVotedGallery(newVoted);
    }
    
    if (id) {
      localStorage.setItem(`cat_vote_power_${category}_${id}`, newSpent.toString());
      localStorage.setItem(`cat_voted_${category}_${id}`, JSON.stringify(newVoted));
    }

    return isDevoting ? -1 : 1;
  };

  const handleVoteName = async (nameToVote: string) => {
    const change = await executeWithVotePower('names', nameToVote, `You voted for name "${nameToVote}"!`);
    if (change !== 0 && cat) {
      setCat(prev => {
        if (!prev) return prev;
        const newNames = (prev.names || []).map(n => n.name === nameToVote ? { ...n, votes: Math.max(0, n.votes + change) } : n);
        return { ...prev, names: newNames };
      });
    }
  };

  const handleSuggestName = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTagInput.trim()) {
      const suggestValue = newTagInput.trim();
      const change = await executeWithVotePower('names', suggestValue, `Suggested name: ${suggestValue}!`);
      if (change === 1) {
        setNewTagInput('');
        setCat(prev => {
          if (!prev) return prev;
          const newNames = [...(prev.names || []), { name: suggestValue, votes: 1, suggestedBy: 'user' }];
          return { ...prev, names: newNames };
        });
      }
    }
  };

  const handleCheckIn = async () => {
    if (loading) return;
    if (!user || user.isAnonymous || !user.emailVerified) {
      setShowLoginModal(true);
      return;
    }
    
    setCheckInLoading(true);
    
    // Attempt GPS
    let geo_point: [number, number] | undefined = undefined;
    if ('geolocation' in navigator) {
      try {
         const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
           navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
         });
         geo_point = [pos.coords.latitude, pos.coords.longitude];
      } catch (e) {
         console.warn("GPS failed", e);
      }
    }
    
    setTimeout(async () => {
      // Send to manual review
      const submissionId = `checkin_${Date.now()}`;
      try {
        await fetch('/api/submit-for-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: submissionId,
            type: 'check_in',
            details: {
              catId: cat.id,
              wasFed,
              healthStatus,
              geo_point
            },
            imageBase64: photoDataUrl
          })
        });
        alert('Check-in submitted and is under review!');
        await updateCatSighting(cat.id, {
          wasFed,
          activities: wasFed ? ['Feed'] : [],
          notes: healthStatus !== 'Good' ? healthStatus : undefined,
          photoDataUrl,
          status: 'under_review',
          submissionId
        });
      } catch (err) {
        console.error('Failed to submit:', err);
        alert('Submitted (offline preview mode).');
        await updateCatSighting(cat.id, {
          wasFed,
          activities: wasFed ? ['Feed'] : [],
          notes: healthStatus !== 'Good' ? healthStatus : undefined,
          photoDataUrl
        });
      }

      setCheckInLoading(false);
      setIsCheckInOpen(false);
      setIsShareOpen(true);
    }, 500);
  };

  // 3. Crowdsourced Certainty
  let domGender = 'Unknown';
  if (cat.genderVotes) {
     const { male, female, unknown } = cat.genderVotes;
     if (male > female && male > unknown) domGender = 'Male';
     else if (female > male && female > unknown) domGender = 'Female';
     else if (unknown > male && unknown > female) domGender = 'Unknown';
  }

  const isSterilized = (cat.sterilizedVotes || 0) > 0;
  
  const defaultColors = cat.color_tags && cat.color_tags.length > 0 ? cat.color_tags : ['Unknown Color'];

  return (
    <div className="relative h-full w-full font-sans bg-black flex flex-col overflow-y-auto pb-32">
      <div className="sticky top-0 inset-x-0 p-4 bg-gradient-to-b from-black/60 to-transparent pt-6 flex justify-between items-start z-[60] w-full mb-[-88px] pointer-events-none">
          <button 
            onClick={() => navigate(-1)} 
            className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors pointer-events-auto"
          >
            <ChevronLeft className="w-7 h-7 -ml-0.5" />
          </button>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsDetailsOpen(true)}
              className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors shadow-sm cursor-pointer pointer-events-auto"
            >
              <Edit2 className="w-5 h-5" />
            </button>
            <button 
              onClick={() => { setIsGalleryOpen(true); setViewerIndex(null); }}
              className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors shadow-sm cursor-pointer pointer-events-auto"
            >
              <Images className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsShareOpen(true)}
              className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors shadow-sm cursor-pointer pointer-events-auto"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button 
              onClick={() => navigate('/account')}
              className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors shadow-sm cursor-pointer pointer-events-auto"
            >
              <User className="w-5 h-5" />
            </button>
          </div>
        </div>

      {showInterstitial && (
         <div className="absolute inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 slide-in-from-bottom-full animate-in duration-500">
           <button onClick={() => setShowInterstitial(false)} className="absolute top-6 right-6 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 hover:bg-slate-200">✕</button>
           <h2 className="text-2xl font-black text-slate-800 mb-2">Sponsor</h2>
           <p className="text-slate-500 text-sm font-medium text-center mb-8">Adsterra Advertisement</p>
           <AdBanner format="rectangle" />
           <button onClick={() => setShowInterstitial(false)} className="px-8 py-4 mt-8 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-200">
              Continue to {cat.name || 'Straykin'}
           </button>
         </div>
      )}

      {/* Header Image */}
      <div className="relative w-full h-[85vh] shrink-0 bg-slate-800 rounded-b-[2.5rem] overflow-hidden shadow-2xl z-10 group">
        {displayPhotos.length > 0 ? (
          <>
            <AnimatePresence mode="wait">
              <motion.img 
                key={currentImageIndex}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={(event, info) => {
                  if (info.offset.x > 50) {
                    setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : displayPhotos.length - 1));
                  } else if (info.offset.x < -50) {
                    setCurrentImageIndex(prev => (prev < displayPhotos.length - 1 ? prev + 1 : 0));
                  }
                }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                src={displayPhotos[currentImageIndex]} 
                className="w-full h-full object-cover absolute inset-0 cursor-grab active:cursor-grabbing" 
                alt={topName} 
              />
            </AnimatePresence>
            
            {/* Carousel Nav Removed for unobstructed viewing */}
            
            {/* Dots */}
            {displayPhotos.length > 1 && (
              <div className="absolute top-24 inset-x-0 flex justify-center gap-1.5 z-20">
                {displayPhotos.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentImageIndex ? 'bg-white w-6' : 'bg-white/50 w-2'}`} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex w-full h-full items-center justify-center text-8xl bg-orange-100">🐈</div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-6 pb-8 pt-32 text-white">
          <div className="flex flex-col gap-1 mb-2">
            {cat.status === 'under_review' && (
              <div className="self-start bg-amber-500/20 text-amber-300 text-[10px] uppercase font-black px-2 py-0.5 rounded-full border border-amber-500/30 backdrop-blur-sm mb-1 flex items-center gap-1.5">
                <div className="w-2 h-2 border-2 border-amber-400 border-r-transparent rounded-full animate-spin" />
                Under Review
              </div>
            )}
            <div className="flex items-end gap-3">
              <h1 className="text-5xl font-black drop-shadow-md">{topName}</h1>
              <span className="text-2xl opacity-90 pb-1">{domGender === 'Male' ? '♂' : domGender === 'Female' ? '♀' : ''}</span>
            </div>
          </div>

          {/* Minimal Tag display directly on image */}
          <div className="flex flex-wrap gap-2 mb-4">
             <span className="bg-indigo-500/90 text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm backdrop-blur-md border border-indigo-400/50">{cat.animalType || 'Cat'}</span>
             {defaultColors.map(c => (
               <span key={c} className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm">{c}</span>
             ))}
             {isSterilized && <span className="bg-emerald-500/90 text-white px-3 py-1 rounded-full text-sm font-bold backdrop-blur-md shadow-sm border border-emerald-400/50">TNR Verified</span>}
          </div>

          <p className="text-sm font-medium text-white/80 flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"></span>
            Last seen recently
          </p>

          {/* Check-In History Accordion (Moved here under tray) */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden">
             <button 
               onClick={() => setIsHistoryOpen(!isHistoryOpen)}
               className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-white/5 whitespace-nowrap"
             >
               <div className="flex items-center gap-2 truncate">
                  <History className="w-5 h-5 text-white/70 shrink-0" />
                  <span className="text-sm font-bold text-white truncate">Check-in History (Last 5)</span>
               </div>
               {isHistoryOpen ? <ChevronUp className="w-5 h-5 text-white/50 shrink-0" /> : <ChevronDown className="w-5 h-5 text-white/50 shrink-0" />}
             </button>
             
             <AnimatePresence>
               {isHistoryOpen && (
                 <motion.div
                   initial={{ height: 0, opacity: 0 }}
                   animate={{ height: "auto", opacity: 1 }}
                   exit={{ height: 0, opacity: 0 }}
                   className="overflow-hidden"
                 >
                   <div className="p-4 pt-0 space-y-3">
                     {mockHistory.map((item, idx) => (
                        <div key={item.id} className="flex gap-4 items-start p-3 bg-black/20 rounded-xl">
                           <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-1">
                             <span className="text-xs">{item.fed ? '🍽️' : '🐾'}</span>
                           </div>
                           <div className="flex-1">
                              <div className="flex justify-between items-start mb-1">
                                 <p className="text-sm font-bold text-white">{item.user}</p>
                                 <span className="text-[10px] font-bold text-white/70 bg-white/10 px-2 py-0.5 rounded-full">{new Date(item.time).toLocaleDateString()}</span>
                              </div>
                              <div className="flex flex-wrap gap-1 mb-1">
                                {item.fed && <span className="text-[10px] font-bold text-orange-200 bg-orange-500/20 px-2 py-0.5 rounded-md">Fed</span>}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${item.health === 'Healthy' ? 'text-green-300 bg-green-500/20' : 'text-red-300 bg-red-500/20'}`}>{item.health}</span>
                              </div>
                              {item.notes && <p className="text-xs text-white/80 italic mt-1 bg-black/30 p-2 rounded-lg">"{item.notes}"</p>}
                           </div>
                        </div>
                     ))}
                   </div>
                 </motion.div>
               )}
             </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="px-5 space-y-6 pt-6 relative z-0">
        
        {/* Name Tag Cloud (Community Aliases) */}
        <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Community Aliases</h3>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map(v => (
                <span key={v} className={`text-xs ${v > (3 - votesSpentNames) ? 'opacity-20' : 'text-orange-500'}`}>⚡</span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {aliasNames.length > 0 ? aliasNames.map(alias => (
              <button 
                key={alias.name} 
                onClick={() => handleVoteName(alias.name)} 
                className={`group flex flex-col items-center border rounded-2xl px-4 py-2 transition-all active:scale-95 ${votedNames.includes(alias.name.toLowerCase()) ? 'bg-slate-800 border-orange-500 ring-2 ring-orange-500/50' : 'bg-slate-800 border-slate-700/50 hover:bg-slate-700 hover:border-slate-600'}`}
              >
                <span className="text-sm font-bold text-white mb-1">{alias.name}</span>
                <span className="text-xs text-orange-400 font-bold bg-orange-400/10 px-2 py-0.5 rounded-md group-hover:bg-orange-400/20">
                  +{alias.votes}
                </span>
              </button>
            )) : (
              <span className="text-sm text-slate-500 font-medium italic px-1">No aliases yet.</span>
            )}
          </div>
          <div className="mt-2 text-white">
             <input 
               type="text" 
               value={newTagInput}
               onChange={e => setNewTagInput(e.target.value)}
               onKeyDown={handleSuggestName}
               placeholder="Suggest a nickname..."
               className="w-full bg-slate-800 text-white placeholder-slate-500 border border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-colors"
             />
          </div>
        </div>

        {/* Characteristics / Traits Cloud */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Characteristics & Traits</h3>
          </div>
          <div className="flex items-center gap-1 mb-4">
            {[1, 2, 3].map(v => (
              <span key={v} className={`text-xs ${v > (3 - votesSpentTraits) ? 'opacity-20' : 'text-orange-500'}`}>⚡</span>
              ))}
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {(() => {
               const defaultTraits = ['Playful', 'Vocal', 'Clingy', 'Bite', 'Scratchy'];
               const existingTraitsMap = new Map((cat.characteristics || []).map(c => [c.tag.toLowerCase(), c]));
               
               const combinedTraits = [...(cat.characteristics || [])];
               
               defaultTraits.forEach(dt => {
                 if (!existingTraitsMap.has(dt.toLowerCase())) {
                   combinedTraits.push({ tag: dt, votes: 0 });
                 }
               });

               return combinedTraits.sort((a,b) => b.votes - a.votes).map(char => (
                 <button 
                   key={char.tag} 
                   onClick={async () => {
                     const change = await executeWithVotePower('traits', char.tag, `You voted for trait "${char.tag}"!`);
                     if (change !== 0 && cat) {
                       setCat(prev => {
                         if (!prev) return prev;
                         const chars = prev.characteristics || [];
                         const exists = chars.find(c => c.tag.toLowerCase() === char.tag.toLowerCase());
                         if (exists) {
                           return { ...prev, characteristics: chars.map(c => c.tag === char.tag ? { ...c, votes: Math.max(0, c.votes + change) } : c) };
                         } else {
                           return { ...prev, characteristics: [...chars, { tag: char.tag, votes: 1 }] };
                         }
                       });
                     }
                   }}
                   className={`group flex flex-col items-center border rounded-2xl px-4 py-2 transition-all active:scale-95 ${votedTraits.includes(char.tag.toLowerCase()) ? 'bg-orange-50 border-orange-500 ring-2 ring-orange-500/50' : char.votes > 0 ? 'bg-slate-50 border-slate-200 hover:bg-orange-50 hover:border-orange-200' : 'bg-transparent border-dashed border-slate-300 hover:border-orange-300 hover:bg-orange-50/50'}`}
                 >
                   <span className={`text-sm font-bold mb-1 ${char.votes > 0 ? 'text-slate-700' : 'text-slate-500 group-hover:text-orange-700'}`}>{char.tag}</span>
                   <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${char.votes > 0 ? 'text-orange-500 bg-orange-100 group-hover:bg-orange-200' : 'text-slate-400 bg-slate-100 group-hover:text-orange-600 group-hover:bg-orange-200'}`}>
                     {char.votes > 0 ? `+${char.votes}` : 'Vote'}
                   </span>
                 </button>
               ));
            })()}
          </div>
          <div className="mt-2">
             <input 
               type="text" 
               onKeyDown={async (e) => {
                 if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                   const suggestValue = e.currentTarget.value.trim();
                   const change = await executeWithVotePower('traits', suggestValue, `Suggested trait: ${suggestValue}!`);
                   if (change === 1) {
                     e.currentTarget.value = '';
                     setCat(prev => {
                       if (!prev) return prev;
                       const chars = prev.characteristics || [];
                       return { ...prev, characteristics: [...chars, { tag: suggestValue, votes: 1 }] };
                     });
                   }
                 }
               }}
               placeholder="Add a trait (e.g., Friendly, Vocal)..."
               className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-500 focus:bg-white transition-colors"
             />
          </div>
        </div>

        {/* Check-In Gallery */}
        <div id="gallery-section" className="bg-slate-900 rounded-3xl p-5 border border-slate-800">
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Check-in Gallery</h3>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">{cat.gallery?.length || 0} Photos</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3].map(v => (
                  <span key={v} className={`text-[10px] ${v > (3 - votesSpentGallery) ? 'opacity-20' : 'text-orange-500'}`}>⚡</span>
                ))}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {cat.imageUrl && !(cat.gallery || []).find(g => g.url === cat.imageUrl) && (
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-800">
                <img src={cat.imageUrl} className="w-full h-full object-cover" />
                <div className="absolute bottom-2 right-2 flex gap-1">
                  <button 
                    onClick={() => executeWithVotePower('gallery', 'main', 'You voted for this photo!')}
                    className={`bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 transition-colors ${votedGallery.includes('main') ? 'text-orange-400 ring-1 ring-orange-500 border border-orange-500' : 'hover:bg-orange-500'}`}>
                    ♥️ {Math.floor(Math.random() * 20) + 5}
                  </button>
                </div>
              </div>
            )}
            
            {cat.gallery && cat.gallery.length > 0 ? (
              [...cat.gallery].sort((a,b) => b.votes - a.votes).slice(0, 3).map((photo, index) => (
                <div key={photo.id} onClick={() => { setViewerIndex(index); setIsGalleryOpen(true); }} className={`relative aspect-square rounded-2xl overflow-hidden bg-slate-800 cursor-pointer ${votedGallery.includes(photo.id) ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-slate-900' : ''}`}>
                  <img src={photo.url} className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        const change = await executeWithVotePower('gallery', photo.id, 'You voted for this photo!');
                        if (change !== 0 && cat) {
                          setCat(prev => {
                            if (!prev) return prev;
                            const gal = prev.gallery || [];
                            return { ...prev, gallery: gal.map(g => g.id === photo.id ? { ...g, votes: Math.max(0, g.votes + change) } : g) };
                          });
                        }
                      }}
                      className="bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 hover:bg-orange-500 transition-colors">
                      ♥️ {photo.votes}
                    </button>
                  </div>
                </div>
              ))
            ) : (
                null
            )}
            {cat.gallery && cat.gallery.length > 3 && (
                 <div onClick={() => { setViewerIndex(3); setIsGalleryOpen(true); }} className="relative aspect-square rounded-2xl overflow-hidden bg-slate-800 flex items-center justify-center cursor-pointer hover:bg-slate-700 transition-colors">
                    <span className="text-white font-bold">+{cat.gallery.length - 3}</span>
                 </div>
            )}
            {!cat.imageUrl && (!cat.gallery || cat.gallery.length === 0) && (
                <div className="col-span-2 py-6 text-center text-sm font-medium text-slate-500 italic">
                  No check-in photos yet. Be the first!
                </div>
            )}
          </div>
        </div>



      </div>

      {/* Camera Mode Overlay */}
      {isCheckInOpen && reportStep === 'camera' && (
         <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center animate-in zoom-in-95">
            {/* @ts-ignore */}
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="absolute inset-0 w-full h-full object-cover"
            />
            
            {/* Header */}
            <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
              <h2 className="text-white font-black text-xl tracking-tight">Focus on Straykin</h2>
              <button onClick={() => setIsCheckInOpen(false)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur">
                 <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Capture button */}
            <div className="absolute bottom-0 inset-x-0 p-8 flex justify-center items-end bg-gradient-to-t from-black/80 via-black/40 to-transparent">
               <button 
                 onClick={(e) => { e.preventDefault(); if (!checkInLoading) captureWebcam(); }}
                 disabled={checkInLoading}
                 className={`w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl transition-transform border-[6px] border-orange-500/50 ${checkInLoading ? 'opacity-50' : 'active:scale-95'}`}
               >
                 {checkInLoading && <div className="w-6 h-6 border-4 border-slate-800 border-r-transparent rounded-full animate-spin"></div>}
               </button>
            </div>
         </div>
      )}

      {/* Floating Check-In Button / Container */}
      <div className="fixed sm:absolute bottom-0 inset-x-0 p-4 z-50 pointer-events-none flex justify-center">
        {!isCheckInOpen ? (
          <button 
            onClick={() => { setIsCheckInOpen(true); setReportStep('camera'); setPhotoAttempts(0); setPhotoDataUrl(null); }}
            className="w-full max-w-sm py-4 rounded-full bg-orange-500 text-white font-black text-lg shadow-[0_10px_30px_rgba(249,115,22,0.4)] pointer-events-auto hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-6 h-6" />
            Check In Straykin
          </button>
        ) : reportStep === 'form' ? (
          <div className="w-full bg-slate-900 rounded-[2rem] p-6 shadow-2xl pointer-events-auto border border-slate-800 animate-in slide-in-from-bottom-8 fade-in duration-300">
             <div className="flex justify-between items-center mb-5">
               <h2 className="text-xl font-black text-white">Spotted today?</h2>
               <button 
                 onClick={() => setIsCheckInOpen(false)}
                 className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold hover:bg-slate-700 hover:text-white"
               >
                 ✕
               </button>
             </div>
             
             <div className="space-y-4">
              <div>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2.5">Take a Photo</p>
                 <div className="relative w-full h-40 rounded-2xl overflow-hidden bg-slate-800 border-2 border-slate-700 flex flex-col group">
                    {photoDataUrl ? (
                       <>
                         <img src={photoDataUrl} className="w-full h-full object-cover" />
                         <button 
                            onClick={(e) => { e.preventDefault(); setPhotoDataUrl(null); setReportStep('camera'); }}
                            className="absolute top-2 right-2 bg-black/60 backdrop-blur text-white text-xs font-bold px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                         >
                            Retake
                         </button>
                       </>
                    ) : (
                       <button 
                         onClick={() => setReportStep('camera')}
                         className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-orange-500 transition-colors"
                       >
                         <div className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center">
                            <Plus className="w-5 h-5" />
                         </div>
                         <span className="text-sm font-bold">Open Camera</span>
                       </button>
                    )}
                 </div>
                 {photoDataUrl && (
                    <div className="flex flex-col mt-3 px-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-300">Add to Gallery</span>
                        <button 
                          onClick={() => {
                            if (!user || user.isAnonymous || !user.emailVerified) {
                               setShowLoginModal(true);
                               return;
                            }
                            setAddToGallery(!addToGallery);
                          }}
                          className={`w-12 h-6 rounded-full relative transition-colors ${(addToGallery && !user?.isAnonymous && user?.emailVerified) ? 'bg-orange-500' : 'bg-slate-600'} ${(!user || user.isAnonymous || !user.emailVerified) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className={`absolute top-1 bottom-1 w-4 bg-white rounded-full transition-all ${(addToGallery && !user?.isAnonymous && user?.emailVerified) ? 'left-7' : 'left-1'}`}></span>
                        </button>
                      </div>
                      {(!user || user.isAnonymous || !user.emailVerified) && (
                        <p className="text-[10px] text-slate-500 mt-1">Register and verify email to post photos to the community gallery.</p>
                      )}
                    </div>
                 )}
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2.5">Feed Status</p>
                <div className="flex">
                  <button 
                    onClick={() => setWasFed(wasFed === true ? null : true)}
                    className={`w-full py-4 rounded-2xl text-sm font-bold flex justify-center items-center gap-2 transition-all ${wasFed === true ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                  >
                    I Fed the Straykin
                    {wasFed === true && <Check className="w-5 h-5 border-2 border-white rounded-md" />}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2.5">Health condition</p>
                <div className="flex flex-col gap-2">
                  {['Healthy', 'Injured', 'Needs Attention'].map(status => (
                    <button 
                      key={status}
                      onClick={() => setHealthStatus(status)}
                      className={`w-full py-3.5 px-5 rounded-2xl text-sm font-bold text-left flex justify-between items-center transition-all ${healthStatus === status ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {status}
                      {healthStatus === status && <Check className="w-5 h-5 border-2 border-white rounded-md" />}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleCheckIn}
                disabled={checkInLoading}
                className="w-full py-4 mt-2 rounded-2xl bg-white text-orange-600 font-black active:scale-95 transition-all text-sm disabled:opacity-70 disabled:active:scale-100 shadow-lg"
              >
                {checkInLoading ? 'Working...' : 'Submit Check-In'}
              </button>
             </div>
          </div>
        ) : null}
      </div>

      {/* Login Prompt Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-white mb-2">{(!user || user.isAnonymous) ? 'Login Required' : 'Verification Required'}</h2>
            <p className="text-slate-400 text-sm mb-6">{(!user || user.isAnonymous) ? 'You need to be logged in to use your vote power and check-in kittens.' : 'Please verify your email address to use this feature. Go to Account > Resend Verification.'}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowLoginModal(false)}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700 transition-colors"
              >
                Maybe later
              </button>
              <button 
                onClick={async () => {
                  setShowLoginModal(false);
                  if (!user || user.isAnonymous) {
                     navigate('/login');
                  } else {
                     navigate('/account');
                  }
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20"
              >
                {(!user || user.isAnonymous) ? 'Login' : 'My Account'}
              </button>
            </div>
          </div>
        </div>
      )}

        {/* Details Submission Modal */}
        {isDetailsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
             <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
               <h2 className="text-xl font-black text-white mb-2">Update Details</h2>
               <p className="text-slate-400 text-sm mb-6">Verified members can contribute details.</p>
               <div className="flex flex-col gap-2 mb-4">
                  <input type="text" placeholder="Color (e.g., Orange)" value={sightingColor} onChange={e => setSightingColor(e.target.value)} className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm placeholder-slate-500" />
                  <input type="text" placeholder="Type (e.g., Persian)" value={sightingType} onChange={e => setSightingType(e.target.value)} className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm placeholder-slate-500" />
                  <div className="flex gap-2">
                    <button onClick={() => setSightingNeutered(true)} className={`flex-1 py-3 rounded-xl text-sm font-bold ${sightingNeutered === true ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300'}`}>Neutered</button>
                    <button onClick={() => setSightingNeutered(false)} className={`flex-1 py-3 rounded-xl text-sm font-bold ${sightingNeutered === false ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300'}`}>Not Neutered</button>
                  </div>
               </div>
               <div className="flex gap-3">
                 <button onClick={() => setIsDetailsOpen(false)} className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700">Cancel</button>
                 <button onClick={() => {
                   // Mock badge check
                   alert("Details submitted for community verification!");
                   setCat(prev => prev ? { ...prev, color: sightingColor, strayType: sightingType, isNeutered: sightingNeutered ?? prev.isNeutered } : prev);
                   setSightingColor('');
                   setSightingType('');
                   setSightingNeutered(null);
                   setIsDetailsOpen(false);
                 }} className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-bold text-sm shadow-lg shadow-orange-500/20 hover:bg-orange-600">Submit</button>
               </div>
             </div>
          </div>
        )}

      {/* Fullscreen Gallery Overlay */}
      {isGalleryOpen && (
        <div className="fixed inset-0 z-[60] bg-black text-white flex flex-col w-full">
          <div className="sticky top-0 bg-black/80 backdrop-blur-md p-4 flex justify-between items-center z-10">
            <h2 className="text-xl font-black">{viewerIndex === null ? 'Gallery' : 'Photo Detail'}</h2>
            <button 
              onClick={() => {viewerIndex === null ? setIsGalleryOpen(false) : setViewerIndex(null)}}
              className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold hover:bg-slate-700 transition-colors"
            >
              {viewerIndex === null ? '✕' : '←'}
            </button>
          </div>
          <div className="flex-1 w-full overflow-hidden relative">
            {viewerIndex === null ? (
              <div className="grid grid-cols-3 gap-2 overflow-y-auto p-2">
                  {cat.gallery && [...cat.gallery].sort((a,b) => b.votes - a.votes).map((photo, i) => (
                    <img key={photo.id} src={photo.url} onClick={() => setViewerIndex(i)} className="aspect-square object-cover rounded-xl cursor-pointer" />
                  ))}
              </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center relative">
                  <AnimatePresence mode="wait">
                    <motion.div
                       key={viewerIndex}
                       drag="x"
                       dragConstraints={{ left: 0, right: 0 }}
                       onDragEnd={(event, info) => {
                          const gallery = [...(cat.gallery || [])].sort((a,b) => b.votes - a.votes);
                          if (info.offset.x > 50 && viewerIndex > 0) setViewerIndex(viewerIndex - 1);
                          else if (info.offset.x < -50 && viewerIndex < gallery.length - 1) setViewerIndex(viewerIndex + 1);
                       }}
                       initial={{ opacity: 0, x: 50 }}
                       animate={{ opacity: 1, x: 0 }}
                       exit={{ opacity: 0, x: -50 }}
                       className="w-full h-full flex items-center justify-center"
                    >
                      <img src={[...cat.gallery || []].sort((a,b) => b.votes - a.votes)[viewerIndex].url} className="w-full rounded-2xl p-2" />
                    </motion.div>
                  </AnimatePresence>
                  <button 
                      onClick={async () => {
                          const photo = [...cat.gallery || []].sort((a,b) => b.votes - a.votes)[viewerIndex!];
                          const change = await executeWithVotePower('gallery', photo.id, 'You voted for this photo!');
                          if (change !== 0 && cat) {
                            setCat(prev => {
                              if (!prev) return prev;
                              const gal = prev.gallery || [];
                              return { ...prev, gallery: gal.map(g => g.id === photo.id ? { ...g, votes: Math.max(0, g.votes + change) } : g) };
                            });
                          }
                      }}
                      className={`absolute bottom-6 right-6 backdrop-blur-md text-white font-bold px-6 py-3 rounded-full flex items-center gap-2 transition-colors ${votedGallery.includes([...cat.gallery || []].sort((a,b) => b.votes - a.votes)[viewerIndex!].id) ? 'bg-orange-500/80 ring-2 ring-orange-400' : 'bg-black/50 hover:bg-black/80'}`}>
                      ♥️ {([...cat.gallery || []].sort((a,b) => b.votes - a.votes)[viewerIndex!]).votes}
                  </button>
                </div>
            )}
          </div>
        </div>
      )}

      {/* Share Modal */}
      {isShareOpen && (
        <div className="fixed inset-0 z-[70] bg-black text-white flex flex-col justify-center items-center px-4 py-8">
           <div className="w-full max-w-sm flex justify-between items-center mb-6">
             <h2 className="text-xl font-black">Share Sighting</h2>
             <button onClick={() => setIsShareOpen(false)} className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold">✕</button>
           </div>
           
           <div className="w-full max-w-sm aspect-[9/16] bg-slate-900 rounded-[2.5rem] overflow-hidden relative shadow-2xl border border-slate-800 flex flex-col">
             <img src={photoDataUrl || cat.imageUrl} className="w-full h-3/5 object-cover" />
             <div className="flex-1 bg-gradient-to-b from-orange-500 to-orange-600 p-6 flex flex-col justify-between">
                <div>
                   <h3 className="text-4xl font-black text-white leading-none mb-2">{topName}</h3>
                   <div className="flex items-center gap-2 mb-2">
                     <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                     <p className="text-sm font-bold text-white/90">Spotted near me</p>
                   </div>
                   <p className="text-xs font-medium text-white/80">Has been fed by {
                     user?.isAnonymous 
                      ? `Pawtaker #${user.uid.substring(user.uid.length - 4)}`
                      : (userSettings.displayName || user?.displayName || 'A Kind Soul')
                   }</p>
                </div>
                
                <div className="flex justify-between items-end">
                   <button className="bg-white text-orange-600 px-6 py-3 rounded-full text-sm font-black shadow-lg">Try Now</button>
                   <div className="w-16 h-16 bg-white p-1 rounded-xl shadow-lg">
                      <div className="w-full h-full border-2 border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-bold text-center flex-col leading-tight">
                        <span>QR</span>
                        <span>Code</span>
                      </div>
                   </div>
                </div>
             </div>
           </div>
           
           <div className="w-full max-w-sm mt-8 flex gap-4">
             <button onClick={() => setIsShareOpen(false)} className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-black">Save Image</button>
             <button 
               onClick={async () => {
                 if (navigator.share) {
                   try {
                     await navigator.share({
                       title: `Spotted ${cat.name || 'a Straykin'}!`,
                       text: `Check out this Straykin on the map!`,
                       url: window.location.href
                     });
                   } catch(e) {}
                 } else {
                   alert("Sharing not supported on this browser.");
                 }
               }} 
               className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-black"
             >
               Share to App
             </button>
           </div>
        </div>
      )}

    </div>
  );
}
