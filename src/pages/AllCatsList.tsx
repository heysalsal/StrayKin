import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatDatabase } from '../hooks/useCatDatabase';
import { ChevronLeft } from 'lucide-react';
import { distanceBetween } from 'geofire-common';
import { AdBanner } from '../components/AdBanner';

export default function AllCatsList() {
  const navigate = useNavigate();
  const { cats } = useCatDatabase();

  const nearbyCats = useMemo(() => {
    const cached = sessionStorage.getItem('strayapp_pos');
    if (!cached) return cats.filter(cat => cat.status !== 'rejected');
    try {
      const pos = JSON.parse(cached);
      return cats.filter(cat => {
        if (cat.status === 'rejected') return false;
        const distMeters = distanceBetween([cat.lat, cat.lng], pos) * 1000;
        return distMeters <= 50;
      });
    } catch {
      return cats.filter(cat => cat.status !== 'rejected');
    }
  }, [cats]);

  return (
    <div className="relative h-full w-full font-sans bg-[#e5e7eb] flex flex-col overflow-hidden">
      <div className="bg-white px-5 pt-8 pb-4 shadow-sm relative z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-slate-700" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-800">Nearby Straykins</h1>
            <p className="text-xs text-slate-500 font-medium">Within 50 meters</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        {nearbyCats.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center pb-32">
            <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center text-5xl mb-4">😿</div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No Straykin Nearby</h3>
            <p className="text-sm text-slate-500 font-medium px-8">There are no Straykin within 50 meters of your location.<br/>Be the first to add them!</p>
          </div>
        ) : nearbyCats.map((cat, index) => (
          <React.Fragment key={cat.id}>
            <button 
              onClick={() => navigate(`/cat/${cat.id}`)}
              className="w-full text-left bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex gap-4 hover:bg-slate-50 transition-colors active:scale-95"
            >
              <div className="w-16 h-16 bg-slate-200 rounded-2xl overflow-hidden shrink-0">
                {cat.imageUrl ? (
                  <img src={cat.imageUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-orange-100 flex items-center justify-center text-2xl">🐈</div>
                )}
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider mb-0.5">{cat.animalType || 'Cat'}</span>
                    <h3 className="text-lg font-bold text-slate-800 leading-tight truncate">
                      {cat.name || `Straykin #${cat.id.slice(-4)}`}
                    </h3>
                  </div>
                  {cat.status === 'under_review' && (
                    <span className="shrink-0 bg-amber-100 text-amber-700 text-[10px] uppercase font-black px-2 py-0.5 rounded-full whitespace-nowrap">
                      Under Review
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Last check-in: {new Date((cat.last_check_in?.timestamp as any)?.seconds * 1000).toLocaleDateString() ?? 'Unknown'}
                </p>
              </div>
            </button>
            {(index + 1) % 3 === 0 && (
              <AdBanner format="banner" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
