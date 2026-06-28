import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useCatDatabase } from "../hooks/useCatDatabase";
import { useLazyAuth } from "../hooks/useLazyAuth";
import { geohashForLocation } from "geofire-common";
import {
  Plus,
  AlertCircle,
  MapPin,
  List,
  X,
  User,
  RefreshCcw,
  Trophy,
  Image as ImageIcon,
  ArrowLeftRight,
  Filter,
  Cat,
  Stethoscope,
  Home,
  Coffee,
  ShoppingBag,
} from "lucide-react";
import { mapConfig } from "../config/map";
import { CatRecord } from "../types";
import { CustomIcon } from "./CustomIcon";
import { AdBanner } from "./AdBanner";
import { useSettings } from "../context/SettingsContext";
import { useError } from "../context/ErrorContext";
import { motion, AnimatePresence } from "motion/react";
import Webcam from "react-webcam";

const safeGetStorage = (type: 'local' | 'session', key: string) => {
  try {
    return type === 'local' ? localStorage.getItem(key) : sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetStorage = (type: 'local' | 'session', key: string, value: string) => {
  try {
    if (type === 'local') localStorage.setItem(key, value);
    else sessionStorage.setItem(key, value);
  } catch {}
};

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

const createMarkerIcon = (
  isFedRecently: boolean,
  status: string | undefined,
) => {
  let colorClass = isFedRecently ? "bg-emerald-500" : "bg-orange-400";
  let innerText = "🐾";

  if (status === "under_review") {
    colorClass = "bg-amber-400";
    innerText = "⏳";
  }

  return L.divIcon({
    className: "custom-cat-marker bg-transparent border-0",
    html: `<div class="relative flex flex-col items-center">
             <div class="w-10 h-10 ${colorClass} rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white text-lg">${innerText}</div>
           </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

const createClusterCustomIcon = function (cluster: any) {
  const count = cluster.getChildCount();
  return L.divIcon({
    html: `<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; border-radius: 9999px; background-color: #f97316; color: white; font-weight: bold; font-size: 18px; border: 4px solid white; box-shadow: 0 0 0 2px #f97316; opacity: 1 !important;">
             ${count}
           </div>`,
    className: "custom-marker-cluster bg-transparent border-0 outline-none",
    iconSize: L.point(44, 44, true),
  });
};

const createHubMarkerIcon = (type?: string) => {
  let bgColor = "bg-indigo-600";
  let svgPath = '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'; // Default Home

  if (type === 'vet') {
    bgColor = "bg-emerald-600";
    svgPath = '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 7v6"/><path d="M9 10h6"/>'; // Heart cross
  } else if (type === 'shelter') {
    bgColor = "bg-rose-600";
    svgPath = '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M10 14h4"/><path d="M12 12v4"/>'; // House with cross/heart, using house
  } else if (type === 'cafe') {
    bgColor = "bg-amber-600";
    svgPath = '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/>'; // Coffee
  } else if (type === 'petshop') {
    bgColor = "bg-cyan-500";
    svgPath = '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>'; // ShoppingBag
  }

  return L.divIcon({
    className: "custom-hub-marker bg-transparent border-0",
    html: `<div class="relative flex flex-col items-center">
             <div class="w-12 h-12 ${bgColor} rounded-2xl border-4 border-white shadow-xl flex items-center justify-center text-white text-xl">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg>
             </div>
           </div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
};

function MapEvents({ updateViewport, onDragStart }: { updateViewport?: (lat: number, lng: number, radiusM: number) => void, onDragStart?: () => void }) {
  const map = useMapEvents({
    dragstart: () => {
      if (onDragStart) onDragStart();
    },
    moveend: () => {
      const center = [map.getCenter().lat, map.getCenter().lng] as [number, number];
      safeSetStorage('session', "map_center", JSON.stringify(center));
      safeSetStorage('session', "map_zoom", map.getZoom().toString());
      
      if (updateViewport) {
        const bounds = map.getBounds();
        const northEast = bounds.getNorthEast();
        const radiusM = map.distance(map.getCenter(), northEast);
        updateViewport(center[0], center[1], radiusM);
      }
    },
  });

  React.useEffect(() => {
    if (updateViewport) {
      const bounds = map.getBounds();
      const northEast = bounds.getNorthEast();
      const radiusM = map.distance(map.getCenter(), northEast);
      updateViewport(map.getCenter().lat, map.getCenter().lng, radiusM);
    }
  }, [map, updateViewport]);

  return null;
}

function AutoTracker({ position, updateViewport }: { position: [number, number] | null, updateViewport: any }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, map.getZoom());
      const bounds = map.getBounds();
      const northEast = bounds.getNorthEast();
      const radiusM = map.distance(map.getCenter(), northEast);
      updateViewport(position[0], position[1], radiusM);
    }
  }, [position, map, updateViewport]);
  return null;
}

function LocateControl({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position && !sessionStorage.getItem("map_center")) {
      map.flyTo(position, mapConfig.defaultZoom);
    }
  }, [position, map]);
  return null;
}

function RecenterAction({
  counter,
  position,
}: {
  counter: number;
  position: [number, number] | null;
}) {
  const map = useMap();
  const prevCounter = useRef(counter);
  useEffect(() => {
    if (counter > prevCounter.current && position) {
      map.flyTo(position, mapConfig.defaultZoom);
      prevCounter.current = counter;
    }
  }, [counter, position, map]);
  return null;
}

import { useNavigate } from "react-router-dom";
import { InterstitialAd } from "../config/InterstitialAd";
import { distanceBetween } from "geofire-common";

export default function MapView() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  
  const [mapFilters, setMapFilters] = useState({
    stray: true,
    vet: true,
    shelter: true,
    cafe: true,
    petshop: true
  });
  const [showMapFilters, setShowMapFilters] = useState(false);

  // Initialize from sessionStorage if possible
  const [position, setPosition] = useState<[number, number] | null>(() => {
    const cached = sessionStorage.getItem("strayapp_pos");
    return cached ? JSON.parse(cached) : null;
  });

  const [shouldAutoLocate, setShouldAutoLocate] = useState(() => {
    if (sessionStorage.getItem("map_center")) return false;
    return safeGetStorage('local', "location_granted") === "true";
  });
  
  const [recenterCounter, setRecenterCounter] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [modalStep, setModalStep] = useState<"camera" | "scan" | "form">("camera");
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<{
    url: string;
    alias: string;
    cat?: any;
  } | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);

  const [duplicates, setDuplicates] = useState<CatRecord[]>([]);

  const webcamRef = useRef<Webcam>(null);

  const captureWebcam = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setPhotoDataUrl(imageSrc);
      if (position) {
        fetchNearbyCats(position[0], position[1], 500).then(nearby => {
          setDuplicates(nearby);
          setCurrentIdx(0);
          setModalStep("scan");
        });
      }
    }
  }, [position]);

  const [searchQuery, setSearchQuery] = useState("");

  const displayItems = React.useMemo(() => {
    let items = duplicates;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(c => 
        c.name?.toLowerCase().includes(q) || 
        c.animalType?.toLowerCase().includes(q) || 
        c.id.toLowerCase().includes(q)
      );
    }
    return items.map(cat => ({ type: "cat" as const, data: cat }));
  }, [duplicates, searchQuery]);

  const [sightingPos, setSightingPos] = useState<[number, number] | null>(null);

  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [reportStep, setReportStep] = useState<"camera" | "form">("form");
  const [photoAttempts, setPhotoAttempts] = useState(0);
  const [nameInput, setNameInput] = useState("");
  const [animalTypeInput, setAnimalTypeInput] = useState<
    "Cat" | "Dog" | "Other"
  >("Cat");
  const [genderInput, setGenderInput] = useState<"Male" | "Female" | null>(null);
  const [feedStatusInput, setFeedStatusInput] = useState<"Fed" | "Not Fed" | null>(null);
  const [healthStatusInput, setHealthStatusInput] = useState<string>("Good");
  const [activities, setActivities] = useState<string[]>([]);
  const [showAdditional, setShowAdditional] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState("");
  const [addToGallery, setAddToGallery] = useState(true);
  const [nameError, setNameError] = useState(false);
  const [comparingPhotoId, setComparingPhotoId] = useState<string | null>(null);

  const [earnedTitle, setEarnedTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showError } = useError();

  const {
    cats,
    logNewSighting,
    addCheckInLog,
    updateCatSighting,
    seedMockArea,
    fetchNearbyCats,
    refreshCats,
    updateViewport,
  } = useCatDatabase();
  const { user, loading: authLoading, upgradeToGoogleAccount, signInAnonymouslyIfNeeded } = useLazyAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      signInAnonymouslyIfNeeded();
    }
  }, [authLoading, user, signInAnonymouslyIfNeeded]);

  // Notification logic removed to prevent spam on load

  const [userSettings, setUserSettings] = useState({
    displayName: "",
    isAnonymous: false,
  });
  useEffect(() => {
    const saved = localStorage.getItem("user_settings");
    if (saved) setUserSettings(JSON.parse(saved));
  }, []);

  const [hubs, setHubs] = useState<import("../types").Hub[]>([]);
  const [selectedHub, setSelectedHub] = useState<import("../types").Hub | null>(null);
  const [hubPets, setHubPets] = useState<import("../types").HubPet[]>([]);

  const handleCloseModal = () => {
    if (modalStep === "form") {
      const confirmClose = window.confirm(
        "Are you sure you want to go back? Your current progress will be lost."
      );
      if (!confirmClose) return;
    }
    setIsModalOpen(false);
    setDuplicates([]);
    setSelectedCatId(null);
  };

  useEffect(() => {
    const fetchHubs = async () => {
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('../config/firebase');
        const snap = await getDocs(collection(db, 'hubs'));
        const fetchedHubs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setHubs(fetchedHubs.filter((h: any) => h.isActive !== false && h.status !== 'inactive'));
      } catch (err) {
        console.error("Failed to fetch hubs", err);
      }
    };
    fetchHubs();
  }, []);

  const handleSelectHub = async (hub: import("../types").Hub) => {
    setSelectedHub(hub);
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      const qPets = query(collection(db, 'pets'), where('hub_id', '==', hub.id));
      const snapPets = await getDocs(qPets);
      const fetchedPets = snapPets.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      const qStrays = query(collection(db, 'strays'), where('hub_id', '==', hub.id));
      const snapStrays = await getDocs(qStrays);
      const straysAsPets = snapStrays.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          hub_id: hub.id,
          name: d.name || d.animalType || "Stray",
          age: "Unknown",
          breed: "Unknown",
          status: "Resident Cat",
          photoDataUrl: d.imageUrl || null
        } as any;
      });

      setHubPets([...fetchedPets, ...straysAsPets]);
    } catch (err) {
      console.error("Failed to fetch hub pets", err);
    }
  };

  useEffect(() => {
    const fetchIpLocation = async (): Promise<[number, number]> => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        if (data.latitude && data.longitude) {
          return [data.latitude, data.longitude];
        }
      } catch (e) {}
      return [51.505, -0.09];
    };

    let watchId: number | null = null;
    let isMounted = true;

    const startTracking = async () => {
      const cached = safeGetStorage('session', "strayapp_pos");
      if (cached && isMounted) {
         try {
           const cachedPos = JSON.parse(cached);
           setPosition(cachedPos);
           setRecenterCounter((c) => c + 1);
         } catch(e) {}
      }

      let shouldAutoLocateLocal = safeGetStorage('local', "location_granted") === "true";
      if ("geolocation" in navigator && !shouldAutoLocateLocal) {
        try {
          if (navigator.permissions && navigator.permissions.query) {
            const result = await navigator.permissions.query({ name: "geolocation" as any });
            if (result.state === "granted") {
              shouldAutoLocateLocal = true;
              safeSetStorage('local', "location_granted", "true");
              setShouldAutoLocate(true);
            }
          }
        } catch (e) {}
      }

      if (shouldAutoLocateLocal) {
        safeSetStorage('session', "geo_asked_on_load", "true");
        
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (!isMounted) return;
            const newPos: [number, number] = [
              pos.coords.latitude,
              pos.coords.longitude,
            ];
            setPosition(newPos);
            safeSetStorage('session', "strayapp_pos", JSON.stringify(newPos));
            // Only seed on initial location update
            if (!safeGetStorage('session', "init_seeded")) {
              seedMockArea(newPos[0], newPos[1]);
              safeSetStorage('session', "init_seeded", "true");
            }
          },
          async (err) => {
             console.warn("Watch position not available", err);
             if (err.code === 1) { // PERMISSION_DENIED
               safeSetStorage('local', "location_granted", "false");
               setShouldAutoLocate(false);
             }
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        const defaultLoc = await fetchIpLocation();
        if (isMounted) {
          if (!safeGetStorage('session', "strayapp_pos")) {
            setPosition(defaultLoc);
            seedMockArea(defaultLoc[0], defaultLoc[1]);
            safeSetStorage('session', "strayapp_pos", JSON.stringify(defaultLoc));
          } else {
            seedMockArea(position ? position[0] : defaultLoc[0], position ? position[1] : defaultLoc[1]);
          }
        }
      }
    };

    if (!position || shouldAutoLocate) {
       startTracking();
    }
    
    return () => {
      isMounted = false;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [shouldAutoLocate]);

  const handleLogSightingClick = async () => {
    if (position) {
      setSightingPos(position);
      setActivities([]);
      setPhotoDataUrl(null);
      setShowAdditional(false);
      setTags([]);
      setTagInput("");
      setNotes("");
      setNameInput("");
      setAnimalTypeInput("Cat");
      setGenderInput(null);
      setSelectedCatId(null);

      // Open camera modal step
      setModalStep("camera");
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
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 800; // max width or height

          if (width > height) {
            if (width > MAX_SIZE) {
               height *= MAX_SIZE / width;
               width = MAX_SIZE;
            }
          } else {
             if (height > MAX_SIZE) {
               width *= MAX_SIZE / height;
               height = MAX_SIZE;
            }
          }

          canvas.width = Math.round(width);
          canvas.height = Math.round(height);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            // Output as JPEG with 0.7 quality to save space
            setPhotoDataUrl(canvas.toDataURL("image/jpeg", 0.7));
          } else {
            setPhotoDataUrl(ev.target?.result as string);
          }
          setIsCameraActive(false);

          if (position) {
            fetchNearbyCats(position[0], position[1], 500).then(nearby => {
              setDuplicates(nearby);
              setCurrentIdx(0);
              if (nearby.length === 0) {
                setSelectedCatId(null);
                setModalStep("form");
              } else {
                setModalStep("scan");
              }
              setIsModalOpen(true);
            });
          }
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      const val = tagInput.trim();
      if (val && !tags.includes(val)) setTags([...tags, val]);
      setTagInput("");
    }
  };

  const confirmSighting = async () => {
    if (!sightingPos) return;

    if (!photoDataUrl) {
      alert("A photo is required to submit a sighting.");
      return;
    }

    if (!selectedCatId && !nameInput.trim()) {
      setNameError(true);
      return;
    }
    
    if (!selectedCatId && !genderInput) {
      alert("Please select a gender.");
      return;
    }
    
    if (selectedCatId && feedStatusInput === null) {
      alert("Please select a feed status.");
      return;
    }
    
    setNameError(false);

    const [lat, lng] = sightingPos;

    let locationName = "";
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      );
      const data = await res.json();
      locationName = data.display_name || "";
    } catch (e) {}

    if (!locationName) {
      locationName =
        prompt(
          "Could not automatically determine the area name. Please enter a location name/address manually:",
          "Local Street or Landmark",
        ) || "";
      if (!locationName.trim()) {
        alert("A location name is required to submit a sighting.");
        return;
      }
    }

    setIsSubmitting(true);

    const geohash = geohashForLocation([lat, lng]);

    let residentHubId: string | undefined = undefined;
    let isResidentPet = false;

    if (!selectedCatId && hubs.length > 0) {
      let nearestHub: import("../types").Hub | null = null;
      let minDistance = Infinity;

      for (const hub of hubs) {
        if (hub.lat && hub.lng) {
          const dist = distanceBetween([lat, lng], [hub.lat, hub.lng]) * 1000;
          if (dist < minDistance) {
            minDistance = dist;
            nearestHub = hub;
          }
        }
      }

      if (minDistance <= 300 && nearestHub) {
        residentHubId = nearestHub.id;
        isResidentPet = true;
      }
    }

    const details = selectedCatId
      ? {
          catId: selectedCatId,
          wasFed: feedStatusInput === "Fed",
          healthStatus: healthStatusInput,
          activities,
          tags,
          notes,
          addToGallery,
          locationName,
        }
      : {
          name: nameInput,
          animalType: animalTypeInput,
          gender: genderInput,
          wasFed: activities.includes("Feed"),
          activities,
          tags,
          notes,
          locationName,
          hub_id: residentHubId,
          isResidentPet,
        };

    const submissionId = `sighting_${Date.now()}`;
    const reqBody = {
      id: submissionId,
      type: selectedCatId ? "check_in" : "sighting",
      details,
      imageBase64: photoDataUrl,
    };

    const processGamificationRewards = (createdCatId?: string) => {
      let titleToAward = "";
      const profileStr = localStorage.getItem("user_profile");
      if (profileStr) {
        try {
          const profile = JSON.parse(profileStr);
          if (!profile.gamification) profile.gamification = { total_xp:0, stray_submissions:0, check_ins:0 };
          if (!profile.unlocked_badges) profile.unlocked_badges = [];
          
          if (selectedCatId) {
             profile.gamification.check_ins = (profile.gamification.check_ins || 0) + 1;
             profile.gamification.total_xp = (profile.gamification.total_xp || 0) + 20;

             const newlyUnlocked = settings.achievements
               .filter(b => b.type === "checkins" && profile.gamification.check_ins >= b.threshold && !profile.unlocked_badges.includes(b.id))
               .sort((a, b) => b.threshold - a.threshold);
             
             if (newlyUnlocked.length > 0) {
               profile.unlocked_badges.push(newlyUnlocked[0].id);
               titleToAward = newlyUnlocked[0].title;
             }
          } else {
             profile.gamification.stray_submissions = (profile.gamification.stray_submissions || 0) + 1;
             profile.gamification.total_xp = (profile.gamification.total_xp || 0) + 50;

             const newlyUnlocked = settings.achievements
               .filter(b => b.type === "strays" && profile.gamification.stray_submissions >= b.threshold && !profile.unlocked_badges.includes(b.id))
               .sort((a, b) => b.threshold - a.threshold);
             
             if (newlyUnlocked.length > 0) {
               profile.unlocked_badges.push(newlyUnlocked[0].id);
               titleToAward = newlyUnlocked[0].title;
             }
          }

          if (titleToAward) {
             profile.active_title = titleToAward;
          }

          localStorage.setItem("user_profile", JSON.stringify(profile));
        } catch (e) {}
      }
      
      setIsModalOpen(false);
      if (titleToAward) {
         setEarnedTitle(titleToAward);
      } else {
         const targetId = selectedCatId || createdCatId;
         if (targetId) {
            navigate('/share', { replace: true, state: { 
               type: 'submission', 
               cat: selectedCatId ? cats.find(c => c.id === selectedCatId) : { id: targetId, name: nameInput || animalTypeInput || "Stray" }, 
               photoDataUrl,
               isCheckIn: !!selectedCatId,
               topName: selectedCatId ? undefined : (nameInput || animalTypeInput || "Stray")
            }});
         } else {
            navigate('/cats'); // Fallback
         }
      }
    };

    try {
      const submissionId = `sighting_${Date.now()}`;
      const reqBody = {
        id: submissionId,
        type: selectedCatId ? "check_in" : "sighting",
        details,
        imageBase64: photoDataUrl,
      };

      let docIdForReview = "";
      // Save locally to show in list as under review (don't save huge base64 string to firestore)
      if (selectedCatId) {
        const checkInRes = await addCheckInLog({
          catId: selectedCatId,
          wasFed: details.wasFed,
          healthStatus: (details as any).healthStatus || "Good",
          notes: details.notes || "",
          geo_point: null,
          photoDataUrl: null, // Defer image save to avoid Firestore limits until approved
          status: "under_review",
          submissionId,
          submittedBy: user?.uid,
        });
        docIdForReview = checkInRes.id;
        (reqBody.details as any).checkInId = checkInRes.id;
      } else {
        const res = await logNewSighting(
          lat,
          lng,
          geohash,
          {
            ...details,
            photoDataUrl: null,
            status: "under_review",
            submissionId,
            submittedBy: user?.uid,
          },
          true,
        );
        if (res.status === "created") {
          setSelectedCatId(res.id);
          reqBody.details.catId = res.id;
          docIdForReview = res.id;
        }
      }

      fetch("/api/submit-for-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...reqBody, docIdForReview }),
      })
      .then(res => res.json())
      .then(data => {
        if (reqBody.details.catId) {
          updateCatSighting(reqBody.details.catId, { 
            status: data.status, // might be 'approved' or 'under_review'
            isCheckIn: reqBody.type === "check_in",
            addToGallery: reqBody.details.addToGallery,
            ...(data.imageUrl ? { photoDataUrl: data.imageUrl } : {})
          });
        }
      })
      .catch(err => console.error("Background review failed", err));
      
      processGamificationRewards(docIdForReview);
    } catch (err: any) {
      console.error("Failed to submit:", err);
      // Offline fallback
      try {
        let offlineDocIdForReview = selectedCatId;
        if (selectedCatId) {
          await addCheckInLog({
            catId: selectedCatId,
            wasFed: details.wasFed,
            healthStatus: (details as any).healthStatus || "Good",
            notes: details.notes || "",
            geo_point: null,
            photoDataUrl: null,
            status: "approved",
            submittedBy: user?.uid,
          });
        } else {
          const res = await logNewSighting(
            lat,
            lng,
            geohash,
            { ...details, photoDataUrl: null, submittedBy: user?.uid },
            true,
          );
          if (res.status === "created") {
            setSelectedCatId(res.id);
            offlineDocIdForReview = res.id;
          }
        }
        processGamificationRewards(offlineDocIdForReview || undefined);
      } catch (offlineErr: any) {
        showError(
          err?.message || offlineErr?.message || "Connection error. Failed to save your submission."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!position)
    return (
      <div className="flex h-full w-full flex-col justify-center items-center bg-orange-500 absolute inset-0 z-[100]">
        <div className="w-32 h-32 bg-white rounded-full p-4 mb-8 shadow-2xl flex items-center justify-center animate-bounce">
          <img
            src="/logo.png"
            alt="Straykin"
            className="w-full h-full object-contain"
            onError={(e) => {
               (e.target as HTMLImageElement).outerHTML = '<div class="text-7xl animate-bounce">🐾</div>';
            }}
          />
        </div>
        <h1 className="text-4xl font-black text-white tracking-widest mb-4 drop-shadow-md">
          Straykin
        </h1>
        <p className="text-white/80 font-bold text-sm uppercase tracking-widest animate-pulse max-w-[250px] text-center">
          Gathering the strays in your area...
        </p>
      </div>
    );

  const savedCenterStr = sessionStorage.getItem("map_center");
  const savedZoomStr = sessionStorage.getItem("map_zoom");
  const initialCenter = savedCenterStr ? JSON.parse(savedCenterStr) : position;
  const initialZoom = savedZoomStr
    ? parseFloat(savedZoomStr)
    : mapConfig.defaultZoom;

  return (
    <div className="relative h-full w-full font-sans bg-[#e5e7eb]">
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        maxZoom={20}
        zoomControl={false}
        className="absolute inset-0 z-0"
      >
        <MapEvents updateViewport={updateViewport} onDragStart={() => setShouldAutoLocate(false)} />
        <TileLayer
          attribution={mapConfig.attribution}
          url={mapConfig.tileUrl}
          maxNativeZoom={19}
          maxZoom={20}
        />
        <LocateControl position={position} />
        {shouldAutoLocate && <AutoTracker position={position} updateViewport={updateViewport} />}
        <RecenterAction counter={recenterCounter} position={position} />

        {/* User Marker */}
        <Marker
          position={position}
          icon={L.divIcon({
            className: "user-marker bg-transparent border-0",
            html: `<div class="relative flex flex-col items-center">
                     <div class="w-12 h-12 bg-white text-orange-500 rounded-full border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.15)] flex items-center justify-center pointer-events-auto">
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                     </div>
                   </div>`,
            iconSize: [48, 48],
            iconAnchor: [24, 24],
          })}
        />

        {/* Hub Markers */}
        {hubs.filter((hub) => {
          if (!hub.hubType || hub.hubType === 'hub') return false;
          if (!mapFilters.vet && hub.hubType === 'vet') return false;
          if (!mapFilters.shelter && hub.hubType === 'shelter') return false;
          if (!mapFilters.cafe && hub.hubType === 'cafe') return false;
          if (!mapFilters.petshop && hub.hubType === 'petshop') return false;
          return true;
        }).map((hub) => (
          <Marker
            key={hub.id}
            position={[hub.lat, hub.lng]}
            icon={createHubMarkerIcon(hub.hubType)}
            eventHandlers={{
              click: () => {
                handleSelectHub(hub);
              }
            }}
          />
        ))}

        <MarkerClusterGroup 
          chunkedLoading 
          iconCreateFunction={createClusterCustomIcon}
          disableClusteringAtZoom={18}
        >
          {cats
            .filter((cat) => cat.status !== "rejected")
            .filter(() => mapFilters.stray)
            .map((cat) => (
              <Marker
                key={cat.id}
                position={[cat.lat, cat.lng]}
                icon={createMarkerIcon(isRecentlyFed(cat), cat.status)}
              >
                <Popup>
                  <div
                    className="font-sans flex items-center gap-3 pr-2"
                    style={{ margin: "-4px" }}
                  >
                    <div
                      onClick={() =>
                        setPendingNavigation({
                          url: `/cat/${cat.id}`,
                          alias: cat.name || cat.animalType || "Pet",
                          cat: cat
                        })
                      }
                      className="w-[4.5rem] h-[4.5rem] rounded-xl overflow-hidden shadow-sm shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {cat.imageUrl ? (
                        <img
                          src={cat.imageUrl}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="flex items-center justify-center h-full text-4xl bg-slate-100 border border-slate-200">
                          😿
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                      <span className="text-[10px] font-bold uppercase text-black tracking-wider mb-0.5">
                        {cat.animalType || "CAT"}{" "}
                        {cat.status === "under_review" && (
                          <span className="bg-amber-100 text-amber-700 text-[8px] uppercase font-black px-1 py-0.5 rounded ml-1">
                            Review
                          </span>
                        )}
                      </span>
                      <h3
                        className="font-black text-black text-2xl leading-none truncate"
                        style={{ letterSpacing: "-0.02em" }}
                      >
                        {cat.name || `Straykin`}
                      </h3>
                      <p className="text-[11px] text-slate-800 mt-1">
                        Last Seen nearby
                      </p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* No Cats Warning Box */}
      {cats.length === 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-slate-100 flex items-center justify-center pointer-events-none fade-in animate-in duration-500">
          <span className="text-sm font-bold text-slate-700">
            There are no Straykin nearby. Please add them!
          </span>
        </div>
      )}

      {/* Map Filters Container */}
      <div className="absolute top-4 right-4 z-[20] flex flex-row-reverse items-center gap-2">
        {/* Toggle Button */}
        <button
          onClick={() => setShowMapFilters(!showMapFilters)}
          className={`bg-white p-3 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border transition-all active:scale-95 z-10 relative ${showMapFilters ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-slate-100 text-slate-800 hover:bg-slate-50'}`}
        >
          <Filter className="w-5 h-5" />
        </button>

        {/* Filters Menu */}
        <AnimatePresence>
          {showMapFilters && (
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              {[
                { key: 'stray', label: 'Strays', icon: Cat, activeColor: 'text-orange-500 border-orange-500 bg-orange-50' },
                { key: 'vet', label: 'Vets', icon: Stethoscope, activeColor: 'text-emerald-600 border-emerald-600 bg-emerald-50' },
                { key: 'shelter', label: 'Shelters', icon: Home, activeColor: 'text-rose-600 border-rose-600 bg-rose-50' },
                { key: 'cafe', label: 'Cafes', icon: Coffee, activeColor: 'text-amber-600 border-amber-600 bg-amber-50' },
                { key: 'petshop', label: 'Shops', icon: ShoppingBag, activeColor: 'text-cyan-500 border-cyan-500 bg-cyan-50' },
              ].map(filter => {
                const Icon = filter.icon;
                const isActive = mapFilters[filter.key as keyof typeof mapFilters];
                return (
                  <button
                    key={filter.key}
                    onClick={() => setMapFilters(p => ({ ...p, [filter.key]: !p[filter.key as keyof typeof mapFilters] }))}
                    className={`p-2.5 rounded-full shadow-[0_4px_12px_rgb(0,0,0,0.08)] border-2 transition-all duration-200 flex items-center justify-center bg-white
                      ${isActive ? filter.activeColor : 'text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-50'}
                    `}
                    title={filter.label}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Guest Login Banner (Top Left) */}
      {(!user || user.isAnonymous) && !isMenuOpen && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 animate-in fade-in slide-in-from-top-4 duration-500 w-max max-w-[90vw]">
          <div className="bg-orange-500 border border-orange-400 text-white rounded-2xl p-3 shadow-lg flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="text-xs font-black leading-tight">
                Not registered?
              </p>
            </div>
            <button
              onClick={() => navigate("/login")}
              className="text-[10px] font-black bg-white text-orange-600 rounded-lg px-3 py-1.5 shadow-sm active:scale-95 whitespace-nowrap"
            >
              Log In
            </button>
          </div>
        </div>
      )}

      {/* Sponsored Ad Banner (Bottom Left) */}
      <div className="absolute left-6 right-[6rem] bottom-8 z-10 animate-in fade-in slide-in-from-bottom-4 duration-500 mb-0 w-[320px] h-[50px]">
        <AdBanner
          format="homeBanner"
          className="bg-white/90 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.1)] border-white/50"
        />
      </div>

      {/* Expandable FAB Menu */}
      <div className="absolute bottom-8 right-8 z-10 flex flex-col items-end gap-3 pointer-events-none">
        {isMenuOpen && (
          <div className="flex flex-col items-end gap-3 animate-in slide-in-from-bottom-2 fade-in zoom-in duration-200 pointer-events-auto">
            <button
              onClick={() => {
                setIsMenuOpen(false);
                navigate("/account");
              }}
              className="flex items-center gap-3 bg-white text-slate-800 px-5 py-3.5 rounded-[2rem] shadow-xl border border-slate-100 hover:bg-slate-50 transition-all active:scale-95 group"
            >
              <span className="font-bold text-sm tracking-wide">Account</span>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-slate-200 transition-colors">
                <CustomIcon
                  src="/icon-account.png"
                  FallbackIcon={User}
                  className="w-4 h-4"
                />
              </div>
            </button>
            <button
              onClick={() => {
                setIsMenuOpen(false);
                navigate("/cats");
              }}
              className="flex items-center gap-3 bg-white text-slate-800 px-5 py-3.5 rounded-[2rem] shadow-xl border border-slate-100 hover:bg-slate-50 transition-all active:scale-95 group"
            >
              <span className="font-bold text-sm tracking-wide">Nearby</span>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-slate-200 transition-colors">
                <CustomIcon
                  src="/icon-cats.png"
                  FallbackIcon={List}
                  className="w-4 h-4"
                />
              </div>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsMenuOpen(false);
                if ("geolocation" in navigator) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const newPos: [number, number] = [
                        pos.coords.latitude,
                        pos.coords.longitude,
                      ];
                      setPosition(newPos);
                      sessionStorage.setItem(
                        "strayapp_pos",
                        JSON.stringify(newPos),
                      );
                      localStorage.setItem("location_granted", "true");
                      setShouldAutoLocate(true);
                      setRecenterCounter((c) => c + 1);
                    },
                    (err) => {
                      console.error("GPS error", err);
                      setRecenterCounter((c) => c + 1);
                    },
                    { enableHighAccuracy: true },
                  );
                } else {
                  setRecenterCounter((c) => c + 1);
                }
              }}
              className="flex items-center gap-3 bg-white text-slate-800 px-5 py-3.5 rounded-[2rem] shadow-xl border border-slate-100 hover:bg-slate-50 transition-all active:scale-95 group"
            >
              <span className="font-bold text-sm tracking-wide">Recenter</span>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-slate-200 transition-colors">
                <CustomIcon
                  src="/icon-recenter.png"
                  FallbackIcon={MapPin}
                  className="w-4 h-4"
                />
              </div>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsMenuOpen(false);
                navigate('/hubs');
              }}
              className="flex items-center gap-3 bg-white text-slate-800 px-5 py-3.5 rounded-[2rem] shadow-xl border border-slate-100 hover:bg-slate-50 transition-all active:scale-95 group"
            >
              <span className="font-bold text-sm tracking-wide">Hub Center</span>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-slate-200 transition-colors">
                <MapPin className="w-4 h-4" />
              </div>
            </button>
            <button
              onClick={() => {
                setIsMenuOpen(false);
                handleLogSightingClick();
              }}
              className="flex items-center gap-3 bg-orange-500 text-white px-5 py-3.5 rounded-[2rem] shadow-xl shadow-orange-200 border border-transparent hover:bg-orange-600 transition-all active:scale-95 group"
            >
              <span className="font-bold text-sm tracking-wide">
                Find Stray
              </span>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors overflow-hidden">
                <CustomIcon
                  src="/icon-find.png"
                  FallbackIcon={Plus}
                  className="w-5 h-5 text-white"
                />
              </div>
            </button>
          </div>
        )}

        <div className="pointer-events-auto flex flex-col gap-3">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`w-[80px] h-[80px] mx-0 pt-0 mt-0 mb-[60px] rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.15)] border border-white flex items-center justify-center transition-all duration-300 active:scale-90 ${isMenuOpen ? "bg-orange-600 text-white rotate-45" : "bg-orange-500 text-white"}`}
          >
            <CustomIcon
              src="/icon-menu.png"
              FallbackIcon={Plus}
              className="w-[40px] h-[40px]"
            />
          </button>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40"
            onClick={handleCloseModal}
          ></div>

          {modalStep === "camera" ? (
            <div className="absolute inset-x-0 inset-y-0 bg-black z-50 flex flex-col pt-safe px-0 pb-0 overflow-hidden">
              {/* @ts-ignore */}
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                screenshotQuality={0.92}
                forceScreenshotSourceSize={true}
                videoConstraints={{ 
                  facingMode: "environment",
                  width: { ideal: 1920 },
                  height: { ideal: 1080 }
                }}
                className="absolute inset-0 w-full h-full object-cover"
              />

              <div className="relative flex-1 pointer-events-none flex flex-col justify-between">
                {/* Overlays */}
                <div className="p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
                  <button
                    onClick={handleCloseModal}
                    className="pointer-events-auto rounded-full w-10 h-10 flex items-center justify-center text-white bg-black/30 backdrop-blur-md"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <h2 className="text-white font-bold text-lg tracking-wide drop-shadow-md">
                    Capture Straykin
                  </h2>
                  <div className="w-10" /> {/* Spacer */}
                </div>

                {/* Viewfinder brackets */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[75vw] h-[55vw] max-w-[300px] max-h-[220px]">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white drop-shadow-md rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white drop-shadow-md rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white drop-shadow-md rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white drop-shadow-md rounded-br-xl" />
                </div>

                {/* Bottom Controls */}
                <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent p-8 pb-safe-12 flex justify-center items-center pointer-events-auto w-full">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      captureWebcam();
                    }}
                    className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-[0_0_0_6px_rgba(249,115,22,0.5)] active:scale-95 transition-transform"
                  >
                    <div className="w-16 h-16 rounded-full border-2 border-slate-200 flex items-center justify-center bg-white">
                      <div className="w-8 h-8 bg-orange-500 rounded-full" />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : (
          <div className={`relative bg-white z-50 overflow-y-auto ${modalStep === "scan" && displayItems.length > 5 ? "w-full h-full max-h-[100dvh] rounded-none p-6 pb-safe sm:max-w-md sm:rounded-[3rem] sm:max-h-[90vh]" : "w-full max-w-[400px] rounded-[3rem] p-8 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-100 max-h-[90vh]"}`}>
            {modalStep === "guide" ? (
              <>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800">
                      Photo Guide
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">
                      How to take a great photo
                    </p>
                  </div>
                  <button
                    onClick={handleCloseModal}
                    className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors shrink-0"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="flex flex-col gap-4 text-slate-600 mb-8 font-medium">
                  <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl">
                    <span className="text-2xl">📸</span>
                    <p className="text-sm">Ensure the stray is clearly visible and well-lit.</p>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl">
                    <span className="text-2xl">🐈</span>
                    <p className="text-sm">Keep a safe distance so you don't scare them.</p>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl">
                    <span className="text-2xl">🔍</span>
                    <p className="text-sm">Avoid blurry photos by holding your phone steady.</p>
                  </div>
                </div>
                <button
                  onClick={() => setModalStep("camera")}
                  className="w-full py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 bg-orange-500 text-white shadow-lg shadow-orange-200 hover:bg-orange-600 active:scale-[0.98]"
                >
                  <Plus className="w-5 h-5" />
                  Open Camera
                </button>
              </>
            ) : modalStep === "scan" ? (
                <>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <h2 className="text-xl font-black text-slate-800">
                          Match Straykin
                        </h2>
                        <p className="text-sm text-slate-500 font-medium tracking-tight">
                          Select the one you saw
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleCloseModal}
                      className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {(duplicates.length > 5 || searchQuery) && (
                    <input 
                      type="text" 
                      placeholder="Search name or type..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 mb-4 text-sm font-medium outline-none focus:border-orange-400 focus:bg-white transition-colors"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  )}

                  {displayItems.length > 5 ? (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      {displayItems.map((item, idx) => (
                        <div key={idx}>
                          <div className="relative w-full aspect-[4/5] bg-slate-100 rounded-3xl overflow-hidden shadow-sm border border-slate-200 mb-3">
                            <div className="w-full h-full relative" style={{ perspective: "1000px" }}>
                              <motion.div 
                                className="absolute inset-0 w-full h-full"
                                initial={false}
                                animate={{ rotateY: comparingPhotoId === item.data?.id ? 180 : 0 }}
                                transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 20 }}
                                style={{ transformStyle: "preserve-3d" }}
                              >
                                {/* Front: Existing Photo */}
                                <div className="absolute inset-0 w-full h-full" style={{ backfaceVisibility: "hidden" }}>
                                  {item.data?.imageUrl ? (
                                    <img
                                      src={item.data!.imageUrl}
                                      className="w-full h-full object-cover pointer-events-none bg-slate-100"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-6xl pointer-events-none bg-slate-100">
                                      🐈
                                    </div>
                                  )}
                                </div>

                                {/* Back: Captured Photo */}
                                <div className="absolute inset-0 w-full h-full" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                                  {photoDataUrl && (
                                    <img
                                      src={photoDataUrl}
                                      className="w-full h-full object-cover pointer-events-none bg-slate-100"
                                    />
                                  )}
                                </div>
                              </motion.div>
                              <div className="absolute right-4 bottom-4 z-20 pointer-events-auto">
                                <button
                                  onPointerDown={(e) => { e.preventDefault(); setComparingPhotoId(item.data?.id || null); }}
                                  onPointerUp={(e) => { e.preventDefault(); setComparingPhotoId(null); }}
                                  onPointerLeave={(e) => { e.preventDefault(); setComparingPhotoId(null); }}
                                  className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-md text-white shadow-lg border border-white/20 hover:bg-black/80 transition-colors flex items-center justify-center select-none active:scale-95"
                                >
                                  <ArrowLeftRight className="w-6 h-6 pointer-events-none" />
                                </button>
                              </div>
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pt-16 text-white pointer-events-none z-10 flex flex-col justify-end">
                                <div>
                                  <span className="bg-indigo-500/90 text-white px-2 py-0.5 rounded-full text-[10px] font-black shadow-sm mb-1 inline-block uppercase tracking-wider">
                                    {item.data?.animalType || "Cat"}
                                  </span>
                                  <h3 className="text-2xl font-black">
                                    {item.data?.name || `Straykin #${item.data?.id.slice(-4)}`}
                                  </h3>
                                  <p className="text-sm font-medium opacity-90 mt-1">
                                    Logged {item.data?.last_check_in?.was_fed ? "as fed" : "recently"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedCatId(item.data?.id || null);
                              setModalStep("form");
                            }}
                            className="w-full py-4 rounded-2xl bg-orange-500 text-white font-bold shadow-lg shadow-orange-200 hover:bg-orange-600 transition-colors"
                          >
                            Yep, this is them!
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : displayItems.length > 0 && currentIdx < displayItems.length ? (
                    <>
                      <div className="relative w-full aspect-[4/5] bg-slate-100 rounded-3xl overflow-hidden mb-6 shadow-sm border border-slate-200">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={currentIdx}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            onDragEnd={(event, info) => {
                              if (info.offset.x > 50) {
                                setCurrentIdx((prev) => Math.max(prev - 1, 0));
                              } else if (info.offset.x < -50) {
                                setCurrentIdx((prev) =>
                                  Math.min(prev + 1, displayItems.length - 1),
                                );
                              }
                            }}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="w-full h-full cursor-grab active:cursor-grabbing"
                          >
                            <div className="w-full h-full relative" style={{ perspective: "1000px" }}>
                              <motion.div 
                                className="absolute inset-0 w-full h-full"
                                initial={false}
                                animate={{ rotateY: comparingPhotoId === displayItems[currentIdx].data?.id ? 180 : 0 }}
                                transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 20 }}
                                style={{ transformStyle: "preserve-3d" }}
                              >
                                {/* Front: Existing Photo */}
                                <div className="absolute inset-0 w-full h-full" style={{ backfaceVisibility: "hidden" }}>
                                  {displayItems[currentIdx].data?.imageUrl ? (
                                    <img
                                      src={displayItems[currentIdx].data!.imageUrl}
                                      className="w-full h-full object-cover pointer-events-none bg-slate-100"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-6xl pointer-events-none bg-slate-100">
                                      🐈
                                    </div>
                                  )}
                                </div>

                                {/* Back: Captured Photo */}
                                <div className="absolute inset-0 w-full h-full" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                                  {photoDataUrl && (
                                    <img
                                      src={photoDataUrl}
                                      className="w-full h-full object-cover pointer-events-none bg-slate-100"
                                    />
                                  )}
                                </div>
                              </motion.div>
                              <div className="absolute right-4 bottom-4 z-20 pointer-events-auto">
                                <button
                                  onPointerDown={(e) => { e.preventDefault(); setComparingPhotoId(displayItems[currentIdx].data?.id || null); }}
                                  onPointerUp={(e) => { e.preventDefault(); setComparingPhotoId(null); }}
                                  onPointerLeave={(e) => { e.preventDefault(); setComparingPhotoId(null); }}
                                  className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-md text-white shadow-lg border border-white/20 hover:bg-black/80 transition-colors flex items-center justify-center select-none active:scale-95"
                                >
                                  <ArrowLeftRight className="w-6 h-6 pointer-events-none" />
                                </button>
                              </div>
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pt-16 text-white pointer-events-none z-10 flex flex-col justify-end">
                                <div>
                                  <span className="bg-indigo-500/90 text-white px-2 py-0.5 rounded-full text-[10px] font-black shadow-sm mb-1 inline-block uppercase tracking-wider">
                                    {displayItems[currentIdx].data?.animalType || "Cat"}
                                  </span>
                                  <h3 className="text-2xl font-black">
                                    {displayItems[currentIdx].data?.name ||
                                      `Straykin #${displayItems[currentIdx].data?.id.slice(-4)}`}
                                  </h3>
                                  <p className="text-sm font-medium opacity-90 mt-1">
                                    Logged{" "}
                                    {displayItems[currentIdx].data?.last_check_in?.was_fed
                                      ? "as fed"
                                      : "recently"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      <div className="flex gap-3 mb-4">
                        <button
                          onClick={() => {
                            setSelectedCatId(displayItems[currentIdx].data?.id || null);
                            setModalStep("form");
                          }}
                          className="w-full py-4 rounded-2xl bg-orange-500 text-white font-bold shadow-lg shadow-orange-200 hover:bg-orange-600 transition-colors"
                        >
                          Yep, this is them!
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-10 mb-4 bg-slate-50 rounded-3xl border border-slate-100">
                      <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">
                        😿
                      </div>
                      <h3 className="font-bold text-slate-800 text-xl">
                        No Straykin Nearby
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        There are no Straykin in this area.
                        <br />
                        Please add them!
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 mt-4">
                    <button
                      onClick={() => {
                        setSelectedCatId(null);
                        setModalStep("form");
                      }}
                      className={`w-full py-4 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2 ${displayItems.length > 0 && currentIdx < displayItems.length ? "border border-slate-200 text-slate-600 hover:bg-slate-50" : "bg-orange-500 text-white shadow-lg shadow-orange-200 hover:bg-orange-600"}`}
                    >
                      <Plus className="w-5 h-5" />
                      Report New Straykin
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-2xl font-black text-slate-800">
                        Stray Sighting
                      </h2>
                      <p className="text-sm text-slate-500 font-medium">
                        {selectedCatId
                          ? "Update status for this straykin."
                          : "Record a new community cat."}
                      </p>
                    </div>
                    <button
                      onClick={handleCloseModal}
                      className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors shrink-0"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {selectedCatId &&
                      (() => {
                        const cat = cats.find((c) => c.id === selectedCatId);
                        if (!cat) return null;
                        return (
                          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                            <div className="w-16 h-16 bg-slate-200 rounded-2xl overflow-hidden shrink-0">
                              {cat.imageUrl ? (
                                <img
                                  src={cat.imageUrl}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-orange-100 flex items-center justify-center text-2xl">
                                  🐈
                                </div>
                              )}
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                              <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider mb-0.5">
                                {cat.animalType || "Cat"}
                              </span>
                              <h3 className="text-lg font-bold text-slate-800 leading-tight">
                                {cat.name || `Straykin #${cat.id.slice(-4)}`}
                              </h3>
                              <p className="text-xs text-slate-500 font-medium mt-1">
                                Last seen:{" "}
                                {new Date(
                                  (cat.last_check_in?.timestamp as any)
                                    ?.seconds * 1000,
                                ).toLocaleDateString() ?? "Unknown"}
                              </p>
                            </div>
                          </div>
                        );
                      })()}

                    {/* Photo Upload */}
                    <div className="relative w-full h-40 rounded-3xl overflow-hidden bg-slate-100 border border-slate-200 flex flex-col group">
                      {photoDataUrl ? (
                        <>
                          <img
                            src={photoDataUrl}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setModalStep("camera");
                            }}
                            className="absolute top-2 right-2 bg-black/60 backdrop-blur text-white text-xs font-bold px-3 py-1.5 rounded-full z-10 transition-opacity"
                          >
                            Retake
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setModalStep("camera")}
                          className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-orange-500 hover:bg-slate-50 transition-colors relative z-10"
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
                        <span className="text-sm font-bold text-slate-800">
                          Add to Gallery
                        </span>
                        <button
                          onClick={() => setAddToGallery(!addToGallery)}
                          className={`w-12 h-6 rounded-full relative transition-colors ${addToGallery ? "bg-orange-500" : "bg-slate-300"}`}
                        >
                          <span
                            className={`absolute top-1 bottom-1 w-4 bg-white rounded-full transition-all ${addToGallery ? "left-7" : "left-1"}`}
                          ></span>
                        </button>
                      </div>
                    )}

                    {/* Category & Name Input (New Cat Only) */}
                    {!selectedCatId && (
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-bold text-slate-800 mb-2">
                            Category
                          </p>
                          <div className="flex gap-2">
                            {["Cat", "Dog", "Other"].map((type) => (
                              <button
                                key={type}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setAnimalTypeInput(type as any);
                                }}
                                className={`flex-1 py-3 rounded-2xl border text-sm font-bold transition-all ${animalTypeInput === type ? "bg-orange-100 border-orange-500 text-orange-600" : "bg-slate-50 border-slate-200 text-slate-600"}`}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-sm font-bold text-slate-800">
                              Name
                            </p>
                            {nameError && (
                              <span className="text-xs font-bold text-red-500 animate-in fade-in">
                                Required
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={nameInput}
                            onChange={(e) => {
                              const val = e.target.value.replace(
                                /[^A-Za-z\s]/g,
                                "",
                              );
                              if (val.length <= 16) {
                                setNameInput(val);
                                if (val.trim()) setNameError(false);
                              }
                            }}
                            placeholder="What should we call them?"
                            className={`w-full bg-slate-50 border rounded-2xl px-4 py-3.5 text-sm font-medium outline-none transition-colors ${nameError ? "border-red-400 focus:border-red-500" : "border-slate-200 focus:border-orange-400 focus:bg-white"}`}
                          />
                        </div>
                      </div>
                    )}

                    {/* Gender Selection (New Cat Only) */}
                    {!selectedCatId && (
                      <div className="space-y-4 pt-4">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-sm font-bold text-slate-800">
                            Gender
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setGenderInput("Male");
                            }}
                            className={`flex-1 py-3 rounded-2xl border text-sm font-bold transition-all ${genderInput === "Male" ? "bg-orange-100 border-orange-500 text-orange-600" : "bg-slate-50 border-slate-200 text-slate-600"}`}
                          >
                            Male
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setGenderInput("Female");
                            }}
                            className={`flex-1 py-3 rounded-2xl border text-sm font-bold transition-all ${genderInput === "Female" ? "bg-orange-100 border-orange-500 text-orange-600" : "bg-slate-50 border-slate-200 text-slate-600"}`}
                          >
                            Female
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Check In Only Fields */}
                    {selectedCatId && (
                      <div className="space-y-4 pt-4">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-sm font-bold text-slate-800">
                              Did you feed them?
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                setFeedStatusInput("Fed");
                              }}
                              className={`flex-1 py-3 rounded-2xl border text-sm font-bold transition-all ${feedStatusInput === "Fed" ? "bg-orange-100 border-orange-500 text-orange-600" : "bg-slate-50 border-slate-200 text-slate-600"}`}
                            >
                              Yes, Fed
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                setFeedStatusInput("Not Fed");
                              }}
                              className={`flex-1 py-3 rounded-2xl border text-sm font-bold transition-all ${feedStatusInput === "Not Fed" ? "bg-orange-100 border-orange-500 text-orange-600" : "bg-slate-50 border-slate-200 text-slate-600"}`}
                            >
                              No
                            </button>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-sm font-bold text-slate-800">
                              Health Condition
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {["Good", "Injured", "Sick"].map((status) => (
                              <button
                                key={status}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setHealthStatusInput(status);
                                }}
                                className={`flex-1 py-3 rounded-2xl border text-sm font-bold transition-all ${healthStatusInput === status ? "bg-orange-100 border-orange-500 text-orange-600" : "bg-slate-50 border-slate-200 text-slate-600"}`}
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Additional Information Toggle */}
                    <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100">
                      <button
                        onClick={() => setShowAdditional(!showAdditional)}
                        className="flex items-center justify-between w-full font-bold text-sm text-slate-800"
                      >
                        Add More Information
                        <Plus
                          className={`w-5 h-5 transition-transform ${showAdditional ? "rotate-45 text-orange-500" : "text-slate-400"}`}
                        />
                      </button>

                      {showAdditional && (
                        <div className="mt-5 space-y-5 animate-in fade-in slide-in-from-top-2">
                          {/* Activities */}
                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2.5">
                              Activities
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {["Feed", "Stroke", "Play"].map((act) => (
                                <button
                                  key={act}
                                  onClick={() =>
                                    setActivities((prev) =>
                                      prev.includes(act)
                                        ? prev.filter((a) => a !== act)
                                        : [...prev, act],
                                    )
                                  }
                                  className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors ${activities.includes(act) ? "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                                >
                                  {act}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">
                              Characteristics Tags
                            </p>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="bg-slate-200 text-slate-700 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                                >
                                  {tag}
                                  <button
                                    onClick={() =>
                                      setTags(tags.filter((t) => t !== tag))
                                    }
                                    className="hover:text-red-500"
                                  >
                                    &times;
                                  </button>
                                </span>
                              ))}
                            </div>
                            <input
                              type="text"
                              value={tagInput}
                              onChange={(e) => setTagInput(e.target.value)}
                              onKeyDown={handleTagKeyDown}
                              placeholder="Type characteristic and press Space"
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 transition-colors"
                            />
                          </div>

                          <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">
                              Notes
                            </p>
                            <textarea
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
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
                      className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 ${isSubmitting ? "bg-orange-400 cursor-not-allowed" : "bg-orange-500 hover:bg-orange-600 active:scale-[0.98]"} text-white font-bold shadow-xl shadow-orange-200 transition-all`}
                    >
                      {!isSubmitting && (
                        <CustomIcon
                          src="/icon-submit.png"
                          FallbackIcon={Plus}
                          className="w-5 h-5"
                        />
                      )}
                      {isSubmitting
                        ? photoDataUrl
                          ? "Submitting..."
                          : "Analyzing Image..."
                        : "Submit"}
                    </button>
                  </div>
                </>
              )}
            </div>
            )}
        </div>
      )}

      {/* Share Modal */}
      {earnedTitle && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95">
            <div className="w-20 h-20 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mb-4">
              <Trophy className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 text-center uppercase tracking-wide">
              Congratulations!
            </h3>
            <p className="text-sm font-bold text-slate-500 text-center mb-4 leading-relaxed">
              You earned a new title:<br />
              <span className="text-xl text-indigo-600 block mt-2">{earnedTitle}</span>
            </p>
            <button
              onClick={() => {
                setEarnedTitle("");
                navigate('/share', { replace: true, state: { 
                   type: 'submission', 
                   cat: selectedCatId ? cats.find(c => c.id === selectedCatId) : undefined, 
                   photoDataUrl,
                   topName: selectedCatId ? undefined : (nameInput || animalTypeInput || "Stray")
                }});
              }}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-600/30 hover:bg-indigo-700"
            >
              Awesome!
            </button>
          </div>
        </div>
      )}



      {pendingNavigation && (
        <InterstitialAd
          isOpen={true}
          targetAlias={pendingNavigation.alias}
          onComplete={() => {
            navigate(pendingNavigation.url, { state: { cat: pendingNavigation.cat, pet: pendingNavigation.cat } });
            setPendingNavigation(null);
          }}
          onCancel={() => setPendingNavigation(null)}
        />
      )}

      {selectedHub && (
        <div className="fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in transition-all">
          <div className="bg-white w-full max-w-lg rounded-t-[2rem] sm:rounded-[2rem] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative animate-in slide-in-from-bottom">
            <button
              onClick={() => setSelectedHub(null)}
              className="absolute top-4 right-4 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center z-10 hover:bg-black/60 backdrop-blur-sm"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="h-48 shrink-0 bg-slate-200 relative">
              {selectedHub.photoUrl ? (
                <img src={selectedHub.photoUrl} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-300">
                   <ImageIcon className="w-16 h-16" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <h2 className="text-white font-black text-2xl leading-none shadow-sm drop-shadow-md">{selectedHub.name}</h2>
                <div className="flex items-center text-indigo-100 text-xs font-medium mt-1">
                  <MapPin className="w-3 h-3 mr-1" />
                  {selectedHub.address}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
               <p className="text-slate-600 text-sm leading-relaxed mb-6">{selectedHub.description || "No description provided."}</p>
               
               {selectedHub.socialMediaUrls && selectedHub.socialMediaUrls.length > 0 && (
                  <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
                     {selectedHub.socialMediaUrls.map((url, i) => (
                        <a key={i} href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-indigo-100">
                          {url.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                     ))}
                  </div>
               )}

               <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                 <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                   Pets at this Hub
                   <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-[10px] uppercase font-black tracking-widest">{hubPets.length}</span>
                 </h3>
                 <div className="space-y-3">
                   {hubPets.length > 0 ? hubPets.map(pet => (
                     <div key={pet.id} className="flex gap-4 items-center bg-slate-50 p-2 rounded-xl">
                       {pet.photoDataUrl ? (
                         <img src={pet.photoDataUrl} className="w-14 h-14 rounded-lg object-cover" />
                       ) : (
                         <div className="w-14 h-14 rounded-lg bg-slate-200 flex items-center justify-center border border-slate-300">🐾</div>
                       )}
                       <div className="flex-1 min-w-0">
                         <h4 className="font-bold text-slate-800 truncate leading-tight">{pet.name}</h4>
                         <p className="text-xs text-slate-500 truncate">{pet.breed} • {pet.age}</p>
                       </div>
                       <div>
                         <span className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${pet.status === 'Resident Cat' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                           {pet.status === 'Resident Cat' ? 'Resident' : 'Adoption'}
                         </span>
                       </div>
                     </div>
                   )) : (
                     <div className="text-center p-4">
                       <span className="text-sm font-medium text-slate-400">No pets listed here.</span>
                     </div>
                   )}
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
