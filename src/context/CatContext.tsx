import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, query, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { distanceBetween } from 'geofire-common';
import { CatRecord } from '../types';

interface CatContextProps {
  cats: CatRecord[];
  loading: boolean;
  fetchNearbyCats: (lat: number, lng: number, radius?: number) => Promise<CatRecord[]>;
  logNewSighting: (lat: number, lng: number, geohash: string, details: any, forceCreate?: boolean) => Promise<any>;
  updateCatSighting: (catId: string, details: any) => Promise<any>;
  seedMockArea: (lat: number, lng: number) => void;
}

const CatContext = createContext<CatContextProps | undefined>(undefined);

export function CatProvider({ children }: { children: React.ReactNode }) {
  const [cats, setCats] = useState<CatRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        setLoading(true);
        const q = query(collection(db, 'strays'));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CatRecord[];
        
        if (data.length > 0) {
          setCats(data);
        } else {
          setCats([]);
        }
      } catch (e) {
        console.error("Failed to fetch from Firestore", e);
        setCats([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCats();
  }, []);

  useEffect(() => {
    let active = true;
    const pollStatuses = async () => {
      // Find cats that are under review using the latest state
      setCats(currentCats => {
        const pending = currentCats.filter(c => c.status === 'under_review' && c.submissionId);
        
        if (pending.length > 0) {
          // Do not do async fetches inside setCats updater.
          // Instead, kick off the fetches and let them update state when done.
          setTimeout(() => {
            pending.forEach(async (cat) => {
              if (!active) return;
              try {
                const res = await fetch(`/api/submission-status/${cat.submissionId}`);
                if (res.ok && active) {
                  const data = await res.json();
                  if (data.status === 'approved' || data.status === 'rejected') {
                    setCats(prev => prev.map(c => 
                      c.id === cat.id ? { ...c, status: data.status, ...(data.details?.photoDataUrl ? { imageUrl: data.details.photoDataUrl } : {}) } : c
                    ));
                    // Update firestore via updateCatSighting if the local state caught the approval
                    updateCatSighting(cat.id, { 
                      status: data.status, 
                      ...(data.details?.photoDataUrl ? { photoDataUrl: data.details.photoDataUrl } : {})
                    }).catch(() => {});
                  }
                } else if (res.status === 404) {
                   // Clean up lost submissions
                   setCats(prev => prev.map(c => 
                      c.id === cat.id ? { ...c, status: 'rejected' } : c
                   ));
                   updateCatSighting(cat.id, { status: 'rejected' }).catch(() => {});
                }
              } catch (e) {}
            });
          }, 0);
        }
        return currentCats;
      });
    };
    
    const interval = setInterval(pollStatuses, 3000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const findNearbyCats = async (lat: number, lng: number, radiusInM: number = 50) => {
    const center = [lat, lng] as [number, number];
    return cats.filter(cat => {
      const dist = distanceBetween([cat.lat, cat.lng], center) * 1000;
      return dist <= radiusInM;
    });
  };

  const logNewSighting = async (lat: number, lng: number, geohash: string, details: any, forceCreate: boolean = false) => {
    if (!forceCreate) {
      const nearby = await findNearbyCats(lat, lng, 50);
      if (nearby.length > 0) {
        return { duplicatesFound: nearby, status: 'duplicates_found' };
      }
    }

    try {
      const newCatData = {
         lat, lng, geohash,
         name: details.name || null,
         animalType: details.animalType || 'Cat',
         genderVotes: {
           male: details.gender === 'Male' ? 1 : 0,
           female: details.gender === 'Female' ? 1 : 0,
           unknown: details.gender === 'Unknown' ? 1 : 0,
         },
         imageUrl: details.photoDataUrl || null,
         status: details.status || 'under_review',
         submissionId: details.submissionId || null,
         submittedBy: details.submittedBy || null,
         characteristics: details.tags ? details.tags.map((t: string) => ({ tag: t, votes: 1 })) : [],
         last_check_in: {
            timestamp: serverTimestamp(),
            was_fed: details.wasFed || false,
            activities: details.activities || [],
            notes: details.notes || null
         }
      };
      const docRef = await addDoc(collection(db, 'strays'), newCatData);
      
      setCats(prev => [...prev, { id: docRef.id, ...newCatData } as any]);
      
      return { status: 'created', id: docRef.id };
    } catch(e) {
       console.error("Failed to add document", e);
       throw e;
    }
  };

  const updateCatSighting = async (catId: string, details: any) => {
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const docRef = doc(db, 'strays', catId);
      
      const updateData: any = {
        'last_check_in.timestamp': serverTimestamp(),
      };
      
      if (details.name) updateData.name = details.name;
      if (details.status) updateData.status = details.status;
      if (details.submissionId) updateData.submissionId = details.submissionId;
      if (details.photoDataUrl) updateData.imageUrl = details.photoDataUrl;
      if (details.wasFed !== undefined) updateData['last_check_in.was_fed'] = details.wasFed;
      if (details.activities) updateData['last_check_in.activities'] = details.activities;
      if (details.notes) updateData['last_check_in.notes'] = details.notes;

      await updateDoc(docRef, updateData);
      
      // Update local state smoothly
      setCats(prev => prev.map(c => 
        c.id === catId 
          ? { 
              ...c, 
              name: details.name || c.name,
              ...(details.status ? { status: details.status, submissionId: details.submissionId } : {}),
              ...(details.photoDataUrl ? { imageUrl: details.photoDataUrl } : {}),
              last_check_in: { 
                 ...c.last_check_in, 
                 timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
                 was_fed: details.wasFed !== undefined ? details.wasFed : c.last_check_in.was_fed,
                 activities: details.activities || c.last_check_in.activities,
                 notes: details.notes !== undefined ? details.notes : c.last_check_in.notes
              } 
            } 
          : c
      ));
      return { status: 'updated' };
    } catch(e) {
      console.error("Failed to update cat", e);
      throw e;
    }
  };

  const seedMockArea = (lat: number, lng: number) => {
    // Mock seeding disabled - using real database now
  };

  return (
    <CatContext.Provider value={{ cats, loading, fetchNearbyCats: findNearbyCats, logNewSighting, updateCatSighting, seedMockArea }}>
      {children}
    </CatContext.Provider>
  );
}

export function useCatDatabase() {
  const context = useContext(CatContext);
  if (!context) throw new Error('useCatDatabase must be used within CatProvider');
  return context;
}
