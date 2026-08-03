import React, { useState, useEffect, useRef } from "react";
import { useCatDatabase } from "../hooks/useCatDatabase";
import { useLazyAuth } from "../hooks/useLazyAuth";
import { usePWAInstall } from "../hooks/usePWAInstall";
import { useNavigate } from "react-router-dom";
import { CustomIcon } from "../components/CustomIcon";
import { AdBanner } from "../components/AdBanner";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useSettings } from "../context/SettingsContext";
import {
  ArrowLeft,
  User as UserIcon,
  ShieldAlert,
  Plus,
  Award,
  Lock,
  Check,
  XCircle,
  Edit2,
  History,
  Settings,
  Menu,
  ExternalLink,
  MapPin,
  Bell,
  Share2,
  Cat,
  Dog,
  PawPrint
} from "lucide-react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";

import { HubManager } from "../components/HubManager";

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  React.useEffect(() => {
    map.flyTo(center, map.getZoom());
  }, [center, map]);
  return null;
}

function LocationPickerEvents({
  onSelect,
}: {
  onSelect: (coords: [number, number]) => void;
}) {
  useMapEvents({
    click(e) {
      onSelect([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

interface Pet {
  id: string;
  name: string;
  breed: string;
  color: string;
  age: string;
  gender: "Male" | "Female" | "Unknown";
  lastLocation: string;
  status: "private" | "public" | "lost";
  photoDataUrl?: string;
}

interface UserProfile {
  gamification: {
    total_xp: number;
    stray_submissions: number;
    check_ins: number;
  };
  role_preference?: "caretaker" | "pawrent";
  unlocked_badges: string[];
  active_title?: string;
  pets: Pet[];
  favorites?: string[];
  bound_hub_id?: string[];
}

export default function AccountPage() {
  const {
    user,
    loading: authLoading,
    upgradeToGoogleAccount,
    logout,
    resendVerification,
  } = useLazyAuth();
  const { permission, requestPermission } = usePushNotifications();
  const { deferredPrompt, isIOS, isStandalone, triggerInstall } = usePWAInstall();
  const { cats, updateCatProfile } = useCatDatabase();
  const navigate = useNavigate();
  const { settings } = useSettings();

  const [activeTab, setActiveTab] = useState<
    "submissions" | "pets" | "account" | "other" | "hub_manager"
  >("submissions");
  const [inviteCodeInput, setInviteCodeInput] = useState("");

  const [subTab, setSubTab] = useState<"submissions" | "favorites">(
    "submissions",
  );
  const [subTabSearchQuery, setSubTabSearchQuery] = useState("");
  const [subTabCurrentPage, setSubTabCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    setSubTabCurrentPage(1);
  }, [subTabSearchQuery, subTab]);

  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem("user_profile");
    let parsed = {
      gamification: {
        total_xp: 0,
        stray_submissions: 0,
        check_ins: 0,
      },
      unlocked_badges: [],
      pets: [],
      favorites: [],
    };
    if (saved) {
      try {
        const p = JSON.parse(saved);
        parsed = {
          ...parsed,
          ...p,
          gamification: { ...parsed.gamification, ...(p.gamification || {}) },
          unlocked_badges: p.unlocked_badges || [],
          pets: p.pets || [],
          favorites: p.favorites || [],
        };
      } catch (e) {}
    }
    return parsed;
  });

  const [fetchedFavCats, setFetchedFavCats] = useState<any[]>([]);

  useEffect(() => {
    if (profile.favorites && profile.favorites.length > 0) {
      const fetchFavs = async () => {
        try {
          const { doc, getDoc } = await import('firebase/firestore');
          const { db } = await import('../config/firebase');
          const missingIds = profile.favorites!.filter(id => !cats.find(c => c.id === id));
          if (missingIds.length > 0) {
            const fetched = await Promise.all(missingIds.map(async id => {
              const d = await getDoc(doc(db, 'strays', id));
              return d.exists() ? { id: d.id, ...d.data() } : null;
            }));
            setFetchedFavCats(fetched.filter(Boolean));
          }
        } catch (e) {
          console.error("Failed to fetch missing favorites", e);
        }
      };
      fetchFavs();
    }
  }, [profile.favorites, cats]);

  const [userSubmissions, setUserSubmissions] = useState<any[]>([]);
  const [userCheckIns, setUserCheckIns] = useState<any[]>([]);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const res = await fetch("/api/upload-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: base64 }),
          });
          const data = await res.json();
          if (data.success && data.url) {
            const { updateProfile } = await import("firebase/auth");
            await updateProfile(user, { photoURL: data.url });
            window.location.reload();
          } else {
            alert("Failed to upload image.");
            setIsUploadingAvatar(false);
          }
        } catch (err) {
          console.error("Upload error", err);
          alert("Error uploading image.");
          setIsUploadingAvatar(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setIsUploadingAvatar(false);
      console.error(error);
    }
  };

  useEffect(() => {
    localStorage.setItem("user_profile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    if (user) {
      const fetchUserData = async () => {
        try {
          const { collection, query, where, getDocs, or } = await import('firebase/firestore');
          const { db } = await import('../config/firebase');
          
          if (user.uid) {
            // Fetch strays/submissions
            const subQ = query(collection(db, 'strays'), where('submittedBy', '==', user.uid));
            const subSnap = await getDocs(subQ);
            const fetchedSubs = subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUserSubmissions(fetchedSubs);
            
            // Fetch check-ins
            const checkQ = query(collection(db, 'check_ins'), where('submittedBy', '==', user.uid));
            const checkSnap = await getDocs(checkQ);
            setUserCheckIns(checkSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            
            // Sync Gamification Stats based on previous database records
            setProfile(p => {
                const strayCount = Math.max(fetchedSubs.length, p.gamification.stray_submissions || 0);
                const checkCount = Math.max(checkSnap.docs.length, p.gamification.check_ins || 0);
                
                // Recalculate estimated totalXP (simplified reconstruction if it was lost)
                // Assuming 50 XP per stray submission, 20 XP per check-in
                let calculatedXp = (strayCount * 50) + (checkCount * 20);
                const totalXP = Math.max(calculatedXp, p.gamification.total_xp || 0);
                
                const unlocked = new Set(p.unlocked_badges);
                if (!user.isAnonymous) unlocked.add("pawtrainee");
                if (strayCount >= 1) unlocked.add("pawrent");
                if (strayCount >= 5) unlocked.add("stray_savior");
                if (strayCount >= 10) unlocked.add("cat_whisperer");
                
                if (checkCount >= 1) unlocked.add("good_samaritan");
                if (checkCount >= 10) unlocked.add("reliable_feeder");
                if (checkCount >= 50) unlocked.add("neighborhood_guardian");
                
                return {
                    ...p,
                    gamification: {
                        stray_submissions: strayCount,
                        check_ins: checkCount,
                        total_xp: totalXP
                    },
                    unlocked_badges: Array.from(unlocked)
                };
            });
          }

          // Fetch Pets
          if (!user.isAnonymous) {
            try {
              const petQ1 = query(collection(db, 'pets'), where('ownerId', '==', user.uid));
              const petQ2 = query(collection(db, 'pets'), where('caretakers', 'array-contains', user.uid));
              
              const [snap1, snap2] = await Promise.all([getDocs(petQ1), getDocs(petQ2)]);
              
              const petDocMap = new Map();
              snap1.docs.forEach(doc => petDocMap.set(doc.id, { id: doc.id, ...doc.data() }));
              snap2.docs.forEach(doc => petDocMap.set(doc.id, { id: doc.id, ...doc.data() }));
              
              const fetchedPets = Array.from(petDocMap.values()) as Pet[];
              
              if (fetchedPets.length > 0) {
                setProfile(p => {
                  const petMap = new Map();
                  // Prefer fetched truth
                  p.pets.forEach(pet => petMap.set(pet.id, pet));
                  fetchedPets.forEach(pet => petMap.set(pet.id, pet));
                  return { ...p, pets: Array.from(petMap.values()) };
                });
              }

              // Fetch User Document and Managed Hubs
              const { doc, getDoc } = await import('firebase/firestore');
              const userDocRef = doc(db, 'users', user.uid);
              const userDoc = await getDoc(userDocRef);
              let boundHubIds: string[] = [];

              if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.bound_hub_id && Array.isArray(userData.bound_hub_id)) {
                  boundHubIds = userData.bound_hub_id;
                } else if (userData.role) {
                  setProfile(p => ({ ...p, role_preference: userData.role }));
                }
              }

              try {
                const hubsQueryId = query(collection(db, 'hubs'), where('picId', '==', user.uid));
                const hubsSnapId = await getDocs(hubsQueryId);
                hubsSnapId.forEach(hubDoc => {
                  if (!boundHubIds.includes(hubDoc.id)) {
                    boundHubIds.push(hubDoc.id);
                  }
                });

                if (user.email) {
                  const hubsQueryEmail = query(collection(db, 'hubs'), where('picEmail', '==', user.email));
                  const hubsSnapEmail = await getDocs(hubsQueryEmail);
                  hubsSnapEmail.forEach(hubDoc => {
                    if (!boundHubIds.includes(hubDoc.id)) {
                      boundHubIds.push(hubDoc.id);
                    }
                  });
                }
              } catch (e) {
                console.error("Error fetching hubs by picId", e);
              }

              if (boundHubIds.length > 0) {
                 setProfile(p => ({ ...p, bound_hub_id: boundHubIds }));
              }

            } catch(e) {
              console.error("Failed to fetch pets", e);
            }
          }
        } catch(e) {
          console.error("Failed to fetch user data", e);
        }
      };
      fetchUserData();
    }
  }, [user]);

  const [newPet, setNewPet] = useState<{
    name: string;
    species: string;
    breed: string;
    color: string;
    age: string;
    gender: "Male" | "Female" | "Unknown";
    lastLocation: string;
    status: "private" | "public" | "lost";
    photoDataUrl?: string;
  }>({
    name: "",
    species: "",
    breed: "",
    color: "",
    age: "",
    gender: "Unknown",
    lastLocation: "",
    status: "private",
  });

  const [addMode, setAddMode] = useState<"none" | "adoption" | "manual">(
    "none",
  );
  const [inviteAttempts, setInviteAttempts] = useState(0);
  const [inviteLockoutUntil, setInviteLockoutUntil] = useState<number | null>(
    null,
  );
  const [claimStatus, setClaimStatus] = useState<
    "idle" | "pending" | "rejected"
  >("idle");

  const [isLocating, setIsLocating] = useState(false);
  const [deviceLocation, setDeviceLocation] = useState<[number, number] | null>(
    null,
  );
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [mapPickerCenter, setMapPickerCenter] = useState<[number, number]>([
    51.505, -0.09,
  ]);
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [publicToggleConfirm, setPublicToggleConfirm] = useState<{petId: string, nextStatus: string} | null>(null);

  const handleMapSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapSearchQuery.trim()) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(mapSearchQuery)}&format=json&limit=1`,
      );
      const data = await res.json();
      if (data && data.length > 0) {
        setMapPickerCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
      } else {
        alert("Location not found.");
      }
    } catch {
      alert("Error searching location.");
    }
  };

  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown(resendCooldown - 1),
        1000,
      );
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const [userSettings, setUserSettings] = useState({
    displayName: "",
    isAnonymous: false,
  });
  useEffect(() => {
    const saved = localStorage.getItem("user_settings");
    if (saved) {
      setUserSettings(JSON.parse(saved));
    } else if (user && user.displayName) {
      setUserSettings((prev) => ({
        ...prev,
        displayName: user.displayName || "",
      }));
    }
  }, [user]);

  useEffect(() => {
    if (user && !user.isAnonymous) {
      setProfile((prev) => {
        if (!prev.unlocked_badges.includes("pawtrainee")) {
          return {
            ...prev,
            unlocked_badges: [...prev.unlocked_badges, "pawtrainee"],
          };
        }
        return prev;
      });
    }
  }, [user]);

  // Calculate Level based on exact formula
  const totalXP = profile.gamification.total_xp;
  const level = Math.floor(0.1 * Math.sqrt(totalXP)) + 1;
  const nextLevel = level + 1;
  // Calculate XP threshold logic to show progress bar
  // level = floor(0.1 * sqrt(xp)) + 1
  // level - 1 = floor(0.1 * sqrt(xp))
  // (level - 1) / 0.1 <= sqrt(xp) < level / 0.1
  const xpCurrentLevelBase = Math.pow((level - 1) / 0.1, 2);
  const xpNextLevelBase = Math.pow(level / 0.1, 2);
  const progressPercent = Math.max(
    0,
    Math.min(
      100,
      ((totalXP - xpCurrentLevelBase) /
        (xpNextLevelBase - xpCurrentLevelBase)) *
        100,
    ),
  );

  const handleRoleSelect = (role: "caretaker" | "pawrent") => {
    setProfile((prev) => ({ ...prev, role_preference: role }));
    // Here we would also update Firestore
  };

  const toggleLostMode = async (petId: string) => {
    let newStatus = "";
    setProfile((prev) => ({
      ...prev,
      pets: prev.pets.map((p) => {
        if (p.id === petId) {
          newStatus = p.status === "lost" ? "public" : "lost";
          return { ...p, status: newStatus };
        }
        return p;
      }),
    }));
    
    if (newStatus) {
      try {
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('../config/firebase');
        const petRef = doc(db, 'pets', petId);
        
        let updates: any = { status: newStatus };
        const cachedPos = sessionStorage.getItem("strayapp_pos");
        if (cachedPos) {
          try {
            const parsed = JSON.parse(cachedPos);
            if (Array.isArray(parsed) && parsed.length === 2) {
              updates.lat = parsed[0];
              updates.lng = parsed[1];
            }
          } catch(e) {}
        }
        
        await updateDoc(petRef, updates);
      } catch(e) {
        console.error("Failed to update lost mode on Firebase", e);
      }
    }
  };

  const togglePublicMode = async (petId: string) => {
    let currentStatus = "";
    if (petId === "NEW") {
      currentStatus = newPet.status;
    } else {
      profile.pets.forEach(p => {
         if (p.id === petId) currentStatus = p.status;
      });
    }
    if (currentStatus === "lost") return;
    
    const nextStatus = currentStatus === "private" ? "public" : "private";
    setPublicToggleConfirm({ petId, nextStatus });
  };

  const executeTogglePublicMode = async () => {
    if (!publicToggleConfirm) return;
    const { petId, nextStatus } = publicToggleConfirm;
    setPublicToggleConfirm(null);

    if (petId === "NEW") {
      setNewPet(prev => ({ ...prev, status: nextStatus }));
      return;
    }

    let newStatus = "";
    let canChange = false;
    setProfile((prev) => ({
      ...prev,
      pets: prev.pets.map((p) => {
        if (p.id === petId) {
          if (p.status === "lost") return p; // Cannot change public/private if lost
          newStatus = p.status === "private" ? "public" : "private";
          canChange = true;
          return { ...p, status: newStatus };
        }
        return p;
      }),
    }));
    
    if (canChange && newStatus) {
      try {
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('../config/firebase');
        const petRef = doc(db, 'pets', petId);
        
        let updates: any = { status: newStatus };
        const cachedPos = sessionStorage.getItem("strayapp_pos");
        if (cachedPos) {
          try {
            const parsed = JSON.parse(cachedPos);
            if (Array.isArray(parsed) && parsed.length === 2) {
              updates.lat = parsed[0];
              updates.lng = parsed[1];
            }
          } catch(e) {}
        }
        
        await updateDoc(petRef, updates);
      } catch(e) {
        console.error("Failed to update public mode on Firebase", e);
      }
    }
  };

  const handleAddPet = async () => {
    if (!newPet.name) return;
    const newId = `pet_${Date.now()}`;
    const newInviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    let uploadedPhotoUrl = newPet.photoDataUrl;
    if (uploadedPhotoUrl && uploadedPhotoUrl.startsWith("data:image")) {
      try {
        const res = await fetch("/api/upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: uploadedPhotoUrl })
        });
        if (res.ok) {
          const data = await res.json();
          uploadedPhotoUrl = data.url;
        }
      } catch (e) {
        console.error("Failed to upload pet image", e);
      }
    }
    
    // Optimistic UI update
    setProfile((prev) => ({
      ...prev,
      pets: [...prev.pets, { ...newPet, id: newId, inviteCode: newInviteCode, photoDataUrl: uploadedPhotoUrl, ownerId: user?.uid || 'anonymous' }],
    }));
    
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      
      const cachedPos = sessionStorage.getItem("strayapp_pos");
      let lat = newPet.lat || null;
      let lng = newPet.lng || null;
      if (!lat || !lng) {
        if (cachedPos) {
          try {
            const parsed = JSON.parse(cachedPos);
            if (Array.isArray(parsed) && parsed.length === 2) {
              lat = parsed[0];
              lng = parsed[1];
            }
          } catch(e) {}
        }
      }

      const petData = {
        ...newPet,
        id: newId,
        inviteCode: newInviteCode,
        ownerId: user?.uid || 'anonymous',
        createdAt: Date.now(),
        photoDataUrl: uploadedPhotoUrl,
        ...(lat && lng ? { lat, lng } : {})
      };
      
      await setDoc(doc(db, "pets", newId), petData);
    } catch(err) {
      console.error("Failed to add pet to Firestore:", err);
      alert("Failed to save pet permanently. It is only saved locally for now.");
    }
    
    setNewPet({
      name: "",
      species: "",
      breed: "",
      color: "",
      age: "",
      gender: "Unknown",
      lastLocation: "",
      status: "private",
      photoDataUrl: undefined,
    });
    setAddMode("none");
    navigate(`/pet/${newId}`);
  };

  const handleClaimPet = async () => {
    const code = inviteCodeInput.trim().toUpperCase();
    if (!code || !user || user.isAnonymous) return;

    if (inviteLockoutUntil && Date.now() < inviteLockoutUntil) {
      alert("Too many failed attempts. Please try again later.");
      return;
    }

    let foundPet: any = null;
    let isStray = false;

    const cat = cats.find((c) => c.inviteCode && c.inviteCode.toUpperCase() === code);
    if (cat) {
      foundPet = cat;
      isStray = true;
    } else {
      try {
        const { getDocs, query, collection, where } = await import('firebase/firestore');
        const { db } = await import('../config/firebase');
        const q = query(collection(db, 'pets'), where('inviteCode', '==', code));
        const snap = await getDocs(q);
        if (!snap.empty) {
          foundPet = { id: snap.docs[0].id, ...snap.docs[0].data() };
        }
      } catch (err) {
        console.error("Error finding pet by invite code", err);
      }
    }

    if (foundPet) {
      if ((foundPet.caretakers || []).includes(user.uid) || foundPet.ownerId === user.uid) {
        alert("You are already a caretaker for this pet.");
        return;
      }

      setClaimStatus("pending");

      // Simulate waiting for owner to accept
      setTimeout(async () => {
        try {
          const reqObj = { uid: user.uid, displayName: userSettings.displayName || user.email || "Unknown", email: user.email || "" };
          const { doc, updateDoc, arrayUnion } = await import('firebase/firestore');
          const { db } = await import('../config/firebase');

          if (isStray) {
            await updateCatProfile(foundPet.id, { collaboratorRequests: arrayUnion(reqObj) as any });
          } else {
            await updateDoc(doc(db, 'pets', foundPet.id), { collaboratorRequests: arrayUnion(reqObj) });
          }
          alert("Request sent successfully! Waiting for owner's approval.");
        } catch(e) {
          console.error("Error updating pet collaboratorRequests", e);
          alert("Failed to send request.");
        }
        
        setClaimStatus("idle");
        setInviteCodeInput("");
        setAddMode("none");
      }, 1000);
    } else {
      const newAttempts = inviteAttempts + 1;
      setInviteAttempts(newAttempts);
      if (newAttempts >= 3) {
        setInviteLockoutUntil(Date.now() + 30000);
        setInviteAttempts(0);
        alert(
          "Invalid invitation code. You have been locked out for 30 seconds.",
        );
      } else {
        alert(
          `Invalid invitation code. ${3 - newAttempts} attempts remaining.`,
        );
      }
    }
  };

  if (authLoading)
    return (
      <div className="h-full bg-slate-50 flex items-center justify-center font-bold text-slate-400">
        Loading profile...
      </div>
    );

  const renderBadge = (
    id: string,
    name: string,
    description: string,
    reqType: "strays" | "checkins",
    reqCount: number,
  ) => {
    const isUnlocked = profile.unlocked_badges.includes(id);
    const progress =
      reqType === "strays"
        ? profile.gamification.stray_submissions
        : profile.gamification.check_ins;
    const isNext = !isUnlocked && progress >= reqCount / 2; // just rough logic to show it's 'in progress'

    return (
      <div
        onClick={() => {
          if (isUnlocked) {
            const updated = { ...profile, active_title: name };
            setProfile(updated);
            localStorage.setItem("user_profile", JSON.stringify(updated));
            alert(`Title changed to ${name}!`);
          }
        }}
        className={`flex flex-col items-center text-center transition-all ${isUnlocked ? "cursor-pointer" : "opacity-50 grayscale"} ${profile.active_title === name ? "ring-2 ring-orange-500 rounded-xl p-2" : "p-2"}`}
      >
        <div
          className={`w-14 h-14 rounded-full mb-2 flex items-center justify-center shadow-sm border border-slate-100 relative ${isUnlocked ? "bg-orange-50" : "bg-slate-50"}`}
        >
          <Award
            className={`w-6 h-6 ${isUnlocked ? "text-orange-500" : "text-slate-400"}`}
          />
          {!isUnlocked && (
            <Lock className="w-3 h-3 text-slate-500 absolute bottom-0 right-0 bg-slate-100 rounded-full p-0.5" />
          )}
        </div>
        <h4
          className={`text-xs font-bold leading-tight ${isUnlocked ? "text-slate-800" : "text-slate-500"}`}
        >
          {name}
        </h4>
        {profile.active_title === name && (
            <span className="text-[9px] font-bold text-orange-500 mt-1 uppercase">Active</span>
        )}
      </div>
    );
  };

  const localUserCats = cats.filter((c) => c.submittedBy === (user?.uid || "anonymous"));
  const allSubsMap = new Map<string, any>(userSubmissions.map(s => [s.id, s]));
  localUserCats.forEach(lc => {
    allSubsMap.set(lc.id, { ...(allSubsMap.get(lc.id) || {}), ...lc });
  });
  const allSubs = Array.from(allSubsMap.values());
  const firstStrayImage = allSubs.find(s => s.imageUrl)?.imageUrl;
  const firstPetImage = profile.pets?.[0]?.photoDataUrl;
  const firstCheckInImage = userCheckIns.find(c => c.imageUrl)?.imageUrl;

  return (
    <div className="h-full w-full bg-slate-100 overflow-y-auto flex flex-col font-sans pb-12">
      {/* Top Header */}
      <div className="bg-white px-4 py-8 shadow-sm relative z-10 rounded-b-[2rem]">
        <button
          onClick={() => navigate("/")}
          className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 active:scale-95 transition-all mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4">
          <div className="relative group cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              disabled={isUploadingAvatar || !user || user.isAnonymous}
              className="absolute inset-0 opacity-0 cursor-pointer z-20"
              title="Change Profile Picture"
            />
            {isUploadingAvatar ? (
              <div className="w-16 h-16 rounded-full bg-slate-200 animate-pulse border-2 border-white flex items-center justify-center">
                <span className="text-[10px] text-slate-500 font-bold">...</span>
              </div>
            ) : user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Avatar"
                className="w-16 h-16 rounded-full shadow-md object-cover border-2 border-white group-hover:opacity-80 transition-opacity"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shadow-md border-2 border-white group-hover:bg-orange-200 transition-colors">
                <UserIcon className="w-8 h-8" />
              </div>
            )}
            {user && !user.isAnonymous && !isUploadingAvatar && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center shadow-sm z-30 pointer-events-none">
                <Award className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900">
                {!user || user.isAnonymous
                  ? `Pawtaker #${user.uid.substring(user.uid.length - 4)}`
                  : user?.displayName || "App User"}
              </h2>
              <div className="flex items-center gap-2">
                {user && !user.isAnonymous && (
                  <button
                    onClick={() => navigate('/share', { state: { 
                      type: 'profile', 
                      user: user ? { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL, isAnonymous: user.isAnonymous } : null,
                      userSettings,
                      profile, 
                      firstStrayImage,
                      firstPetImage,
                      firstCheckInImage,
                      checkInCount: userCheckIns.length,
                      strayCount: allSubs.length
                    } })}
                    className="p-1.5 text-orange-500 hover:text-orange-600 bg-orange-50 border border-orange-100 rounded-full transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                )}
                {user && !user.isAnonymous && (
                  <button
                    onClick={() => setActiveTab("account")}
                    className="p-1.5 text-slate-400 hover:text-slate-600 bg-slate-50 border border-slate-100 rounded-full transition-colors"
                  >
                    <CustomIcon
                      src="/icon-edit.png"
                      FallbackIcon={Edit2}
                      className="w-4 h-4"
                    />
                  </button>
                )}
              </div>
            </div>

            {!user || user.isAnonymous ? (
              <p className="text-sm font-bold text-slate-500 mb-2">
                Unregistered
              </p>
            ) : (
              <p className="text-xs font-bold text-orange-600 bg-orange-50 inline-block px-2 py-0.5 rounded-md mt-1 border border-orange-100 uppercase tracking-wide">
                {profile.active_title || "Neighborhood Caretaker"}
              </p>
            )}

            {user && !user.isAnonymous && user && !user.emailVerified && (
              <div className="mt-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 flex items-center justify-between py-1 rounded-md border border-amber-200">
                <span>Email not verified</span>
              </div>
            )}

            {!user || user.isAnonymous && (
              <button
                onClick={() => navigate("/login")}
                className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-slate-800 transition-all mt-2 cursor-pointer"
              >
                Sign in to Save Progress
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-8 px-2">
          <button
            onClick={() => setActiveTab("submissions")}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all ${activeTab === "submissions" ? "bg-orange-500 text-white shadow-md shadow-orange-200" : "bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100"}`}
          >
            <History className="w-5 h-5 mb-1.5" />
            <span className="text-[10px] font-bold">My Stray</span>
          </button>
          <button
            onClick={() => setActiveTab("pets")}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all ${activeTab === "pets" ? "bg-orange-500 text-white shadow-md shadow-orange-200" : "bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100"}`}
          >
            <Award className="w-5 h-5 mb-1.5" />
            <span className="text-[10px] font-bold">My Pets</span>
          </button>
          <button
            onClick={() => setActiveTab("account")}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all ${activeTab === "account" ? "bg-orange-500 text-white shadow-md shadow-orange-200" : "bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100"}`}
          >
            <Settings className="w-5 h-5 mb-1.5" />
            <span className="text-[10px] font-bold">Account</span>
          </button>
          <button
            onClick={() => setActiveTab("other")}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all ${activeTab === "other" ? "bg-orange-500 text-white shadow-md shadow-orange-200" : "bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100"}`}
          >
            <Menu className="w-5 h-5 mb-1.5" />
            <span className="text-[10px] font-bold">Other</span>
          </button>
        </div>

        {/* Gamification Level Frame Hidden */}
        {/* !user?.isAnonymous && ( ... ) */}
      </div>

      {!isStandalone && (
        <div className="px-4 pt-6">
          <div className="bg-slate-800 text-white rounded-[2rem] p-5 shadow-sm border border-slate-700 flex flex-col gap-3">
            <h3 className="font-black text-lg text-orange-400">Add to Home Screen</h3>
            <p className="text-sm font-medium text-slate-300">
              Install Straykin on your device for quick and easy access.
            </p>
            {isIOS ? (
              <p className="text-xs text-slate-400 bg-slate-700/50 p-3 rounded-xl border border-slate-600">
                Tap the <strong>Share</strong> icon in your browser menu and select <strong>Add to Home Screen</strong>.
              </p>
            ) : deferredPrompt ? (
              <button 
                onClick={triggerInstall}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors mt-1"
              >
                Install App
              </button>
            ) : (
              <p className="text-xs text-slate-400 bg-slate-700/50 p-3 rounded-xl border border-slate-600">
                Use your browser menu to <strong>Install</strong> or <strong>Add to Home Screen</strong>.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="px-4 pt-4 flex justify-center">
        <AdBanner format="rectangle" />
      </div>

      <div className="p-4 space-y-6">
        {activeTab === "submissions" && (
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-4">My Stray</h3>

            <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
              <button
                onClick={() => setSubTab("submissions")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${subTab === "submissions" ? "bg-white text-slate-800 shadow shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                My Submissions
              </button>
              <button
                onClick={() => setSubTab("favorites")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${subTab === "favorites" ? "bg-white text-slate-800 shadow shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Favorites
              </button>
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by name..."
                value={subTabSearchQuery}
                onChange={(e) => setSubTabSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500"
              />
            </div>

            {subTab === "submissions" && (() => {
              const localUserCats = cats.filter((c) => c.submittedBy === (user?.uid || "anonymous"));
              const allSubsMap = new Map<string, any>(userSubmissions.map(s => [s.id, s]));
              localUserCats.forEach(lc => {
                allSubsMap.set(lc.id, { ...(allSubsMap.get(lc.id) || {}), ...lc });
              });
              let allSubs = Array.from(allSubsMap.values());
              if (subTabSearchQuery.trim()) {
                allSubs = allSubs.filter(cat => (cat.name || `Straykin #${cat.id.slice(-4)}`).toLowerCase().includes(subTabSearchQuery.toLowerCase()));
              }
              const totalPages = Math.ceil(allSubs.length / itemsPerPage);
              const paginatedSubs = allSubs.slice((subTabCurrentPage - 1) * itemsPerPage, subTabCurrentPage * itemsPerPage);

              return (
              <>
                {(!user || user.isAnonymous) && (
                  <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-orange-900">
                        Guest Session
                      </h4>
                      <p className="text-xs text-orange-700 mt-1">
                        Your submissions will disappear if you lose your
                        session. Register now to keep your strays up to date.
                      </p>
                      <button
                        onClick={() => navigate("/login")}
                        className="mt-2 text-xs font-bold text-orange-600 hover:text-orange-700 underline"
                      >
                        Register Now
                      </button>
                    </div>
                  </div>
                )}

                {allSubs.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-center text-slate-500 font-medium text-sm">
                    No reports history.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paginatedSubs
                      .map((cat, index) => (
                        <React.Fragment key={cat.id}>
                          <button
                            onClick={() => navigate(`/cat/${cat.id}`, { state: { cat } })}
                            className="w-full text-left bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex gap-4 hover:bg-slate-50 transition-colors active:scale-95 flex-shrink-0"
                          >
                            <div className="w-16 h-16 bg-slate-200 rounded-2xl overflow-hidden shrink-0">
                              {cat.imageUrl ? (
                                <img
                                  src={cat.imageUrl}
                                  className={`w-full h-full object-cover ${cat.status === "rejected" ? "grayscale opacity-60" : ""}`}
                                />
                              ) : (
                                <div className="w-full h-full bg-slate-100 flex items-center justify-center text-2xl">
                                  😿
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col min-w-0 pr-2">
                                  <span className="text-[10px] font-black uppercase tracking-wider mb-0.5 text-slate-500">
                                    {cat.animalType || "CAT"}
                                  </span>
                                  <h3 className="text-lg font-bold text-slate-800 leading-tight truncate">
                                    {cat.name || `Straykin #${cat.id.slice(-4)}`}
                                  </h3>
                                </div>
                                <div className="flex flex-col items-end shrink-0 gap-1">
                                  {cat.status === "under_review" && (
                                    <span className="bg-amber-100 text-amber-700 text-[9px] uppercase font-black px-2 py-0.5 rounded-full whitespace-nowrap">
                                      Review
                                    </span>
                                  )}
                                  {cat.status === "rejected" && (
                                    <span className="bg-rose-100 text-rose-700 text-[9px] uppercase font-black px-2 py-0.5 rounded-full whitespace-nowrap">
                                      Rejected
                                    </span>
                                  )}
                                  {cat.status === "approved" && (
                                    <span className="bg-emerald-100 text-emerald-700 text-[9px] uppercase font-black px-2 py-0.5 rounded-full whitespace-nowrap">
                                      Approved
                                    </span>
                                    )}
                                  </div>
                                </div>
                                <p className="text-xs text-slate-500 font-medium mt-1">
                                  Last check-in:{" "}
                                  {cat.last_check_in?.timestamp
                                    ? new Date(
                                        (cat.last_check_in.timestamp as any)
                                          ?.seconds * 1000,
                                      ).toLocaleDateString()
                                    : "Unknown"}
                                </p>
                              </div>
                            </button>
                            {index === 2 && (
                              <div className="w-full h-[90px] overflow-hidden my-2 border border-slate-100 rounded-xl bg-slate-50">
                                <AdBanner format="homeBanner" />
                              </div>
                            )}
                          </React.Fragment>
                      ))}
                  </div>
                )}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                      onClick={() => setSubTabCurrentPage(Math.max(1, subTabCurrentPage - 1))}
                      disabled={subTabCurrentPage === 1}
                      className="px-3 py-1.5 rounded-lg text-sm font-bold bg-slate-100 text-slate-600 disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <span className="text-xs font-bold text-slate-500">
                      {subTabCurrentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setSubTabCurrentPage(Math.min(totalPages, subTabCurrentPage + 1))}
                      disabled={subTabCurrentPage === totalPages}
                      className="px-3 py-1.5 rounded-lg text-sm font-bold bg-slate-100 text-slate-600 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
              );
            })()}

            {subTab === "favorites" && (() => {
               const combinedCats = [...cats, ...fetchedFavCats.filter(fc => !cats.find(c => c.id === fc.id))];
               let favCats = combinedCats.filter((c) => profile.favorites?.includes(c.id));
               if (subTabSearchQuery.trim()) {
                 favCats = favCats.filter(cat => (cat.name || `Straykin #${cat.id.slice(-4)}`).toLowerCase().includes(subTabSearchQuery.toLowerCase()));
               }
               const totalPages = Math.ceil(favCats.length / itemsPerPage);
               const paginatedFavs = favCats.slice((subTabCurrentPage - 1) * itemsPerPage, subTabCurrentPage * itemsPerPage);

               return (
              <>
                {!profile.favorites || profile.favorites.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-center text-slate-500 font-medium text-sm">
                    You haven't added any favorite strays yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paginatedFavs
                      .map((cat, index) => (
                        <React.Fragment key={cat.id}>
                          <button
                            onClick={() => navigate(`/cat/${cat.id}`, { state: { cat } })}
                            className="w-full text-left bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex gap-4 hover:bg-slate-50 transition-colors active:scale-95 flex-shrink-0"
                          >
                            <div className="w-16 h-16 bg-slate-200 rounded-2xl overflow-hidden shrink-0">
                              {cat.imageUrl ? (
                                <img
                                  src={cat.imageUrl}
                                  className={`w-full h-full object-cover`}
                                />
                              ) : (
                                <div className="w-full h-full bg-slate-100 flex items-center justify-center text-2xl">
                                  😿
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col min-w-0 pr-2">
                                  <span className="text-[10px] font-black uppercase tracking-wider mb-0.5 text-slate-500">
                                    {cat.animalType || "CAT"}
                                  </span>
                                  <h3 className="text-lg font-bold text-slate-800 leading-tight truncate">
                                    {cat.name || `Straykin #${cat.id.slice(-4)}`}
                                  </h3>
                                </div>
                              </div>
                              <p className="text-xs text-slate-500 font-medium mt-1">
                                Last check-in:{" "}
                                {cat.last_check_in?.timestamp
                                  ? new Date(
                                      (cat.last_check_in.timestamp as any)
                                        ?.seconds * 1000,
                                    ).toLocaleDateString()
                                  : "Unknown"}
                              </p>
                            </div>
                          </button>
                          {index === 2 && (
                            <div className="w-full h-[90px] overflow-hidden my-2 border border-slate-100 rounded-xl bg-slate-50">
                              <AdBanner format="homeBanner" />
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                  </div>
                )}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                      onClick={() => setSubTabCurrentPage(Math.max(1, subTabCurrentPage - 1))}
                      disabled={subTabCurrentPage === 1}
                      className="px-3 py-1.5 rounded-lg text-sm font-bold bg-slate-100 text-slate-600 disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <span className="text-xs font-bold text-slate-500">
                      {subTabCurrentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setSubTabCurrentPage(Math.min(totalPages, subTabCurrentPage + 1))}
                      disabled={subTabCurrentPage === totalPages}
                      className="px-3 py-1.5 rounded-lg text-sm font-bold bg-slate-100 text-slate-600 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
              );
            })()}
          </div>
        )}

        {/* Account Tab */}
        {activeTab === "account" && (
          <div className="space-y-6">
            {profile.bound_hub_id && profile.bound_hub_id.length > 0 && user && (
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-orange-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-full -z-0"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-black text-slate-900 mb-1">
                    Hub Management
                  </h3>
                  <p className="text-xs font-bold text-slate-500 mb-5">
                    Manage your shelter or organization
                  </p>
                  <button
                    onClick={() => setActiveTab("hub_manager")}
                    className="w-full flex items-center justify-between p-4 bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors text-white font-bold"
                  >
                    <div className="flex items-center gap-3">
                      <CustomIcon src="/icon-hub.png" FallbackIcon={MapPin} className="w-5 h-5 filter brightness-0 invert" />
                      <span>Hub Setting</span>
                    </div>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-black text-slate-900 leading-tight mb-6">
                Profile Settings
              </h3>

              {!user || user.isAnonymous ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                  <p className="text-sm font-bold text-slate-700 mb-2">
                    Sign in to customize your profile
                  </p>
                  <p className="text-xs text-slate-500 mb-4">
                    You can set your display name and hide submissions once
                    registered.
                  </p>
                  <button
                    onClick={() => navigate("/login")}
                    className="px-4 py-2 bg-orange-500 text-white font-bold rounded-full text-xs shadow-md"
                  >
                    Register Now
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {user && !user.isAnonymous && !user.emailVerified && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <h4 className="text-red-800 font-bold text-sm mb-1">
                        Email Verification Required
                      </h4>
                      <p className="text-xs text-red-600 mb-3 block">
                        Please verify your email address to unlock all features.
                        Check your inbox or spam folder.
                      </p>
                      <button
                        onClick={async () => {
                          if (resendCooldown > 0) return;
                          try {
                            await resendVerification();
                            alert("Verification email resent!");
                            setResendCooldown(30);
                          } catch (e: any) {
                            alert("Failed to resend: " + e.message);
                          }
                        }}
                        disabled={resendCooldown > 0}
                        className={`px-4 py-2 text-white rounded-lg text-xs font-bold shadow-sm transition-colors ${resendCooldown > 0 ? "bg-slate-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"}`}
                      >
                        {resendCooldown > 0
                          ? `Wait ${resendCooldown}s`
                          : "Resend Verification Email"}
                      </button>
                    </div>
                  )}
                  
                  {permission !== 'granted' && (
                    <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                          <Bell className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">Push Notifications</p>
                          <p className="text-xs text-slate-600">Get notified about new strays.</p>
                        </div>
                      </div>
                      <button 
                        onClick={requestPermission}
                        className="bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm"
                      >
                        Enable
                      </button>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                      Display Name
                    </p>
                    <input
                      type="text"
                      value={userSettings.displayName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUserSettings((prev) => ({
                          ...prev,
                          displayName: val,
                        }));
                        localStorage.setItem(
                          "user_settings",
                          JSON.stringify({ ...userSettings, displayName: val }),
                        );
                      }}
                      onBlur={async () => {
                        if (
                          userSettings.displayName &&
                          user &&
                          !user.isAnonymous
                        ) {
                          const { updateProfile } =
                            await import("firebase/auth");
                          try {
                            await updateProfile(user, {
                              displayName: userSettings.displayName,
                            });
                          } catch (e) {
                            console.error("Failed to update profile name", e);
                          }
                        }
                      }}
                      placeholder="e.g. StraySaver"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm placeholder-slate-400 focus:outline-orange-500 focus:bg-white"
                    />
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 border border-slate-100 p-4 rounded-xl">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        Anonymous Submissions
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Hide full name on activity
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const isAnon = !userSettings.isAnonymous;
                        setUserSettings((prev) => ({
                          ...prev,
                          isAnonymous: isAnon,
                        }));
                        localStorage.setItem(
                          "user_settings",
                          JSON.stringify({
                            ...userSettings,
                            isAnonymous: isAnon,
                          }),
                        );
                      }}
                      className={`w-12 h-6 rounded-full relative transition-colors ${userSettings.isAnonymous ? "bg-orange-500" : "bg-slate-300"}`}
                    >
                      <span
                        className={`absolute top-1 bottom-1 w-4 bg-white rounded-full transition-all ${userSettings.isAnonymous ? "left-7" : "left-1"}`}
                      ></span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-black text-slate-900 mb-1">
                Achievements
              </h3>
              <p className="text-xs font-bold text-slate-400 mb-5">
                Your Neighborhood Caretaker stats
              </p>

              {!user || user.isAnonymous ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center mb-6">
                  <div className="w-12 h-12 bg-slate-200 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h4 className="text-slate-800 font-bold mb-1">
                    Achievements Locked
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mb-3">
                    Register to start earning badges for helping straykins.
                  </p>
                  <button
                    onClick={() => navigate("/login")}
                    className="px-4 py-2 bg-orange-500 text-white font-bold rounded-full text-xs shadow-md"
                  >
                    Register Now
                  </button>
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-y-6 gap-x-2">
                {settings.achievements.map(badge => (
                  <React.Fragment key={badge.id}>
                    {renderBadge(
                      badge.id,
                      badge.title,
                      badge.description,
                      badge.type,
                      badge.threshold
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Other Tab */}
        {activeTab === "hub_manager" && profile.bound_hub_id && profile.bound_hub_id.length > 0 && user && (
          <HubManager hubId={profile.bound_hub_id[0]} userId={user.uid} onClose={() => setActiveTab("account")} />
        )}

        {activeTab === "other" && (
          <div className="space-y-4">
            <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-slate-200">
              <button
                onClick={() => navigate("/updates")}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors"
              >
                <span className="font-bold text-slate-700">Update Log</span>
                <ExternalLink className="w-4 h-4 text-slate-400" />
              </button>
              <button
                onClick={() => navigate("/privacy")}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors border-t border-slate-100"
              >
                <span className="font-bold text-slate-700">Privacy Policy</span>
                <ExternalLink className="w-4 h-4 text-slate-400" />
              </button>
              <button
                onClick={() => navigate("/terms")}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors border-t border-slate-100"
              >
                <span className="font-bold text-slate-700">
                  Terms & Conditions
                </span>
                <ExternalLink className="w-4 h-4 text-slate-400" />
              </button>
              <button
                onClick={() => navigate("/support")}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors border-t border-slate-100"
              >
                <span className="font-bold text-slate-700">
                  Contact Support
                </span>
                <ExternalLink className="w-4 h-4 text-slate-400" />
              </button>
              <button
                onClick={() => navigate("/suggestions")}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors border-t border-slate-100"
              >
                <span className="font-bold text-slate-700">
                  Suggestions / Feedback
                </span>
                <ExternalLink className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* 
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-[2rem] p-6 shadow-md shadow-indigo-200 text-white flex flex-col items-center text-center">
               <h3 className="font-black text-xl mb-1">Support Straykin</h3>
               <p className="text-sm text-indigo-100 font-medium mb-4">Help us keep the servers running and our local strays fed. Be a hero.</p>
               <button className="bg-white text-indigo-600 font-black px-6 py-3 rounded-xl hover:bg-indigo-50 transition-all shadow-lg active:scale-95 w-full">
                 Donate via Stripe
               </button>
            </div>
            */}

            {user && !user.isAnonymous && (
              <button
                onClick={() => {
                  logout();
                  navigate("/");
                }}
                className="w-full py-4 text-rose-500 font-bold bg-rose-50 rounded-[2rem] border border-rose-100 mt-4 hover:bg-rose-100 transition-colors"
              >
                Log Out
              </button>
            )}
          </div>
        )}

        {activeTab === "pets" && (
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-black text-slate-900 leading-tight">
                My Registered Pets
              </h3>
              <button
                title="Privacy information"
                className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <Lock className="w-3 h-3" />
              </button>
            </div>
            <p className="text-xs font-medium text-slate-500 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-700">
                Private by default.
              </span>{" "}
              These profiles are strictly private and do not appear on the
              public map unless reported missing.
            </p>

            <div className="space-y-4">
              {!user || user.isAnonymous ? (
                <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-3xl">
                  <div className="w-16 h-16 bg-slate-200 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-slate-800">
                    Pet Profiles Locked
                  </h4>
                  <p className="text-sm text-slate-500 mb-4 mt-1">
                    Register to manage your furry friend.
                  </p>
                  <button
                    onClick={() => navigate("/login")}
                    className="py-3 px-6 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-orange-200"
                  >
                    Register Now
                  </button>
                </div>
              ) : profile.pets.length === 0 &&
                cats.filter((c) => c.caretakers?.includes(user?.uid || ""))
                  .length === 0 &&
                addMode === "none" ? (
                <div className="text-center py-8 flex flex-col gap-3">
                  <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-2">
                    <UserIcon className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-slate-800">
                    No Pets Registered
                  </h4>
                  <p className="text-sm text-slate-500 mt-1">
                    Keep your furry friend safe.
                  </p>
                  <button
                    onClick={() => setAddMode("adoption")}
                    className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-colors shadow-lg"
                  >Caretaker Hub</button>
                  <button
                    onClick={() => setAddMode("manual")}
                    className="py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-colors shadow-sm border border-slate-200"
                  >
                    Add Pet
                  </button>
                </div>
              ) : (
                <>
                  {cats
                    .filter((c) => c.caretakers?.includes(user?.uid || ""))
                    .map((cat) => (
                      <div
                        key={cat.id}
                        className="p-5 rounded-3xl border-2 transition-colors flex flex-col gap-4 border-indigo-100 bg-indigo-50/30"
                      >
                        <button
                          key={cat.id}
                          onClick={() => navigate(`/cat/${cat.id}`, { state: { cat } })}
                          className="flex gap-4 items-center text-left hover:opacity-80 transition-opacity"
                        >
                          <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center text-3xl shrink-0 overflow-hidden shadow-inner border-4 border-white">
                            {cat.imageUrl ? (
                              <img
                                src={cat.imageUrl}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              "😸"
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h4 className="font-black text-slate-900 text-lg flex items-center gap-2 truncate">
                                {cat.name || "Adopted Stray"}
                              </h4>
                              <span className="bg-orange-100 text-orange-700 text-[9px] uppercase font-black px-2 py-0.5 rounded-full shrink-0">
                                Claimed
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-500">
                              View Public Neighborhood Profile
                            </p>
                          </div>
                        </button>
                      </div>
                    ))}
                  {profile.pets.map((pet) => (
                    <div
                      key={pet.id}
                      className={`p-5 rounded-3xl border-2 transition-colors flex flex-col gap-4 ${pet.status === "lost" ? "border-red-500 bg-red-50" : "border-indigo-100 bg-indigo-50/30"}`}
                    >
                      <button
                        onClick={() => navigate(`/pet/${pet.id}`, { state: { pet } })}
                        className="flex gap-4 items-center text-left hover:opacity-80 transition-opacity"
                      >
                        <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center text-3xl shrink-0 overflow-hidden shadow-inner border-4 border-white">
                          {pet.photoDataUrl ? (
                            <img
                              src={pet.photoDataUrl}
                              className="w-full h-full object-cover"
                            />
                          ) : pet.status === "lost" ? (
                            "😿"
                          ) : (
                            "🐾"
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-slate-900 text-lg flex items-center gap-2 truncate">
                              {pet.name}
                            </h4>
                            <span className="bg-slate-200 text-slate-600 text-[9px] uppercase font-black px-2 py-0.5 rounded-full shrink-0">
                              Private
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-500">
                            {pet.gender !== "Unknown" ? `${pet.gender} • ` : ""}
                            {pet.color} • {pet.breed}
                          </p>
                        </div>
                      </button>

                      {/* Public / Private Toggle */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-200 border-opacity-50 mt-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-700">
                            {pet.status === "public" || pet.status === "lost"
                              ? "Public visible"
                              : "Private"}
                          </span>
                          <span className="text-xs text-slate-500">
                            Visible on public maps
                          </span>
                        </div>
                        <button
                          onClick={() => togglePublicMode(pet.id)}
                          disabled={pet.status === "lost"}
                          className={`w-14 h-8 rounded-full p-1 relative transition-colors duration-300 ease-in-out focus:outline-none ${pet.status === "public" || pet.status === "lost" ? "bg-indigo-500" : "bg-slate-300"} ${pet.status === "lost" ? "opacity-50" : ""}`}
                        >
                          <div
                            className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-300 ease-in-out flex items-center justify-center ${pet.status === "public" || pet.status === "lost" ? "translate-x-6" : "translate-x-0"}`}
                          ></div>
                        </button>
                      </div>

                      {/* SOS Toggle Switch */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-200 border-opacity-50">
                        <div className="flex items-center gap-2">
                          <ShieldAlert
                            className={`w-5 h-5 ${pet.status === "lost" ? "text-red-500" : "text-slate-400"}`}
                          />
                          <span className="text-sm font-bold text-slate-700">
                            Report Missing
                          </span>
                        </div>

                        <button
                          onClick={() => toggleLostMode(pet.id)}
                          className={`w-14 h-8 rounded-full p-1 relative transition-colors duration-300 ease-in-out focus:outline-none ${pet.status === "lost" ? "bg-red-500" : "bg-slate-300"}`}
                        >
                          <div
                            className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-300 ease-in-out flex items-center justify-center ${pet.status === "lost" ? "translate-x-6" : "translate-x-0"}`}
                          >
                            {pet.status === "lost" && (
                              <ShieldAlert className="w-3 h-3 text-red-500 shrink-0" />
                            )}
                          </div>
                        </button>
                      </div>
                      {pet.status === "lost" && (
                        <div className="bg-red-100 text-red-800 text-[10px] font-bold p-2.5 rounded-xl uppercase tracking-wide">
                          SOS Mode Active: Public distress pin broadcasted at:{" "}
                          {pet.lastLocation?.length > 18 ? pet.lastLocation.substring(0, 18) + "..." : pet.lastLocation}
                        </div>
                      )}
                    </div>
                  ))}
                  {addMode === "none" && (
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => setAddMode("adoption")}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-50 border border-indigo-200 border-dashed rounded-3xl font-bold text-indigo-600 hover:bg-indigo-100 transition-colors"
                      >
                        <Award className="w-5 h-5" /> Caretaker Hub
                      </button>
                      <button
                        onClick={() => setAddMode("manual")}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-slate-50 border border-slate-200 border-dashed rounded-3xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        <Plus className="w-5 h-5" /> Add Another Pet
                      </button>
                    </div>
                  )}
                </>
              )}

              {addMode === "adoption" && (
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-black text-slate-800">
                      Claim via Invitation Code
                    </h4>
                    <button
                      onClick={() => setAddMode("none")}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                  {claimStatus === "pending" ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
                      <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                      <p className="font-bold text-indigo-700 animate-pulse">
                        Waiting for the owner to accept...
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500 mb-3">
                        Adopt a stray to your pets collection using a code
                        provided by the primary caretaker.
                      </p>
                      <div className="flex flex-col gap-3">
                        <input
                          placeholder="Enter 6-digit invite code"
                          value={inviteCodeInput}
                          onChange={(e) => setInviteCodeInput(e.target.value)}
                          className="bg-white p-3 rounded-xl border border-slate-200 text-sm font-bold focus:outline-indigo-500"
                        />
                        <button
                          onClick={handleClaimPet}
                          disabled={
                            !!(
                              inviteLockoutUntil &&
                              Date.now() < inviteLockoutUntil
                            )
                          }
                          className="w-full bg-indigo-600 disabled:bg-indigo-300 text-white py-3 font-bold px-4 rounded-xl active:scale-95 transition-transform"
                        >
                          Submit
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {addMode === "manual" && (
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-black text-slate-800">
                      Add Pet Profile
                    </h4>
                    <button
                      onClick={() => setAddMode("none")}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex justify-center mb-4">
                    <label className="w-24 h-24 bg-white rounded-full border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer overflow-hidden hover:bg-slate-100 hover:text-indigo-500 hover:border-indigo-300 transition-colors relative">
                      {newPet.photoDataUrl ? (
                        <img
                          src={newPet.photoDataUrl}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <>
                          <Plus className="w-6 h-6 mb-1" />
                          <span className="text-[10px] font-bold">
                            Add Photo
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) =>
                              setNewPet((prev) => ({
                                ...prev,
                                photoDataUrl: ev.target?.result as string,
                              }));
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>

                  <input
                    placeholder="Pet Name"
                    value={newPet.name}
                    onChange={(e) =>
                      setNewPet({ ...newPet, name: e.target.value })
                    }
                    className="w-full bg-white p-3 rounded-xl border border-slate-200 text-sm font-bold focus:outline-indigo-500"
                  />
                  <select
                    value={newPet.species}
                    onChange={(e) =>
                      setNewPet({ ...newPet, species: e.target.value })
                    }
                    className="w-full bg-white p-3 rounded-xl border border-slate-200 text-sm font-bold focus:outline-indigo-500"
                  >
                    <option value="">
                      Select Species (e.g. Cat, Dog, Bird)
                    </option>
                    <option value="Cat">Cat</option>
                    <option value="Dog">Dog</option>
                    <option value="Hamster">Hamster</option>
                    <option value="Bird">Bird</option>
                    <option value="Other">Other</option>
                  </select>
                  <select
                    value={newPet.gender}
                    onChange={(e) =>
                      setNewPet({ ...newPet, gender: e.target.value as any })
                    }
                    className="w-full bg-white p-3 rounded-xl border border-slate-200 text-sm font-bold focus:outline-indigo-500"
                  >
                    <option value="Unknown">Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  <div className="flex gap-2">
                    <input
                      placeholder="Age"
                      value={newPet.age}
                      onChange={(e) =>
                        setNewPet({ ...newPet, age: e.target.value })
                      }
                      className="w-1/2 bg-white p-3 rounded-xl border border-slate-200 text-sm font-bold focus:outline-indigo-500"
                    />
                    <input
                      placeholder="Breed"
                      value={newPet.breed}
                      onChange={(e) =>
                        setNewPet({ ...newPet, breed: e.target.value })
                      }
                      className="w-1/2 bg-white p-3 rounded-xl border border-slate-200 text-sm font-bold focus:outline-indigo-500"
                    />
                  </div>
                  <input
                    placeholder="Color"
                    value={newPet.color}
                    onChange={(e) =>
                      setNewPet({ ...newPet, color: e.target.value })
                    }
                    className="w-full bg-white p-3 rounded-xl border border-slate-200 text-sm font-bold focus:outline-indigo-500"
                  />
                  <div className="flex flex-col gap-3">
                    <input
                      placeholder="Last Known Location (e.g. Home)"
                      value={newPet.lastLocation}
                      readOnly
                      className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 cursor-not-allowed"
                    />
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setIsMapPickerOpen(true);
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            const newPos: [number, number] = [
                              pos.coords.latitude,
                              pos.coords.longitude,
                            ];
                            setDeviceLocation(newPos);
                            setMapPickerCenter(newPos);
                          },
                          () => {},
                        );
                      }}
                      title="Pick from Map"
                      className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 flex items-center justify-center transition-colors shadow-sm"
                    >
                      Register Location
                    </button>
                  </div>

                  <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-slate-200 border-opacity-50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">
                        Make it public
                      </span>
                      <button
                        onClick={() => togglePublicMode("NEW")}
                        className={`w-12 h-6 rounded-full p-1 relative transition-colors duration-300 ease-in-out focus:outline-none ${newPet.status === "public" ? "bg-indigo-500" : "bg-slate-300"}`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ease-in-out ${newPet.status === "public" ? "translate-x-6" : "translate-x-0"}`}
                        ></div>
                      </button>
                    </div>
                    {newPet.status === "public" && (
                      <p className="text-[10px] text-indigo-600 font-bold bg-indigo-50 p-2 rounded-lg">
                        By activating this feature, your pet will be shown on
                        the map to other users.
                      </p>
                    )}
                  </div>

                  {isMapPickerOpen && (
                    <div className="fixed inset-0 z-[100] bg-[#e5e7eb] flex flex-col w-full h-[100dvh] sm:max-w-md sm:mx-auto">
                      <div className="absolute top-0 inset-x-0 p-4 z-10 flex flex-col gap-2 pointer-events-none">
                        <div className="flex items-center gap-2 pointer-events-auto">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setIsMapPickerOpen(false);
                            }}
                            className="w-12 h-12 rounded-full bg-white text-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.15)] flex items-center justify-center shrink-0 border border-slate-100"
                          >
                            <ArrowLeft className="w-6 h-6" />
                          </button>
                          <form
                            onSubmit={handleMapSearch}
                            className="flex-1 flex gap-2 w-full max-w-sm mx-auto shadow-[0_8px_30px_rgb(0,0,0,0.15)] rounded-[2rem] bg-white p-2 border border-slate-100"
                          >
                            <input
                              type="text"
                              placeholder="Search area..."
                              value={mapSearchQuery}
                              onChange={(e) =>
                                setMapSearchQuery(e.target.value)
                              }
                              className="flex-1 bg-transparent px-3 outline-none text-sm font-medium text-slate-800"
                            />
                            <button
                              type="submit"
                              className="bg-slate-100 p-2 rounded-full text-slate-600 font-bold hover:bg-slate-200 shrink-0"
                            >
                              <MapPin className="w-5 h-5" />
                            </button>
                          </form>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              if ("geolocation" in navigator) {
                                navigator.geolocation.getCurrentPosition(
                                  (pos) => {
                                    const newPos: [number, number] = [
                                      pos.coords.latitude,
                                      pos.coords.longitude,
                                    ];
                                    setDeviceLocation(newPos);
                                    setMapPickerCenter(newPos);
                                  },
                                  () => alert("Could not get location.")
                                );
                              }
                            }}
                            className="w-12 h-12 rounded-full bg-white text-indigo-600 shadow-[0_8px_30px_rgb(0,0,0,0.15)] flex items-center justify-center shrink-0 border border-slate-100 hover:bg-indigo-50 transition-colors"
                          >
                            <MapPin className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 w-full relative z-0">
                        <MapContainer
                          center={mapPickerCenter}
                          zoom={15}
                          zoomControl={false}
                          className="w-full h-full"
                        >
                          <MapController center={mapPickerCenter} />
                          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                          {deviceLocation && (
                            <Marker
                              position={deviceLocation}
                              icon={L.divIcon({
                                className: "custom-icon",
                                html: '<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md"></div>',
                                iconSize: [16, 16],
                                iconAnchor: [8, 8],
                              })}
                            />
                          )}
                          <Marker position={mapPickerCenter} />
                          <LocationPickerEvents
                            onSelect={(coords) => {
                              setMapPickerCenter(coords);
                            }}
                          />
                        </MapContainer>
                      </div>
                      <div className="p-6 pb-12 bg-white flex flex-col gap-3 shadow-[0_-8px_30px_rgb(0,0,0,0.1)] z-10 pointer-events-auto">
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            setIsLocating(true);
                            let locationName = `${mapPickerCenter[0].toFixed(4)}, ${mapPickerCenter[1].toFixed(4)}`;
                            try {
                              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${mapPickerCenter[0]}&lon=${mapPickerCenter[1]}&format=json`);
                              const data = await res.json();
                              if (data && data.display_name) {
                                locationName = data.display_name;
                              }
                            } catch(e) {}
                            
                            setNewPet((prev) => ({
                              ...prev,
                              lastLocation: locationName,
                              lat: mapPickerCenter[0],
                              lng: mapPickerCenter[1],
                            }));
                            setIsLocating(false);
                            setIsMapPickerOpen(false);
                          }}
                          className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-indigo-700 transition-transform active:scale-95 text-lg"
                        >
                          {isLocating ? "Getting Address..." : "Set Pet Location"}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4 pt-2">
                    <button
                      onClick={() => {
                        handleAddPet();
                        setAddMode("none");
                      }}
                      className="w-full py-4 text-lg font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
                      disabled={!newPet.name}
                    >
                      Save Pet
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {publicToggleConfirm && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4 animate-in zoom-in-95">
              <h3 className="text-xl font-black text-slate-800">
                {publicToggleConfirm.nextStatus === "public" ? "Make Public?" : "Make Private?"}
              </h3>
              <p className="text-sm font-medium text-slate-600">
                {publicToggleConfirm.nextStatus === "public" 
                  ? "Are you sure you want to make this pet profile public? It will be visible on the map to everyone."
                  : "Are you sure you want to make this pet profile private? It will be hidden from the public map."}
              </p>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setPublicToggleConfirm(null)}
                  className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={executeTogglePublicMode}
                  className={`flex-1 py-3 text-sm font-bold text-white rounded-xl shadow-lg ${
                    publicToggleConfirm.nextStatus === "public" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-800 hover:bg-slate-900"
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
