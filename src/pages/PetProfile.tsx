import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Images, Settings, BellRing, MapPin, Search } from 'lucide-react';
import { useLazyAuth } from '../hooks/useLazyAuth';
import { motion, AnimatePresence } from 'motion/react';
import { AdBanner } from '../components/AdBanner';

export default function PetProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // using a mock pet object. In a real scenario we fetch the actual pet based on id.
  const [pet, setPet] = useState<any>(null);
  const [isDistanceFar, setIsDistanceFar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Using user profile to find our own pet to check if we are the owner
  const { user } = useLazyAuth();
  const [showInterstitial, setShowInterstitial] = useState(!user || user.isAnonymous);
  
  useEffect(() => {
    // Look in local storage for profile if we own this pet
    const p = localStorage.getItem('user_profile');
    let foundPet = null;
    let isOwner = false;
    
    if (p) {
      const parsed = JSON.parse(p);
      const userPet = parsed.pets?.find((pt: any) => pt.id === id);
      if (userPet) {
        foundPet = { ...userPet, isOwner: true, distanceKm: 0 };
        isOwner = true;
      }
    }
    
    if (!foundPet) {
      // Mock other user's public pet finding
      foundPet = {
         id,
         name: "Luna",
         breed: "Persian",
         color: "White",
         age: "2 years",
         gender: "Female",
         lastLocation: "-6.2088, 106.8456",
         photoDataUrl: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=500&h=500&fit=crop",
         isOwner: false,
         status: "public",
         gallery: [
           "https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=500&h=500&fit=crop",
           "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=500&h=500&fit=crop"
         ],
         distanceKm: Math.random() * 3 // Mock distance
      };
      if (foundPet.distanceKm > 1) {
        setIsDistanceFar(true);
      }
    }
    
    setPet(foundPet);
  }, [id]);

  const togglePublicStatus = () => {
    if (!pet?.isOwner) return;
    const newStatus = pet.status === 'public' ? 'private' : 'public';
    setPet({ ...pet, status: newStatus });
    
    const p = localStorage.getItem('user_profile');
    if (p) {
       const parsed = JSON.parse(p);
       const updatedPets = parsed.pets.map((pt:any) => pt.id === pet.id ? { ...pt, status: newStatus } : pt);
       localStorage.setItem('user_profile', JSON.stringify({...parsed, pets: updatedPets}));
    }
  };

  const handleAlertOwner = () => {
    alert("Notification sent to the owner!");
  };

  const topPhotos: string[] = [];
  if (pet) {
    if (pet.photoDataUrl) topPhotos.push(pet.photoDataUrl);
    if (pet.gallery) {
      pet.gallery.forEach((p: string) => {
         if (p !== pet.photoDataUrl) topPhotos.push(p);
      });
    }
  }
  const displayPhotos = topPhotos.slice(0, 5); // max 5

  useEffect(() => {
    if (displayPhotos.length > 1) {
      const timer = setInterval(() => {
        setCurrentImageIndex(prev => (prev < displayPhotos.length - 1 ? prev + 1 : 0));
      }, 7000);
      return () => clearInterval(timer);
    }
  }, [displayPhotos.length]);

  if (!pet) return <div className="h-full w-full bg-slate-50 flex items-center justify-center font-bold text-slate-500">Loading pet...</div>;

  const topName = pet.isOwner ? "My Pet" : "Pet Profile";

  return (
    <div className="relative h-full w-full font-sans bg-[#e5e7eb] flex flex-col overflow-y-auto">
      {showInterstitial && (
         <div className="absolute inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 slide-in-from-bottom-full animate-in duration-500">
           <button onClick={() => setShowInterstitial(false)} className="absolute top-6 right-6 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 hover:bg-slate-200">✕</button>
           <h2 className="text-2xl font-black text-slate-800 mb-2">Sponsor</h2>
           <p className="text-slate-500 text-sm font-medium text-center mb-8">Adsterra Advertisement</p>
           <AdBanner format="rectangle" />
           <button onClick={() => setShowInterstitial(false)} className="px-8 py-4 mt-8 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-200">
              Continue to {pet.name}
           </button>
         </div>
      )}
       
       <div className="relative w-full h-[60vh] shrink-0 bg-slate-800 rounded-b-[2.5rem] overflow-hidden shadow-2xl z-10 group">
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
                 alt={pet.name} 
                 onClick={() => { setViewerIndex(currentImageIndex); setIsGalleryOpen(true); }}
               />
             </AnimatePresence>
             
             {displayPhotos.length > 1 && (
               <div className="absolute top-24 inset-x-0 flex justify-center gap-1.5 z-20">
                 {displayPhotos.map((_, i) => (
                   <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentImageIndex ? 'bg-white w-6' : 'bg-white/50 w-2'}`} />
                 ))}
               </div>
             )}
           </>
         ) : (
           <div className="flex w-full h-full items-center justify-center text-8xl bg-orange-100">🐾</div>
         )}
         
         <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/60 to-transparent pt-6 flex justify-between items-start z-30">
           <div className="flex items-center gap-3">
             <button 
               onClick={() => navigate(-1)} 
               className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors"
             >
               <ChevronLeft className="w-7 h-7 -ml-0.5" />
             </button>
             <span className="text-white font-black text-xl drop-shadow-md">{topName}</span>
           </div>
           
           {pet.isOwner && (
             <div className="relative">
               <button 
                 onClick={() => setShowSettings(!showSettings)} 
                 className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors shadow-sm"
               >
                 <Settings className="w-6 h-6" />
               </button>
               {showSettings && (
                  <div className="absolute top-14 right-0 z-50 bg-white rounded-2xl shadow-xl w-64 p-4 animate-in fade-in zoom-in duration-200 origin-top-right border border-slate-100">
                     <h4 className="text-sm font-black text-slate-800 mb-3 border-b border-slate-100 pb-2">Settings</h4>
                     <div className="flex items-center justify-between">
                        <div>
                           <span className="text-sm font-bold text-slate-700 block">Public Profile</span>
                           <span className="text-[10px] text-slate-500">Visible on public maps</span>
                        </div>
                        <button 
                          onClick={togglePublicStatus}
                          className={`w-12 h-6 rounded-full p-1 relative transition-colors duration-300 ease-in-out focus:outline-none ${pet.status === 'public' ? 'bg-indigo-500' : 'bg-slate-300'}`}
                        >
                           <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ease-in-out ${pet.status === 'public' ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                     </div>
                  </div>
               )}
             </div>
           )}
         </div>

         <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-6 pb-8 pt-32 text-white pointer-events-none">
           <div className="flex items-end gap-3 pointer-events-auto">
             <h1 className="text-5xl font-black drop-shadow-md">{pet.name}</h1>
             <span className="text-2xl opacity-90 pb-1">{pet.gender === 'Male' ? '♂' : pet.gender === 'Female' ? '♀' : ''}</span>
           </div>
           <div className="flex flex-wrap items-center gap-2 mt-3 pointer-events-auto">
             <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white font-bold text-xs rounded-full border border-white/20 flex items-center gap-1.5 shadow-sm"><Search className="w-3 h-3 text-white/70" /> {pet.breed || "Unknown breed"}</span>
             <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white font-bold text-xs rounded-full border border-white/20 flex items-center gap-1.5 shadow-sm"><MapPin className="w-3 h-3 text-white/70" /> {pet.lastLocation || "Unknown Location"}</span>
           </div>
         </div>
       </div>

       <div className="relative z-10 flex-1 px-4 pb-20 pt-6">
          {pet.status === 'lost' && (
             <div className="mb-6 flex justify-center">
               <span className="px-5 py-2 bg-red-500 text-white font-black text-sm uppercase tracking-wider rounded-xl animate-pulse shadow-lg shadow-red-500/30">Missing Pet</span>
             </div>
          )}
          {!pet.isOwner && isDistanceFar && (
             <button onClick={handleAlertOwner} className="mb-6 w-full py-4 bg-red-500 text-white rounded-2xl font-black text-sm uppercase tracking-wide flex justify-center items-center gap-2 shadow-xl shadow-red-500/30 hover:bg-red-600 transition-colors active:scale-95">
                <BellRing className="w-5 h-5" />
                Alert Owner
             </button>
          )}

          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
             <h3 className="font-black text-slate-800 text-lg mb-4">Pet Details</h3>
             <ul className="divide-y divide-slate-100">
               <li className="py-3 flex justify-between items-center">
                 <span className="text-sm font-bold text-slate-500">Gender</span>
                 <span className="text-sm font-black text-slate-800">{pet.gender || 'Unknown'}</span>
               </li>
               <li className="py-3 flex justify-between items-center">
                 <span className="text-sm font-bold text-slate-500">Age</span>
                 <span className="text-sm font-black text-slate-800">{pet.age || 'Unknown'}</span>
               </li>
               <li className="py-3 flex justify-between items-center">
                 <span className="text-sm font-bold text-slate-500">Color</span>
                 <span className="text-sm font-black text-slate-800">{pet.color || 'Unknown'}</span>
               </li>
               <li className="py-3 flex justify-between items-center border-0">
                 <span className="text-sm font-bold text-slate-500">Status</span>
                 <span className="text-sm font-black text-slate-800 capitalize">{pet.status || 'Private'}</span>
               </li>
             </ul>
          </div>

          {/* Gallery Section */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 mt-6 relative overflow-hidden group">
             <div className="flex justify-between items-end mb-4">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-indigo-100 text-indigo-500 rounded-2xl flex items-center justify-center shrink-0">
                    <Images className="w-5 h-5" />
                 </div>
                 <div>
                    <h3 className="font-black text-slate-800 text-lg leading-tight">Gallery</h3>
                    <p className="text-xs font-bold text-slate-400">Photos of {pet.name}</p>
                 </div>
               </div>
               <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{pet.gallery?.length || 0} Photos</span>
             </div>
             <div className="grid grid-cols-2 gap-2 mt-4">
                {pet.gallery && pet.gallery.length > 0 ? (
                  pet.gallery.slice(0, 4).map((img: string, i: number) => (
                     <div key={i} onClick={() => { setViewerIndex(topPhotos.indexOf(img) > -1 ? topPhotos.indexOf(img) : i); setIsGalleryOpen(true); }} className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 cursor-pointer hover:opacity-90 transition-opacity">
                        <img src={img} className="w-full h-full object-cover" />
                     </div>
                  ))
                ) : (
                  <div className="col-span-2 py-8 text-center text-sm font-bold text-slate-400">
                    No additional photos.
                  </div>
                )}
             </div>
          </div>
       </div>

       {isGalleryOpen && (
        <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col w-full">
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
                  {topPhotos.slice(0, 10).map((photo, i) => (
                    <img key={i} src={photo} onClick={() => setViewerIndex(i)} className="aspect-square object-cover rounded-xl cursor-pointer hover:opacity-80 transition-opacity" />
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
                          if (info.offset.x > 50 && viewerIndex > 0) {
                             setViewerIndex(viewerIndex - 1);
                          } else if (info.offset.x < -50 && viewerIndex < Math.min(topPhotos.length, 10) - 1) {
                             setViewerIndex(viewerIndex + 1);
                          }
                       }}
                       initial={{ opacity: 0, x: 20 }}
                       animate={{ opacity: 1, x: 0 }}
                       exit={{ opacity: 0, x: -20 }}
                       transition={{ duration: 0.3 }}
                       className="w-full h-full flex flex-col justify-center items-center px-4 cursor-grab active:cursor-grabbing"
                    >
                      <img src={topPhotos[viewerIndex]} className="w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" />
                      <div className="mt-4 text-white font-bold opacity-80">{viewerIndex + 1} / {Math.min(topPhotos.length, 10)}</div>
                    </motion.div>
                  </AnimatePresence>
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

