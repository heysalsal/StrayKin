import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useCatDatabase } from '../hooks/useCatDatabase';
import { useLazyAuth } from '../hooks/useLazyAuth';
import { geohashForLocation } from 'geofire-common';
import { Plus, AlertCircle, MapPin, List, X, User } from 'lucide-react';
import { mapConfig } from '../config/map';
import { CatRecord } from '../types';
import { CustomIcon } from './CustomIcon';

const isRecentlyFed = (cat: CatRecord) => {
  if (!cat.last_check_in?.timestamp) return false;
  
  // Handle both Firestore Timestamp objects and mocked timestamps
  const timestampMillis = (cat.last_check_in.timestamp as any).toMillis 
    ? (cat.last_check_in.timestamp as any).toMillis() 
    : (cat.last_check_in.timestamp as any).seconds * 1000;
      
  const now = Date.now();
  const hoursSince = (now - timestampMillis) / (1000 * 60 * 60);
  
  return cat.last_check_in.was_fed && hoursSince <= 12;
};

const createMarkerIcon = (isFedRecently: boolean, status: string | undefined) => {
  let colorClass = isFedRecently ? 'bg-emerald-500' : 'bg-orange-400';
  let innerText = '🐾';
  
  if (status === 'under_review') {
    colorClass = 'bg-amber-400';
    innerText = '⏳';
  }

  return L.divIcon({
    className: 'custom-cat-marker bg-transparent border-0',
    html: `<div class="relative flex flex-col items-center">
             <div class="w-10 h-10 ${colorClass} rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white text-lg">${innerText}</div>
           </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

function MapEvents() {
  const map = useMapEvents({
    moveend: () => {
      sessionStorage.setItem('map_center', JSON.stringify([map.getCenter().lat, map.getCenter().lng]));
      sessionStorage.setItem('map_zoom', map.getZoom().toString());
    }
  });
  return null;
}

function LocateControl({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position && !sessionStorage.getItem('map_center')) {
      map.flyTo(position, 20);
    }
  }, [position, map]);
  return null;
}

function RecenterAction({ counter, position }: { counter: number, position: [number, number] | null }) {
  const map = useMap();
  const prevCounter = useRef(counter);
  useEffect(() => {
    if (counter > prevCounter.current && position) {
      map.flyTo(position, 20);
      prevCounter.current = counter;
    }
  }, [counter, position, map]);
  return null;
}

import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';

export default function MapView() {
  const navigate = useNavigate();
  // Initialize from sessionStorage if possible
  const [position, setPosition] = useState<[number, number] | null>(() => {
    const cached = sessionStorage.getItem('strayapp_pos');
    return cached ? JSON.parse(cached) : null;
  });
  const [recenterCounter, setRecenterCounter] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'scan' | 'form'>('scan');
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  
  const [duplicates, setDuplicates] = useState<CatRecord[]>([]);
  const [sightingPos, setSightingPos] = useState<[number, number] | null>(null);
  
  // Form State
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [reportStep, setReportStep] = useState<'camera' | 'form'>('camera');
  const [photoAttempts, setPhotoAttempts] = useState(0);
  const webcamRef = useRef<Webcam>(null);
  const [nameInput, setNameInput] = useState('');
  const [genderInput, setGenderInput] = useState<'Male' | 'Female' | 'Unknown'>('Unknown');
  const [activities, setActivities] = useState<string[]>([]);
  const [showAdditional, setShowAdditional] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState('');
  const [addToGallery, setAddToGallery] = useState(true);
  
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { cats, logNewSighting, updateCatSighting, seedMockArea, fetchNearbyCats } = useCatDatabase();
  const { user, upgradeToGoogleAccount } = useLazyAuth();

  const [userSettings, setUserSettings] = useState({ displayName: '', isAnonymous: false });
  useEffect(() => {
    const saved = localStorage.getItem('user_settings');
    if (saved) setUserSettings(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setPosition(newPos);
          sessionStorage.setItem('strayapp_pos', JSON.stringify(newPos));
          seedMockArea(newPos[0], newPos[1]);
        },
        (err) => {
          console.error("GPS error", err);
          if (!position) {
             const defaultLoc = [51.505, -0.09] as [number, number];
             setPosition(defaultLoc);
             seedMockArea(defaultLoc[0], defaultLoc[1]);
          }
        },
        { enableHighAccuracy: true }
      );
    } else if (!position) {
      const defaultLoc = [51.505, -0.09] as [number, number];
      setPosition(defaultLoc);
      seedMockArea(defaultLoc[0], defaultLoc[1]);
    }
  }, []);

  const handleLogSightingClick = async () => {
    if (!user || user.isAnonymous) {
      try {
        await upgradeToGoogleAccount();
      } catch (e) {
        console.warn("Google upgrade failed or cancelled");
      }
    }
    
    if (position) {
       setSightingPos(position);
       setActivities([]);
       setPhotoDataUrl(null);
       setShowAdditional(false);
       setTags([]);
       setTagInput('');
       setNotes('');
       setNameInput('');
       setGenderInput('Unknown');
       setSelectedCatId(null);
       
       const nearby = await fetchNearbyCats(position[0], position[1], 50);
       setDuplicates(nearby);
       setCurrentIdx(0);
       setModalStep('scan');
       setIsModalOpen(true);
    } else {
       alert("Waiting for GPS location...");
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotoDataUrl(ev.target?.result as string);
        setIsCameraActive(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const captureWebcam = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setPhotoDataUrl(imageSrc);
      setIsCameraActive(false);
      setReportStep('form');
    }
  }, [webcamRef]);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      const val = tagInput.trim();
      if (val && !tags.includes(val)) setTags([...tags, val]);
      setTagInput('');
    }
  };

  const confirmSighting = async () => {
    if (!sightingPos) return;

    if (!photoDataUrl) {
      alert("A photo is required to submit a sighting.");
      return;
    }

    setIsSubmitting(true);

    const [lat, lng] = sightingPos;
    const geohash = geohashForLocation([lat, lng]);
    
    const details = selectedCatId ? {
      catId: selectedCatId,
      wasFed: activities.includes('Feed'),
      activities,
      tags,
      notes,
    } : {
      name: nameInput,
      gender: genderInput,
      wasFed: activities.includes('Feed'),
      activities,
      tags,
      notes,
    };

    const submissionId = `sighting_${Date.now()}`;
    const reqBody = {
      id: submissionId,
      type: selectedCatId ? 'check_in' : 'sighting',
      details,
      imageBase64: photoDataUrl
    };

    try {
      await fetch('/api/submit-for-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody)
      });
      alert('Sighting submitted and is under review!');
      
      // Save locally to show in list as under review
      if (selectedCatId) {
        await updateCatSighting(selectedCatId, {
          ...details,
          photoDataUrl,
          status: 'under_review',
          submissionId
        });
      } else {
        const res = await logNewSighting(lat, lng, geohash, {
          ...details,
          photoDataUrl,
          status: 'under_review',
          submissionId
        }, true);
        if (res.status === 'created') {
          setSelectedCatId(res.id);
        }
      }
      
      setIsModalOpen(false);
      setIsShareOpen(true);
    } catch (err) {
      console.error('Failed to submit:', err);
      // Offline fallback
      if (selectedCatId) {
        await updateCatSighting(selectedCatId, { ...details, photoDataUrl });
      } else {
        const res = await logNewSighting(lat, lng, geohash, { ...details, photoDataUrl }, true);
        if (res.status === 'created') setSelectedCatId(res.id);
      }
      alert('Submitted (offline preview mode).');
      setIsModalOpen(false);
      setIsShareOpen(true);
    }
    
    setIsSubmitting(false);
  };

  if (!position) return <div className="flex h-full items-center justify-center p-4 text-center text-slate-500 font-medium">Loading your location...</div>;

  const savedCenterStr = sessionStorage.getItem('map_center');
  const savedZoomStr = sessionStorage.getItem('map_zoom');
  const initialCenter = savedCenterStr ? JSON.parse(savedCenterStr) : position;
  const initialZoom = savedZoomStr ? parseFloat(savedZoomStr) : mapConfig.defaultZoom;

  return (
    <div className="relative h-full w-full font-sans bg-[#e5e7eb]">
      <MapContainer center={initialCenter} zoom={initialZoom} maxZoom={20} zoomControl={false} className="absolute inset-0 z-0">
        <MapEvents />
        <TileLayer
          attribution={mapConfig.attribution}
          url={mapConfig.tileUrl}
          maxNativeZoom={19}
          maxZoom={20}
        />
        <LocateControl position={position} />
        <RecenterAction counter={recenterCounter} position={position} />
        
        {/* User Marker */}
        <Marker position={position} icon={L.divIcon({
            className: 'user-marker bg-transparent border-0',
            html: `<div class="relative flex flex-col items-center">
                     <div class="w-12 h-12 bg-white text-orange-500 rounded-full border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.15)] flex items-center justify-center pointer-events-auto">
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                     </div>
                   </div>`,
            iconSize: [48, 48],
            iconAnchor: [24, 24],
        })} />

        {cats.filter(cat => cat.status !== 'rejected').map((cat) => (
          <Marker 
            key={cat.id} 
            position={[cat.lat, cat.lng]} 
            icon={createMarkerIcon(isRecentlyFed(cat), cat.status)}
          >
            <Popup>
               <div className="font-sans flex items-center gap-3 w-48 min-w-0" style={{ margin: '-4px' }}>
                  <div onClick={() => navigate(`/cat/${cat.id}`)} className="w-[3.25rem] h-[3.25rem] rounded-xl overflow-hidden shadow-inner bg-slate-100 shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                    {cat.imageUrl ? <img src={cat.imageUrl} className="w-full h-full object-cover" /> : <span className="flex items-center justify-center h-full text-2xl">😿</span>}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-start justify-between gap-1 mb-0.5">
                      <h3 className="font-black text-slate-800 text-[13px] leading-tight truncate">{cat.name || `Straykin #${cat.id.slice(-4)}`}</h3>
                      {cat.status === 'under_review' && <span className="bg-amber-100 text-amber-700 text-[8px] uppercase font-black px-1.5 py-0.5 rounded-full shrink-0 mt-0.5">Review</span>}
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold truncate">
                      Seen: {cat.last_check_in?.timestamp ? new Date((cat.last_check_in.timestamp as any).seconds ? (cat.last_check_in.timestamp as any).seconds * 1000 : (cat.last_check_in.timestamp as any).toMillis?.() || Date.now()).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
               </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* No Cats Warning Box */}
      {cats.length === 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-slate-100 flex items-center justify-center pointer-events-none fade-in animate-in duration-500">
           <span className="text-sm font-bold text-slate-700">There are no Straykin nearby. Please add them!</span>
        </div>
      )}

      {/* Guest Login Banner */}
      {(!user || user.isAnonymous) && !isMenuOpen && (
        <div className="absolute left-6 right-[6rem] bottom-8 z-10 animate-bounce">
          <div className="bg-orange-500 border border-orange-400 text-white rounded-2xl p-4 shadow-[0_8px_30px_rgb(249,115,22,0.3)] flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[3.5rem]">
             <div className="flex-1">
               <p className="text-[11px] font-black leading-tight text-white mb-0.5">Not registered?</p>
               <p className="text-[10px] font-medium text-orange-100 leading-tight">Login to save your progress</p>
             </div>
             <button onClick={() => navigate('/login')} className="text-xs font-black bg-white text-orange-600 rounded-xl px-4 py-2 hover:bg-orange-50 transition-colors shadow-sm active:scale-95 whitespace-nowrap self-stretch flex items-center">
               Log In
             </button>
          </div>
        </div>
      )}

      {/* Expandable FAB Menu */}
      <div className="absolute bottom-8 right-8 z-10 flex flex-col items-end gap-3 pointer-events-none">
        {isMenuOpen && (
          <div className="flex flex-col items-end gap-3 animate-in slide-in-from-bottom-2 fade-in zoom-in duration-200 pointer-events-auto">
            <button 
              onClick={() => { setIsMenuOpen(false); navigate('/account'); }}
              className="flex items-center gap-3 bg-white text-slate-800 px-5 py-3.5 rounded-[2rem] shadow-xl border border-slate-100 hover:bg-slate-50 transition-all active:scale-95 group"
            >
              <span className="font-bold text-sm tracking-wide">Account</span>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-slate-200 transition-colors">
                <CustomIcon src="/icon-account.png" FallbackIcon={User} className="w-4 h-4" />
              </div>
            </button>
            <button 
              onClick={() => { setIsMenuOpen(false); navigate('/cats'); }}
              className="flex items-center gap-3 bg-white text-slate-800 px-5 py-3.5 rounded-[2rem] shadow-xl border border-slate-100 hover:bg-slate-50 transition-all active:scale-95 group"
            >
              <span className="font-bold text-sm tracking-wide">Nearby</span>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-slate-200 transition-colors">
                <CustomIcon src="/icon-cats.png" FallbackIcon={List} className="w-4 h-4" />
              </div>
            </button>
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                e.preventDefault(); 
                setIsMenuOpen(false); 
                setRecenterCounter(c => c + 1); 
              }}
              className="flex items-center gap-3 bg-white text-slate-800 px-5 py-3.5 rounded-[2rem] shadow-xl border border-slate-100 hover:bg-slate-50 transition-all active:scale-95 group"
            >
              <span className="font-bold text-sm tracking-wide">Recenter</span>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-slate-200 transition-colors">
                <CustomIcon src="/icon-recenter.png" FallbackIcon={MapPin} className="w-4 h-4" />
              </div>
            </button>
            <button 
              onClick={() => { setIsMenuOpen(false); handleLogSightingClick(); }}
              className="flex items-center gap-3 bg-orange-500 text-white px-5 py-3.5 rounded-[2rem] shadow-xl shadow-orange-200 border border-transparent hover:bg-orange-600 transition-all active:scale-95 group"
            >
              <span className="font-bold text-sm tracking-wide">Find Stray</span>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors overflow-hidden">
                <CustomIcon src="/icon-find.png" FallbackIcon={Plus} className="w-5 h-5 text-white" />
              </div>
            </button>
          </div>
        )}
        
        <div className="pointer-events-auto flex flex-col gap-3">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`w-14 h-14 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.15)] border border-white flex items-center justify-center transition-all duration-300 active:scale-90 ${isMenuOpen ? 'bg-orange-600 text-white rotate-45' : 'bg-orange-500 text-white'}`}
          >
            <CustomIcon src="/icon-menu.png" FallbackIcon={Plus} className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40" onClick={() => { setIsModalOpen(false); setDuplicates([]); }}></div>
          
          {modalStep === 'form' && reportStep === 'camera' ? (
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
                  <button onClick={() => { setIsModalOpen(false); setDuplicates([]); }} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur">
                     <X className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Capture button */}
                <div className="absolute bottom-0 inset-x-0 p-8 flex justify-center items-end bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                   <button 
                     onClick={(e) => { e.preventDefault(); if (!isSubmitting) captureWebcam(); }}
                     disabled={isSubmitting}
                     className={`w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl transition-transform border-[6px] border-orange-500/50 ${isSubmitting ? 'opacity-50' : 'active:scale-95'}`}
                   >
                     {isSubmitting && <div className="w-6 h-6 border-4 border-slate-800 border-r-transparent rounded-full animate-spin"></div>}
                   </button>
                </div>
             </div>
          ) : (
            <div className="relative w-full max-w-[400px] bg-white rounded-[3rem] p-8 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-100 z-50 max-h-[90vh] overflow-y-auto">
               
               {modalStep === 'scan' ? (
                <>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-2xl font-black text-slate-800">Nearby Straykins</h2>
                      <p className="text-sm text-slate-500 font-medium">Is this who you saw?</p>
                    </div>
                    <button onClick={() => { setIsModalOpen(false); setDuplicates([]); }} className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  {duplicates.length > 0 && currentIdx < duplicates.length ? (
                    <>
                      <div className="relative w-full aspect-[4/5] bg-slate-100 rounded-3xl overflow-hidden mb-6 shadow-sm border border-slate-200">
                        {duplicates[currentIdx].imageUrl ? (
                          <img src={duplicates[currentIdx].imageUrl} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-6xl">🐈</div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pt-16 text-white">
                          <h3 className="text-2xl font-black">{duplicates[currentIdx].name || `Straykin #${duplicates[currentIdx].id.slice(-4)}`}</h3>
                          <p className="text-sm font-medium opacity-90 mt-1">Logged {duplicates[currentIdx].last_check_in?.was_fed ? 'as fed' : 'recently'}</p>
                        </div>
                      </div>

                      <div className="flex gap-3 mb-4">
                        <button 
                           onClick={() => setCurrentIdx(prev => prev + 1)}
                           className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
                        >
                           Nope
                        </button>
                        <button 
                           onClick={() => { setIsModalOpen(false); navigate(`/cat/${duplicates[currentIdx].id}`); }}
                           className="flex-1 py-4 rounded-2xl bg-orange-500 text-white font-bold shadow-lg shadow-orange-200 hover:bg-orange-600 transition-colors"
                        >
                           Yep!
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-10 mb-4 bg-slate-50 rounded-3xl border border-slate-100">
                      <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">😿</div>
                      <h3 className="font-bold text-slate-800 text-xl">No Straykin Nearby</h3>
                      <p className="text-sm text-slate-500 mt-1">There are no Straykin in this area.<br/>Please add them!</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 mt-4">
                    <button 
                      onClick={() => { setSelectedCatId(null); setModalStep('form'); }}
                      className={`w-full py-4 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2 ${duplicates.length > 0 && currentIdx < duplicates.length ? 'border border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-orange-500 text-white shadow-lg shadow-orange-200 hover:bg-orange-600'}`}
                    >
                      <CustomIcon src="/icon-submit.png" FallbackIcon={AlertCircle} className="w-5 h-5" />
                      Report New Straykin
                    </button>
                  </div>
                </>
             ) : (
                <>
                 <div className="flex justify-between items-start mb-6">
                   <div>
                     <h2 className="text-2xl font-black text-slate-800">Stray Sighting</h2>
                     <p className="text-sm text-slate-500 font-medium">{selectedCatId ? 'Update status for this straykin.' : 'Record a new community cat.'}</p>
                   </div>
                   <button onClick={() => { setIsModalOpen(false); setSelectedCatId(null); }} className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors shrink-0">
                      <X className="w-6 h-6" />
                   </button>
                 </div>
                 
                 <div className="space-y-6">
                   {selectedCatId && (() => {
                     const cat = cats.find(c => c.id === selectedCatId);
                     if (!cat) return null;
                     return (
                       <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                         <div className="w-16 h-16 bg-slate-200 rounded-2xl overflow-hidden shrink-0">
                           {cat.imageUrl ? <img src={cat.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-orange-100 flex items-center justify-center text-2xl">🐈</div>}
                         </div>
                         <div className="flex-1 flex flex-col justify-center">
                           <h3 className="text-lg font-bold text-slate-800 leading-tight">{cat.name || `Straykin #${cat.id.slice(-4)}`}</h3>
                           <p className="text-xs text-slate-500 font-medium mt-1">
                             Last seen: {new Date((cat.last_check_in?.timestamp as any)?.seconds * 1000).toLocaleDateString() ?? 'Unknown'}
                           </p>
                         </div>
                       </div>
                     );
                   })()}

                   {/* Photo Upload */}
                   <div className="relative w-full h-40 rounded-3xl overflow-hidden bg-slate-100 border border-slate-200 flex flex-col group">
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
                           className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-orange-500 hover:bg-slate-50 transition-colors"
                         >
                           <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                              <Plus className="w-5 h-5" />
                           </div>
                           <span className="text-sm font-bold">Open Camera</span>
                         </button>
                      )}
                   </div>

                   {photoDataUrl && selectedCatId && (
                      <div className="flex items-center justify-between mt-3 px-1">
                        <span className="text-sm font-bold text-slate-800">Add to Gallery</span>
                        <button 
                          onClick={() => setAddToGallery(!addToGallery)}
                          className={`w-12 h-6 rounded-full relative transition-colors ${addToGallery ? 'bg-orange-500' : 'bg-slate-300'}`}
                        >
                          <span className={`absolute top-1 bottom-1 w-4 bg-white rounded-full transition-all ${addToGallery ? 'left-7' : 'left-1'}`}></span>
                        </button>
                      </div>
                   )}

                   {/* Name Input (New Cat Only) */}
                   {!selectedCatId && (
                     <div className="space-y-4">
                       <div>
                         <p className="text-sm font-bold text-slate-800 mb-2">Name</p>
                         <input 
                            type="text" 
                            value={nameInput}
                            onChange={e => setNameInput(e.target.value)}
                            placeholder="What should we call them?"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-medium outline-none focus:border-orange-400 focus:bg-white transition-colors"
                         />
                       </div>
                       
                       <div>
                         <p className="text-sm font-bold text-slate-800 mb-2">Gender</p>
                         <select 
                           value={genderInput}
                           onChange={e => setGenderInput(e.target.value as any)}
                           className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-medium outline-none focus:border-orange-400 focus:bg-white transition-colors"
                         >
                            <option value="Unknown">Unknown</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                         </select>
                       </div>
                     </div>
                   )}

                   {/* Additional Information Toggle */}
                   <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100">
                      <button onClick={() => setShowAdditional(!showAdditional)} className="flex items-center justify-between w-full font-bold text-sm text-slate-800">
                        Add More Information
                        <Plus className={`w-5 h-5 transition-transform ${showAdditional ? 'rotate-45 text-orange-500' : 'text-slate-400'}`} />
                      </button>
                      
                      {showAdditional && (
                        <div className="mt-5 space-y-5 animate-in fade-in slide-in-from-top-2">
                          {/* Activities */}
                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2.5">Activities</p>
                            <div className="flex flex-wrap gap-2">
                              {['Feed', 'Stroke', 'Play'].map(act => (
                                 <button 
                                   key={act}
                                   onClick={() => setActivities(prev => prev.includes(act) ? prev.filter(a => a !== act) : [...prev, act])}
                                   className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors ${activities.includes(act) ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                 >
                                   {act}
                                 </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Characteristics Tags</p>
                            <div className="flex flex-wrap gap-2 mb-2">
                               {tags.map(tag => (
                                 <span key={tag} className="bg-slate-200 text-slate-700 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                                    {tag}
                                    <button onClick={() => setTags(tags.filter(t => t !== tag))} className="hover:text-red-500">&times;</button>
                                 </span>
                               ))}
                            </div>
                            <input 
                              type="text" 
                              value={tagInput}
                              onChange={e => setTagInput(e.target.value)}
                              onKeyDown={handleTagKeyDown}
                              placeholder="Type characteristic and press Space"
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 transition-colors"
                            />
                          </div>
                          
                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Notes</p>
                            <textarea 
                               value={notes}
                               onChange={e => setNotes(e.target.value)}
                               rows={2}
                               placeholder="Any additional comments..."
                               className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400 transition-colors resize-none"
                            ></textarea>
                          </div>
                        </div>
                      )}
                   </div>
                 </div>

                 <div className="flex mt-8">
                   <button 
                      onClick={confirmSighting}
                      disabled={isSubmitting}
                      className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 ${isSubmitting ? 'bg-orange-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 active:scale-[0.98]'} text-white font-bold shadow-xl shadow-orange-200 transition-all`}
                    >
                      {!isSubmitting && <CustomIcon src="/icon-submit.png" FallbackIcon={Plus} className="w-5 h-5" />}
                      {isSubmitting ? (photoDataUrl ? 'Submitting...' : 'Analyzing Image...') : 'Submit'}
                    </button>
                 </div>
                </>
             )}
            </div>
          )}
        </div>
      )}

      {/* Share Modal */}
      {isShareOpen && (
        <div className="fixed inset-0 z-[70] bg-black text-white flex flex-col justify-center items-center px-4 py-8">
           <div className="w-full max-w-sm flex justify-between items-center mb-6">
             <h2 className="text-xl font-black">Share Sighting</h2>
             <button onClick={() => setIsShareOpen(false)} className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold">✕</button>
           </div>
           
           <div id="share-card" className="w-full max-w-sm aspect-[9/16] bg-slate-900 rounded-[2.5rem] overflow-hidden relative shadow-2xl border border-slate-800 flex flex-col">
             <img src={photoDataUrl || (selectedCatId && cats.find(c => c.id === selectedCatId)?.imageUrl) || ''} className="w-full h-3/5 object-cover" />
             <div className="flex-1 bg-gradient-to-b from-orange-500 to-orange-600 p-6 flex flex-col justify-between">
                <div>
                   <h3 className="text-4xl font-black text-white leading-none mb-2">{nameInput || (selectedCatId ? cats.find(c => c.id === selectedCatId)?.name : 'Straykin')}</h3>
                   <div className="flex items-center gap-2 mb-2">
                     <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                     <p className="text-sm font-bold text-white/90">Spotted near me</p>
                   </div>
                   <p className="text-xs font-medium text-white/80">Has been fed by {
                     userSettings.isAnonymous 
                      ? (userSettings.displayName ? userSettings.displayName.slice(0, 2) + '*'.repeat(userSettings.displayName.length - 2) : 'Anonymous')
                      : (userSettings.displayName || 'A Kind Soul')
                   }</p>
                </div>
                
                <div className="flex justify-between items-end">
                   <div className="bg-white text-orange-600 px-6 py-3 rounded-full text-sm font-black shadow-lg flex items-center gap-2">
                     <img src="/logo.png" className="w-4 h-4 object-contain" />
                     <span>Straykin App</span>
                   </div>
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
             <button 
                onClick={async () => {
                  const node = document.getElementById('share-card');
                  if (node) {
                     const { toPng } = await import('html-to-image');
                     const download = (await import('downloadjs')).default;
                     try {
                        const dataUrl = await toPng(node, { quality: 0.95 });
                        download(dataUrl, 'straykin-sighting.png');
                     } catch (err) {
                        alert('Could not generate image');
                     }
                  }
                }} 
                className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-black"
             >
                Save Image
             </button>
             <button 
               onClick={async () => {
                 if (navigator.share) {
                   try {
                     await navigator.share({
                       title: `Spotted ${nameInput || (selectedCatId ? cats.find(c => c.id === selectedCatId)?.name : 'a Straykin')}!`,
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
