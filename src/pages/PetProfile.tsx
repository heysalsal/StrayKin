import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Images, Settings, BellRing, MapPin, Search } from 'lucide-react';
import { useLazyAuth } from '../hooks/useLazyAuth';
import { motion } from 'motion/react';

export default function PetProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // using a mock pet object. In a real scenario we fetch the actual pet based on id.
  const [pet, setPet] = useState<any>(null);
  const [isDistanceFar, setIsDistanceFar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Using user profile to find our own pet to check if we are the owner
  const { user } = useLazyAuth();
  
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

  if (!pet) return <div className="h-full w-full bg-slate-50 flex items-center justify-center font-bold text-slate-500">Loading pet...</div>;

  return (
    <div className="relative h-full w-full font-sans bg-[#e5e7eb] flex flex-col overflow-hidden">
       {/* Background Image / Placeholder */}
       <div className="absolute top-0 left-0 right-0 h-1/2 bg-slate-200 z-0 overflow-hidden">
         {pet.photoDataUrl ? (
           <img src={pet.photoDataUrl} className="w-full h-full object-cover opacity-90 blur-[2px] scale-105" />
         ) : (
           <div className="w-full h-full flex items-center justify-center text-8xl">🐾</div>
         )}
         <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-[#e5e7eb]/100"></div>
       </div>

       {/* Top Bar */}
       <div className="relative z-10 flex justify-between items-start p-6">
         <button onClick={() => navigate(-1)} className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors shadow-sm">
           <ChevronLeft className="w-7 h-7" />
         </button>
         {pet.isOwner && (
           <button onClick={() => setShowSettings(!showSettings)} className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors shadow-sm relative">
             <Settings className="w-6 h-6" />
           </button>
         )}
       </div>

       {pet.isOwner && showSettings && (
          <div className="absolute top-20 right-6 z-20 bg-white rounded-2xl shadow-xl w-64 p-4 animate-in fade-in zoom-in duration-200 origin-top-right border border-slate-100">
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

       <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-20">
         <div className="flex flex-col items-center -mt-10">
            <div className="w-36 h-36 bg-white rounded-[2rem] shadow-2xl p-2 rotate-[-4deg] hover:rotate-0 transition-transform duration-300">
              <div className="w-full h-full rounded-[1.5rem] overflow-hidden bg-slate-100 relative">
                 {pet.photoDataUrl ? (
                    <img src={pet.photoDataUrl} className="w-full h-full object-cover" />
                 ) : (
                    <span className="flex items-center justify-center h-full text-5xl">🐾</span>
                 )}
              </div>
            </div>
            <h1 className="text-4xl font-black text-slate-800 mt-4 drop-shadow-md text-center">{pet.name}</h1>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              <span className="px-3 py-1 bg-white text-slate-700 font-bold text-xs rounded-full shadow-sm border border-slate-100 flex items-center gap-1.5"><Search className="w-3 h-3 text-slate-400" /> {pet.breed || "Unknown breed"}</span>
              <span className="px-3 py-1 bg-white text-slate-700 font-bold text-xs rounded-full shadow-sm border border-slate-100 flex items-center gap-1.5"><MapPin className="w-3 h-3 text-slate-400" /> {pet.lastLocation || "Unknown Location"}</span>
            </div>
            {pet.status === 'lost' && (
               <span className="mt-3 px-4 py-1.5 bg-red-500 text-white font-black text-xs uppercase tracking-wider rounded-xl animate-pulse shadow-lg shadow-red-500/30">Missing</span>
            )}
            {!pet.isOwner && isDistanceFar && (
              <button onClick={handleAlertOwner} className="mt-6 px-6 py-3 bg-red-500 text-white rounded-full font-black text-sm uppercase tracking-wide flex items-center gap-2 shadow-lg shadow-red-500/30 hover:bg-red-600 transition-colors active:scale-95">
                 <BellRing className="w-4 h-4" />
                 Alert Owner (&gt;1km from home)
              </button>
            )}
         </div>

         <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 mt-8">
            <h3 className="font-black text-slate-800 text-lg mb-4">Pet Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Gender</span>
                <span className="font-black text-slate-800">{pet.gender || 'Unknown'}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Age</span>
                <span className="font-black text-slate-800">{pet.age || 'Unknown'}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Color</span>
                <span className="font-black text-slate-800">{pet.color || 'Unknown'}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Status</span>
                <span className="font-black text-slate-800 capitalize">{pet.status || 'Private'}</span>
              </div>
            </div>
         </div>

         {/* Gallery Section */}
         <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 mt-6 relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-4">
               <div className="w-10 h-10 bg-rose-100 text-rose-500 rounded-2xl flex items-center justify-center shrink-0">
                  <Images className="w-5 h-5" />
               </div>
               <div>
                  <h3 className="font-black text-slate-800 text-lg leading-tight">Gallery</h3>
                  <p className="text-xs font-bold text-slate-400">Photos of {pet.name}</p>
               </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-4 snap-x">
               {pet.gallery && pet.gallery.length > 0 ? (
                 pet.gallery.map((img: string, i: number) => (
                    <div key={i} className="w-48 h-48 rounded-2xl bg-slate-100 border border-slate-200 shrink-0 overflow-hidden snap-center">
                       <img src={img} className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
                    </div>
                 ))
               ) : (
                 <div className="w-full py-8 text-center text-sm font-bold text-slate-400">
                   No gallery images yet.
                 </div>
               )}
            </div>
         </div>
       </div>
    </div>
  );
}
