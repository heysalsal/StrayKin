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
        const q = query(collection(db, 'cats'));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CatRecord[];
        
        if (data.length > 0) {
          setCats(data);
        } else {
          throw new Error("No real data, using mock");
        }
      } catch (e) {
        console.warn("Failed to fetch from Firestore. Using mock data.");
        // Make sure we have some mock data if Firestore fails
        const nowSecs = Math.floor(Date.now() / 1000);
        const past13HoursSecs = nowSecs - (13 * 3600);
        setCats([
          {
            id: 'mock1', geohash: 'gcpuy', lat: 51.505, lng: -0.09,
            name: 'Shadow',
            names: [{ name: 'Shadow', votes: 5, suggestedBy: 'user1' }, { name: 'Batman', votes: 2, suggestedBy: 'user2' }],
            color_tags: ['Black'],
            genderVotes: { male: 5, female: 1, unknown: 0 },
            last_check_in: { timestamp: { seconds: nowSecs, nanoseconds: 0 }, was_fed: true }
          },
          {
            id: 'mock2', geohash: 'gcpu1', lat: 51.51, lng: -0.1,
            name: 'Whiskers',
            color_tags: ['Tabby'],
            sterilizedVotes: 2,
            last_check_in: { timestamp: { seconds: past13HoursSecs, nanoseconds: 0 }, was_fed: true }
          }
        ]);
        // Also seed the big list at default lat lng immediately for testing!
        setTimeout(() => seedMockArea(51.505, -0.09), 1000);
      } finally {
        setLoading(false);
      }
    };
    fetchCats();
  }, []);

  useEffect(() => {
    let active = true;
    const pollStatuses = async () => {
      // Find cats that are under review and have a submissionId
      setCats(currentCats => {
        const pending = currentCats.filter(c => c.status === 'under_review' && c.submissionId);
        if (pending.length > 0) {
          pending.forEach(async (cat) => {
            try {
              const res = await fetch(`/api/submission-status/${cat.submissionId}`);
              if (res.ok && active) {
                const data = await res.json();
                if (data.status === 'approved' || data.status === 'rejected') {
                  setCats(prev => prev.map(c => 
                    c.id === cat.id ? { ...c, status: data.status } : c
                  ));
                }
              }
            } catch (e) {}
          });
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
      // If we are using a mock config, skip addDoc to prevent pending promise hangs
      // const docRef = await addDoc(collection(db, 'cats'), { ... })
      throw new Error("Mock bypass");
    } catch(e) {
       const newMockCat: CatRecord = {
         id: 'mock' + Date.now(),
         lat, lng, geohash,
         name: details.name || undefined,
         genderVotes: {
           male: details.gender === 'Male' ? 1 : 0,
           female: details.gender === 'Female' ? 1 : 0,
           unknown: details.gender === 'Unknown' ? 1 : 0,
         },
         imageUrl: details.photoDataUrl || undefined,
         status: details.status,
         submissionId: details.submissionId,
         characteristics: details.tags ? details.tags.map((t: string) => ({ tag: t, votes: 1 })) : [],
         last_check_in: {
            timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
            was_fed: details.wasFed,
            activities: details.activities,
            notes: details.notes
         }
       };
       setCats(prev => [...prev, newMockCat]);
       return { status: 'created', id: newMockCat.id };
    }
  };

  const updateCatSighting = async (catId: string, details: any) => {
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
               was_fed: details.wasFed,
               activities: details.activities,
               notes: details.notes
            } 
          } 
        : c
    ));
    return { status: 'updated' };
  };

  const seedMockArea = (lat: number, lng: number) => {
    const nowSecs = Math.floor(Date.now() / 1000);
    const past13HoursSecs = nowSecs - (13 * 3600);
    setCats(prev => {
      if (prev.some(c => c.id === 'seeded_1')) return prev;
      return [
        ...prev,
      {
        id: 'seeded_1', 
        name: 'Marmalade', 
        names: [
          { name: 'Marmalade', votes: 15, suggestedBy: 'alice' },
          { name: 'Garfield', votes: 8, suggestedBy: 'bob' },
          { name: 'Pumpkin', votes: 3, suggestedBy: 'charlie' }
        ],
        color_tags: ['Ginger', 'White'],
        characteristics: [
          { tag: 'Friendly', votes: 20 },
          { tag: 'Vocal', votes: 15 },
          { tag: 'Playful', votes: 8 },
          { tag: 'Aggressive', votes: 1 }
        ],
        genderVotes: { male: 12, female: 2, unknown: 1 },
        sterilizedVotes: 10,
        gallery: [
          { id: 'g1', url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&h=200&fit=crop', timestamp: nowSecs - 86400, votes: 5 },
          { id: 'g2', url: 'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=200&h=200&fit=crop', timestamp: nowSecs - 86400 * 2, votes: 12 },
          { id: 'g3', url: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=200&h=200&fit=crop', timestamp: nowSecs - 86400 * 3, votes: 1 },
        ],
        imageUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&h=200&fit=crop', 
        geohash: 'xxx', lat: lat + 0.0002, lng: lng + 0.0001,
        last_check_in: { timestamp: { seconds: nowSecs - 3600, nanoseconds: 0 }, was_fed: true, activities: ['Feed', 'Stroke'] }
      },
      {
        id: 'seeded_2', name: 'Luna', imageUrl: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=200&h=200&fit=crop', geohash: 'xxx', lat: lat - 0.0003, lng: lng - 0.0002,
        last_check_in: { timestamp: { seconds: past13HoursSecs, nanoseconds: 0 }, was_fed: false }
      },
      {
        id: 'seeded_3', name: 'Captain', imageUrl: 'https://images.unsplash.com/photo-1533743983669-94fa5c4338ec?w=200&h=200&fit=crop', geohash: 'xxx', lat: lat + 0.0001, lng: lng - 0.0004,
        last_check_in: { timestamp: { seconds: nowSecs - (5 * 3600), nanoseconds: 0 }, was_fed: true }
      },
      {
        id: 'seeded_4', name: 'Oliver', imageUrl: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=200&h=200&fit=crop', geohash: 'xxx', lat: lat - 0.0002, lng: lng + 0.0004,
        last_check_in: { timestamp: { seconds: nowSecs - (2 * 3600), nanoseconds: 0 }, was_fed: false }
      },
      {
        id: 'seeded_5', name: 'Milo', imageUrl: 'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=200&h=200&fit=crop', geohash: 'xxx', lat: lat + 0.0004, lng: lng - 0.0001,
        last_check_in: { timestamp: { seconds: nowSecs - (8 * 3600), nanoseconds: 0 }, was_fed: true, activities: ['Play'] }
      },
      {
        id: 'seeded_6', name: 'Leo', imageUrl: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=200&h=200&fit=crop', geohash: 'xxx', lat: lat + 0.0001, lng: lng + 0.0003,
        last_check_in: { timestamp: { seconds: past13HoursSecs - 3600, nanoseconds: 0 }, was_fed: false }
      },
      {
        id: 'seeded_7', name: 'Bella', imageUrl: 'https://images.unsplash.com/photo-1529778456981-64b54e7befdb?w=200&h=200&fit=crop', geohash: 'xxx', lat: lat - 0.0004, lng: lng - 0.0003,
        last_check_in: { timestamp: { seconds: nowSecs - 1800, nanoseconds: 0 }, was_fed: true, activities: ['Feed'] }
      },
      {
        id: 'seeded_8', name: 'Charlie', imageUrl: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=200&h=200&fit=crop', geohash: 'xxx', lat: lat + 0.0003, lng: lng - 0.0002,
        last_check_in: { timestamp: { seconds: past13HoursSecs + 7200, nanoseconds: 0 }, was_fed: false }
      }
      ];
    });
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
