import React, { createContext, useContext, useState, useEffect } from "react";
import { db } from "../config/firebase";
import {
  collection,
  query,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { distanceBetween } from "geofire-common";
import { CatRecord } from "../types";

interface CatContextProps {
  cats: CatRecord[];
  loading: boolean;
  fetchNearbyCats: (
    lat: number,
    lng: number,
    radius?: number,
  ) => Promise<CatRecord[]>;
  logNewSighting: (
    lat: number,
    lng: number,
    geohash: string,
    details: any,
    forceCreate?: boolean,
  ) => Promise<any>;
  addCheckInLog: (details: any) => Promise<any>;
  updateCatSighting: (catId: string, details: any) => Promise<any>;
  updateCatProfile: (
    catId: string,
    payload: Partial<CatRecord>,
  ) => Promise<any>;
  seedMockArea: (lat: number, lng: number) => void;
  refreshCats: () => Promise<void>;
  updateViewport?: (lat: number, lng: number, radiusM: number) => void;
}

const CatContext = createContext<CatContextProps | undefined>(undefined);

export function CatProvider({ children }: { children: React.ReactNode }) {
  const [cats, setCats] = useState<CatRecord[]>([]);
  const [loading, setLoading] = useState(false);

  
  const unsubscribesRef = React.useRef<any[]>([]);

  const updateViewport = React.useCallback((lat: number, lng: number, radiusM: number) => {
    import("geofire-common").then(({ geohashQueryBounds, distanceBetween }) => {
      import("firebase/firestore").then(({ onSnapshot, query, collection, where, orderBy }) => {
        unsubscribesRef.current.forEach(u => u());
        unsubscribesRef.current = [];

        const bounds = geohashQueryBounds([lat, lng], radiusM);
        const mapData = new Map<string, CatRecord>();

        // We only maintain notifications for new additions
        let initialLoad = true;

        for (const b of bounds) {
          const q = query(
            collection(db, "strays"),
            orderBy("geohash"),
            where("geohash", ">=", b[0]),
            where("geohash", "<=", b[1])
          );
          
          const unsub = onSnapshot(q, (snap) => {
            snap.docs.forEach(doc => {
               const cat = doc.data() as CatRecord;
               const dist = distanceBetween([cat.lat, cat.lng], [lat, lng]) * 1000;
               if (dist <= radiusM + 500) { // Add a little buffer
                 mapData.set(doc.id, { id: doc.id, ...cat } as CatRecord);
               } else {
                 mapData.delete(doc.id);
               }
            });
            
            snap.docChanges().forEach(change => {
               const cat = change.doc.data() as CatRecord;
               if (change.type === "removed") {
                  mapData.delete(change.doc.id);
               }
               
               if (!initialLoad && Notification.permission === "granted") {
                 if (change.type === "added" && cat.status === "approved") {
                   new Notification("New Stray in Area", {
                     body: `A stray named ${cat.name || "Unknown"} was just added!`,
                     icon: cat.imageUrl || "/favicon.png",
                   });
                 }
                 if (change.type === "modified" && cat.status === "approved" && cat.submissionId) {
                   new Notification("Submission Approved!", {
                     body: `Your submission for ${cat.name || "a stray"} has been approved by the system.`,
                     icon: cat.imageUrl || "/favicon.png",
                   });
                 }
               }
            });
            
            setCats(Array.from(mapData.values()));
          });
          unsubscribesRef.current.push(unsub);
        }
        
        // Also fetch public and lost pets
        const qPets = query(
          collection(db, "pets"),
          where("status", "in", ["public", "lost"])
        );
        const unsubPets = onSnapshot(qPets, (snap) => {
          snap.docs.forEach(doc => {
            const pet = doc.data() as any;
            if (pet.lat && pet.lng) {
              const dist = distanceBetween([pet.lat, pet.lng], [lat, lng]) * 1000;
              if (dist <= radiusM + 500) {
                mapData.set(doc.id, {
                  id: doc.id,
                  lat: pet.lat,
                  lng: pet.lng,
                  name: pet.name,
                  animalType: pet.species,
                  imageUrl: pet.photoDataUrl || pet.imageUrl,
                  status: "approved",
                  isPet: true,
                  petStatus: pet.status,
                  ownerId: pet.ownerId,
                  inviteCode: pet.inviteCode,
                  genderVotes: { male: pet.gender === "Male" ? 1 : 0, female: pet.gender === "Female" ? 1 : 0, unknown: pet.gender === "Unknown" ? 1 : 0 },
                } as any);
              } else {
                mapData.delete(doc.id);
              }
            }
          });
          
          snap.docChanges().forEach(change => {
             if (change.type === "removed") {
                mapData.delete(change.doc.id);
             }
          });
          
          setCats(Array.from(mapData.values()));
        });
        unsubscribesRef.current.push(unsubPets);
        
        // Small delay to allow all initial snapshots to resolve before treating as non-initial
        setTimeout(() => initialLoad = false, 2000);
      });
    });
  }, []);

  const fetchCats = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "strays"));
      const snap = await getDocs(q);
      let data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as CatRecord[];

      setCats(data);
    } catch (e) {
      console.error("Failed to fetch from Firestore", e);
    } finally {
      setLoading(false);
    }
  };

  
  useEffect(() => {
    // Polling logic removed, relying on onSnapshot bindings in useGeoQuery and local components.
  }, []);

  const findNearbyCats = async (
    lat: number,
    lng: number,
    radiusInM: number = 50,
  ) => {
    const center = [lat, lng] as [number, number];
    return cats.filter((cat) => {
      if (cat.status !== "approved") return false;
      const dist = distanceBetween([cat.lat, cat.lng], center) * 1000;
      return dist <= radiusInM;
    });
  };

  const logNewSighting = async (
    lat: number,
    lng: number,
    geohash: string,
    details: any,
    forceCreate: boolean = false,
  ) => {
    if (!forceCreate) {
      const nearby = await findNearbyCats(lat, lng, 50);
      if (nearby.length > 0) {
        return { duplicatesFound: nearby, status: "duplicates_found" };
      }
    }

    try {
      const newCatData = {
        lat,
        lng,
        geohash,
        name: details.name || null,
        animalType: details.animalType || "Cat",
        genderVotes: {
          male: details.gender === "Male" ? 1 : 0,
          female: details.gender === "Female" ? 1 : 0,
          unknown: details.gender === "Unknown" ? 1 : 0,
        },
        imageUrl: details.photoDataUrl || null,
        status: details.status || "under_review",
        submissionId: details.submissionId || null,
        submittedBy: details.submittedBy || null,
        locationName: details.locationName || null,
        characteristics: details.tags
          ? details.tags.map((t: string) => ({ tag: t, votes: 1 }))
          : [],
        last_check_in: {
          timestamp: serverTimestamp(),
          was_fed: details.wasFed || false,
          activities: details.activities || [],
          notes: details.notes || null,
        },
      };
      const docRef = await addDoc(collection(db, "strays"), newCatData);

      return { status: "created", id: docRef.id };
    } catch (e) {
      console.error("Failed to add document", e);
      throw e;
    }
  };

  const addCheckInLog = async (details: any) => {
    try {
      const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
      const docRef = await addDoc(collection(db, "check_ins"), {
        catId: details.catId,
        wasFed: details.wasFed || false,
        healthStatus: details.healthStatus || "Good",
        geo_point: details.geo_point || null,
        photoDataUrl: details.photoDataUrl || null,
        addToGallery: details.addToGallery || false,
        status: details.status || "under_review",
        submissionId: details.submissionId || null,
        submittedBy: details.submittedBy || null,
        timestamp: serverTimestamp(),
      });
      return { status: "created", id: docRef.id };
    } catch (e) {
      console.error("Failed to add check-in log", e);
      throw e;
    }
  };

  const updateCatSighting = async (catId: string, details: any) => {
    try {
      const { doc, getDoc, updateDoc } = await import("firebase/firestore");
      const docRef = doc(db, "strays", catId);
      const catSnap = await getDoc(docRef);
      if (!catSnap.exists()) return { status: "not_found" };
      const catData = catSnap.data();

      const updateData: any = {
        "last_check_in.timestamp": serverTimestamp(),
      };

      if (details.name) updateData.name = details.name;
      if (details.status) updateData.status = details.status;
      if (details.submissionId) updateData.submissionId = details.submissionId;
      if (details.photoDataUrl && !details.isCheckIn) updateData.imageUrl = details.photoDataUrl;
      if (details.wasFed !== undefined)
        updateData["last_check_in.was_fed"] = details.wasFed;
      if (details.activities)
        updateData["last_check_in.activities"] = details.activities;
      if (details.notes) updateData["last_check_in.notes"] = details.notes;
      if (details.locationName) updateData.locationName = details.locationName;
      if (details.inviteCode !== undefined)
        updateData.inviteCode = details.inviteCode;
      if (details.caretakers !== undefined)
        updateData.caretakers = details.caretakers;

      let newGallery = [...(catData.gallery || [])];
      let galleryUpdated = false;
      if (
        details.addToGallery &&
        details.photoDataUrl &&
        details.status === "approved"
      ) {
        newGallery.push({
          id: Date.now().toString(),
          url: details.photoDataUrl,
          timestamp: Date.now(),
          votes: 0,
          submittedBy: details.submittedBy,
        });
        // Sort by votes descending, then timestamp descending
        newGallery.sort(
          (a, b) => b.votes - a.votes || b.timestamp - a.timestamp,
        );
        // Keep max 10
        if (newGallery.length > 10) {
          newGallery = newGallery.slice(0, 10);
        }
        updateData.gallery = newGallery;
        galleryUpdated = true;
      }

      await updateDoc(docRef, updateData);

      // Update local state smoothly
      setCats((prev) =>
        prev.map((c) =>
          c.id === catId
            ? {
                ...c,
                name: details.name || c.name,
                ...(details.status
                  ? {
                      status: details.status,
                      submissionId: details.submissionId,
                    }
                  : {}),
                ...(details.photoDataUrl && !details.isCheckIn
                  ? { imageUrl: details.photoDataUrl }
                  : {}),
                ...(galleryUpdated ? { gallery: newGallery } : {}),
                ...(details.inviteCode !== undefined
                  ? { inviteCode: details.inviteCode }
                  : {}),
                ...(details.caretakers !== undefined
                  ? { caretakers: details.caretakers }
                  : {}),
                last_check_in: {
                  ...c.last_check_in,
                  timestamp: {
                    seconds: Math.floor(Date.now() / 1000),
                    nanoseconds: 0,
                  },
                  was_fed:
                    details.wasFed !== undefined
                      ? details.wasFed
                      : c.last_check_in.was_fed,
                  activities: details.activities || c.last_check_in.activities,
                  notes:
                    details.notes !== undefined
                      ? details.notes
                      : c.last_check_in.notes,
                },
              }
            : c,
        ),
      );
      return { status: "updated" };
    } catch (e) {
      console.error("Failed to update cat", e);
      throw e;
    }
  };

  const updateCatProfile = async (
    catId: string,
    payload: Partial<CatRecord>,
  ) => {
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      const docRef = doc(db, "strays", catId);

      const updateData: any = {};
      if (payload.names) updateData.names = payload.names;
      if (payload.characteristics)
        updateData.characteristics = payload.characteristics;
      if (payload.gallery) updateData.gallery = payload.gallery;
      if (payload.genderVotes) updateData.genderVotes = payload.genderVotes;
      if (payload.inviteCode !== undefined)
        updateData.inviteCode = payload.inviteCode;
      if (payload.caretakers !== undefined)
        updateData.caretakers = payload.caretakers;

      await updateDoc(docRef, updateData);

      setCats((prev) =>
        prev.map((c) => (c.id === catId ? { ...c, ...payload } : c)),
      );

      return { status: "updated" };
    } catch (e) {
      console.error("Failed to update cat profile", e);
      throw e;
    }
  };

  const seedMockArea = (lat: number, lng: number) => {
    // Mock seeding disabled - using real database now
  };

  return (
    <CatContext.Provider
      value={{
        cats,
        loading,
        fetchNearbyCats: findNearbyCats,
        logNewSighting,
        addCheckInLog,
        updateCatSighting,
        updateCatProfile,
        seedMockArea,
        refreshCats: fetchCats,
        updateViewport,
      }}
    >
      {children}
    </CatContext.Provider>
  );
}

export function useCatDatabase() {
  const context = useContext(CatContext);
  if (!context)
    throw new Error("useCatDatabase must be used within CatProvider");
  return context;
}
