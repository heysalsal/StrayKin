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
} from "lucide-react";
import { mapConfig } from "../config/map";
import { CatRecord } from "../types";
import { CustomIcon } from "./CustomIcon";
import { AdBanner } from "./AdBanner";
import { motion, AnimatePresence } from "motion/react";

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

function MapEvents({ updateViewport }: { updateViewport?: (lat: number, lng: number, radiusM: number) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const center = [map.getCenter().lat, map.getCenter().lng] as [number, number];
      sessionStorage.setItem("map_center", JSON.stringify(center));
      sessionStorage.setItem("map_zoom", map.getZoom().toString());
      
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

function LocateControl({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position && !sessionStorage.getItem("map_center")) {
      map.flyTo(position, 20);
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
      map.flyTo(position, 20);
      prevCounter.current = counter;
    }
  }, [counter, position, map]);
  return null;
}

import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";
import { InterstitialAd } from "../config/InterstitialAd";
import { distanceBetween } from "geofire-common";

export default function MapView() {
  const navigate = useNavigate();
  // Initialize from sessionStorage if possible
  const [position, setPosition] = useState<[number, number] | null>(() => {
    const cached = sessionStorage.getItem("strayapp_pos");
    return cached ? JSON.parse(cached) : null;
  });

  const [recenterCounter, setRecenterCounter] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [modalStep, setModalStep] = useState<"scan" | "form">("scan");
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<{
    url: string;
    alias: string;
    cat?: any;
  } | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);

  const [duplicates, setDuplicates] = useState<CatRecord[]>([]);

  const displayItems = React.useMemo(() => {
    const items: { type: "cat" | "ad"; data?: CatRecord }[] = [];
    duplicates.forEach((cat, index) => {
      items.push({ type: "cat", data: cat });
      if ((index + 1) % 3 === 0) {
        items.push({ type: "ad" });
      }
    });
    return items;
  }, [duplicates]);

  const [sightingPos, setSightingPos] = useState<[number, number] | null>(null);

  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [reportStep, setReportStep] = useState<"camera" | "form">("camera");
  const [photoAttempts, setPhotoAttempts] = useState(0);
  const webcamRef = useRef<Webcam>(null);
  const [nameInput, setNameInput] = useState("");
  const [animalTypeInput, setAnimalTypeInput] = useState<
    "Cat" | "Dog" | "Other"
  >("Cat");
  const [genderInput, setGenderInput] = useState<"Male" | "Female" | "Unknown">(
    "Unknown",
  );
  const [activities, setActivities] = useState<string[]>([]);
  const [showAdditional, setShowAdditional] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState("");
  const [addToGallery, setAddToGallery] = useState(true);

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareImgSrc, setShareImgSrc] = useState<string | undefined>();
  const [shareFinalImage, setShareFinalImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    cats,
    logNewSighting,
    updateCatSighting,
    seedMockArea,
    fetchNearbyCats,
    refreshCats,
    updateViewport,
  } = useCatDatabase();
  const { user, loading: authLoading, upgradeToGoogleAccount, signInAnonymouslyIfNeeded } = useLazyAuth();

  useEffect(() => {
    if (isShareOpen) {
      const src = photoDataUrl || (selectedCatId && cats.find((c) => c.id === selectedCatId)?.imageUrl) || "";
      if (src && src.startsWith("http")) {
        fetch(`/api/proxy-image?url=${encodeURIComponent(src)}`)
          .then(res => res.blob())
          .then(blob => {
            const reader = new FileReader();
            reader.onloadend = () => setShareImgSrc(reader.result as string);
            reader.readAsDataURL(blob);
          }).catch(() => setShareImgSrc(src));
      } else {
        setShareImgSrc(src);
      }
    }
  }, [isShareOpen, photoDataUrl, selectedCatId]);

  useEffect(() => {
    if (!authLoading && !user) {
      signInAnonymouslyIfNeeded();
    }
  }, [authLoading, user, signInAnonymouslyIfNeeded]);

  // Missing address notification
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      const asked = sessionStorage.getItem("notif_asked");
      if (!asked) {
        sessionStorage.setItem("notif_asked", "true");
        Notification.requestPermission();
      }
    }
  }, []);

  useEffect(() => {
    if (!position || cats.length === 0) return;

    // Auto-fix the specific wrongly rejected sighting
    if (!sessionStorage.getItem("fixed_sighting_v2")) {
      const brokenCat = cats.find(
        (c) =>
          c.submissionId === "sighting_178030403357" ||
          c.submissionId === "sighting_1780304033576",
      );
      if (brokenCat) {
        updateCatSighting(brokenCat.id, {
          status: "approved",
          submissionId: null,
        }).catch(() => {});
      }
      sessionStorage.setItem("fixed_sighting_v2", "true");
    }

    if (sessionStorage.getItem("notified_missing_address")) return;

    const nearby = cats.filter((cat) => {
      if (cat.status !== "approved") return false;
      const distMeters = distanceBetween([cat.lat, cat.lng], position) * 1000;
      return distMeters <= 50; // Using 50 meters like AllCatsList
    });

    const missing = nearby.filter((c) => !c.locationName);
    if (missing.length > 0) {
      sessionStorage.setItem("notified_missing_address", "true");
      if (Notification.permission === "granted") {
        const n = new Notification("Straykin Area Check", {
          body: `${missing.length} nearby stray(s) missing an address. Tap to help update!`,
          icon: "/favicon.png",
        });
        n.onclick = () => {
          window.focus();
          navigate("/cats");
          n.close();
        };
      }
    }
  }, [position, cats, navigate]);

  const [userSettings, setUserSettings] = useState({
    displayName: "",
    isAnonymous: false,
  });
  useEffect(() => {
    const saved = localStorage.getItem("user_settings");
    if (saved) setUserSettings(JSON.parse(saved));
  }, []);

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

    const locateAndSeed = async () => {
      const cached = sessionStorage.getItem("strayapp_pos");
      if (cached) {
         try {
           const cachedPos = JSON.parse(cached);
           setPosition(cachedPos);
           setRecenterCounter((c) => c + 1);
           return;
         } catch(e) {}
      }

      let shouldAutoLocate = localStorage.getItem("location_granted") === "true";
      if ("geolocation" in navigator && !shouldAutoLocate) {
        try {
          const result = await navigator.permissions.query({ name: "geolocation" });
          if (result.state === "granted") {
            shouldAutoLocate = true;
          }
        } catch (e) {}
      }

      if (shouldAutoLocate) {
        sessionStorage.setItem("geo_asked_on_load", "true");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const newPos: [number, number] = [
              pos.coords.latitude,
              pos.coords.longitude,
            ];
            setPosition(newPos);
            sessionStorage.setItem("strayapp_pos", JSON.stringify(newPos));
            seedMockArea(newPos[0], newPos[1]);
            setRecenterCounter((c) => c + 1); // trigger recenter
          },
          async () => {
            const defaultLoc = await fetchIpLocation();
            if (!sessionStorage.getItem("strayapp_pos")) {
              setPosition(defaultLoc);
              seedMockArea(defaultLoc[0], defaultLoc[1]);
              sessionStorage.setItem("strayapp_pos", JSON.stringify(defaultLoc));
            } else {
              seedMockArea(position ? position[0] : defaultLoc[0], position ? position[1] : defaultLoc[1]);
            }
          },
          { timeout: 5000 },
        );
      } else {
        const defaultLoc = await fetchIpLocation();
        if (!sessionStorage.getItem("strayapp_pos")) {
          setPosition(defaultLoc);
          seedMockArea(defaultLoc[0], defaultLoc[1]);
          sessionStorage.setItem("strayapp_pos", JSON.stringify(defaultLoc));
        } else {
          seedMockArea(position ? position[0] : defaultLoc[0], position ? position[1] : defaultLoc[1]);
        }
      }
    };

    if (!position) {
      locateAndSeed();
    }
  }, []);

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
      setGenderInput("Unknown");
      setSelectedCatId(null);

      const nearby = await fetchNearbyCats(position[0], position[1], 50);
      setDuplicates(nearby);
      setCurrentIdx(0);
      setModalStep("scan");
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
      setReportStep("form");
    }
  }, [webcamRef]);

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

    const details = selectedCatId
      ? {
          catId: selectedCatId,
          wasFed: activities.includes("Feed"),
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
        };

    const submissionId = `sighting_${Date.now()}`;
    const reqBody = {
      id: submissionId,
      type: selectedCatId ? "check_in" : "sighting",
      details,
      imageBase64: photoDataUrl,
    };

    try {
      const submissionId = `sighting_${Date.now()}`;
      const reqBody = {
        id: submissionId,
        type: selectedCatId ? "check_in" : "sighting",
        details,
        imageBase64: photoDataUrl,
      };

      await fetch("/api/submit-for-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      alert("Sighting submitted and is under review!");

      // Save locally to show in list as under review (don't save huge base64 string to firestore)
      if (selectedCatId) {
        await updateCatSighting(selectedCatId, {
          ...details,
          photoDataUrl: null, // Defer image save to avoid Firestore limits until approved
          status: "under_review",
          submissionId,
          submittedBy: user?.uid,
        });
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
        }
      }

      setIsModalOpen(false);
      setIsShareOpen(true);
    } catch (err) {
      console.error("Failed to submit:", err);
      // Offline fallback
      if (selectedCatId) {
        await updateCatSighting(selectedCatId, {
          ...details,
          photoDataUrl: null,
        });
      } else {
        const res = await logNewSighting(
          lat,
          lng,
          geohash,
          { ...details, photoDataUrl: null, submittedBy: user?.uid },
          true,
        );
        if (res.status === "created") setSelectedCatId(res.id);
      }
      alert(
        "Submitted (offline preview mode). Image stripped due to offline fallback size limits.",
      );
      setIsModalOpen(false);
      setIsShareOpen(true);
    }

    setIsSubmitting(false);
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
        <MapEvents updateViewport={updateViewport} />
        <TileLayer
          attribution={mapConfig.attribution}
          url={mapConfig.tileUrl}
          maxNativeZoom={19}
          maxZoom={20}
        />
        <LocateControl position={position} />
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

        {cats
          .filter((cat) => cat.status !== "rejected")
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
      </MapContainer>

      {/* No Cats Warning Box */}
      {cats.length === 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-slate-100 flex items-center justify-center pointer-events-none fade-in animate-in duration-500">
          <span className="text-sm font-bold text-slate-700">
            There are no Straykin nearby. Please add them!
          </span>
        </div>
      )}

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
                refreshCats();
              }}
              className="flex items-center gap-3 bg-white text-slate-800 px-5 py-3.5 rounded-[2rem] shadow-xl border border-slate-100 hover:bg-slate-50 transition-all active:scale-95 group"
            >
              <span className="font-bold text-sm tracking-wide">Refresh</span>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-slate-200 transition-colors">
                <RefreshCcw className="w-4 h-4" />
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
            onClick={() => {
              setIsModalOpen(false);
              setDuplicates([]);
            }}
          ></div>

          {modalStep === "form" && reportStep === "camera" ? (
            <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center animate-in zoom-in-95">
              {/* @ts-ignore */}
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "environment" }}
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Header */}
              <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <h2 className="text-white font-black text-xl tracking-tight">
                  Focus on Straykin
                </h2>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setDuplicates([]);
                  }}
                  className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Capture button */}
              <div className="absolute bottom-0 inset-x-0 p-8 flex justify-center items-end bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (!isSubmitting) captureWebcam();
                  }}
                  disabled={isSubmitting}
                  className={`w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl transition-transform border-[6px] border-orange-500/50 ${isSubmitting ? "opacity-50" : "active:scale-95"}`}
                >
                  {isSubmitting && (
                    <div className="w-6 h-6 border-4 border-slate-800 border-r-transparent rounded-full animate-spin"></div>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="relative w-full max-w-[400px] bg-white rounded-[3rem] p-8 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-100 z-50 max-h-[90vh] overflow-y-auto">
              {modalStep === "scan" ? (
                <>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-2xl font-black text-slate-800">
                        Nearby Straykins
                      </h2>
                      <p className="text-sm text-slate-500 font-medium">
                        Is this who you saw?
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setIsModalOpen(false);
                        setDuplicates([]);
                      }}
                      className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {displayItems.length > 0 &&
                  currentIdx < displayItems.length ? (
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
                            {displayItems[currentIdx].type === "ad" ? (
                              <div className="w-full h-full flex flex-col justify-center items-center bg-white p-4">
                                <h3 className="text-lg font-black text-slate-800 mb-6">
                                  Sponsor
                                </h3>
                                <AdBanner format="rectangle" />
                              </div>
                            ) : (
                              <>
                                {displayItems[currentIdx].data?.imageUrl ? (
                                  <img
                                    src={
                                      displayItems[currentIdx].data!.imageUrl
                                    }
                                    className="w-full h-full object-cover pointer-events-none"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-6xl pointer-events-none">
                                    🐈
                                  </div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pt-16 text-white pointer-events-none">
                                  <span className="bg-indigo-500/90 text-white px-2 py-0.5 rounded-full text-[10px] font-black shadow-sm mb-1 inline-block uppercase tracking-wider">
                                    {displayItems[currentIdx].data
                                      ?.animalType || "Cat"}
                                  </span>
                                  <h3 className="text-2xl font-black">
                                    {displayItems[currentIdx].data?.name ||
                                      `Straykin #${displayItems[currentIdx].data?.id.slice(-4)}`}
                                  </h3>
                                  <p className="text-sm font-medium opacity-90 mt-1">
                                    Logged{" "}
                                    {displayItems[currentIdx].data
                                      ?.last_check_in?.was_fed
                                      ? "as fed"
                                      : "recently"}
                                  </p>
                                </div>
                              </>
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      <div className="flex gap-3 mb-4">
                        {displayItems[currentIdx].type === "cat" && (
                          <button
                            onClick={() => {
                              setIsModalOpen(false);
                              setPendingNavigation({
                                url: `/cat/${displayItems[currentIdx].data?.id}`,
                                alias:
                                  displayItems[currentIdx].data?.name ||
                                  displayItems[currentIdx].data?.animalType ||
                                  "Pet",
                                cat: displayItems[currentIdx].data
                              });
                            }}
                            className="w-full py-4 rounded-2xl bg-orange-500 text-white font-bold shadow-lg shadow-orange-200 hover:bg-orange-600 transition-colors"
                          >
                            Yep, this is the one!
                          </button>
                        )}
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
                      onClick={() => {
                        setIsModalOpen(false);
                        setSelectedCatId(null);
                      }}
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
                              setPhotoDataUrl(null);
                              setReportStep("camera");
                            }}
                            className="absolute top-2 right-2 bg-black/60 backdrop-blur text-white text-xs font-bold px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Retake
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setReportStep("camera")}
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
                          <p className="text-sm font-bold text-slate-800 mb-2">
                            Name
                          </p>
                          <input
                            type="text"
                            value={nameInput}
                            onChange={(e) => {
                              const val = e.target.value.replace(
                                /[^A-Za-z]/g,
                                "",
                              );
                              if (val.length <= 8) setNameInput(val);
                            }}
                            placeholder="What should we call them?"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-medium outline-none focus:border-orange-400 focus:bg-white transition-colors"
                          />
                        </div>

                        <div>
                          <p className="text-sm font-bold text-slate-800 mb-2">
                            Gender
                          </p>
                          <select
                            value={genderInput}
                            onChange={(e) =>
                              setGenderInput(e.target.value as any)
                            }
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
      {isShareOpen && (
        <div className="fixed inset-0 z-[70] bg-black text-white flex flex-col justify-center items-center px-4 py-8">
          <div className="w-full max-w-sm flex justify-between items-center mb-6">
            <h2 className="text-xl font-black">Share Sighting</h2>
            <button
              onClick={() => {
                setIsShareOpen(false);
                setShareFinalImage(null);
              }}
              className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold"
            >
              ✕
            </button>
          </div>

          {shareFinalImage ? (
            <div className="w-full max-w-sm flex flex-col items-center animate-in zoom-in-95">
              <img src={shareFinalImage} className="w-full rounded-[2.5rem] shadow-2xl mb-6" />
              <p className="text-white text-sm font-bold bg-white/20 px-4 py-2 rounded-full animate-pulse">
                Long press the image to save or share
              </p>
            </div>
          ) : (
            <>
          <div
            id="share-card"
            className="w-full max-w-sm aspect-[9/16] bg-slate-100 rounded-[2.5rem] overflow-hidden relative shadow-2xl flex flex-col"
          >
            <div className="w-full h-full absolute inset-0">
              <img
                src={shareImgSrc || ""}
                className="w-full h-[65%] object-cover"
                crossOrigin={shareImgSrc?.startsWith("http") ? "anonymous" : undefined}
              />
            </div>
            <div className="w-full h-[45%] absolute bottom-0 left-0">
              <img src="/card.png" className="w-full h-full object-fill absolute inset-0 z-10" crossOrigin="anonymous" />
              <div className="relative z-20 w-full h-full p-8 pt-16 flex flex-col justify-between">
                <div className="flex justify-between items-start gap-2 pb-[6px] mb-[6px] mt-[9px]">
                  <div className="flex-1 pr-2">
                    <h3 className="text-4xl font-black text-white leading-none break-words mb-0 pb-0">
                      {nameInput ||
                        (selectedCatId
                          ? cats.find((c) => c.id === selectedCatId)?.name
                          : "Straykin")}
                    </h3>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
                      <p className="text-sm font-bold text-white/90">
                        Spotted near me
                      </p>
                    </div>
                    <p className="text-sm font-medium text-white/90">
                      Has been fed by{" "}
                      {userSettings.isAnonymous
                        ? userSettings.displayName
                          ? userSettings.displayName.slice(0, 2) +
                            "*".repeat(userSettings.displayName.length - 2)
                          : "Anonymous"
                        : userSettings.displayName || "A Kind Soul"}
                    </p>
                  </div>
                  <div className="w-16 h-16 bg-white rounded-xl shadow-lg shrink-0 overflow-hidden">
                    <img
                      src={`/api/proxy-image?url=${encodeURIComponent(`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin)}`)}`}
                      alt="QR Code"
                      className="w-full h-full object-contain p-1"
                      crossOrigin="anonymous"
                    />
                  </div>
                </div>
                <div className="flex justify-start items-end -mt-4">
                </div>
              </div>
            </div>
          </div>

          <div className="w-full max-w-sm mt-8 flex gap-4">
            <button
              onClick={async () => {
                const node = document.getElementById("share-card");
                if (node) {
                  const { toPng } = await import("html-to-image");
                  const download = (await import("downloadjs")).default;
                  try {
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
                    const dataUrl = await toPng(node, { quality: 0.95, cacheBust: true, style: { margin: "0" } });
                    if (isIOS) {
                      setShareFinalImage(dataUrl);
                      return;
                    }
                    download(dataUrl, "straykin-sighting.png");
                  } catch (err) {
                    alert("Could not generate image");
                  }
                }
              }}
              className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-black"
            >
              Save Image
            </button>
            <button
              onClick={async () => {
                const node = document.getElementById("share-card");
                if (node) {
                  try {
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
                    if (isIOS) {
                      const { toPng } = await import("html-to-image");
                      const dataUrl = await toPng(node, { quality: 0.95, cacheBust: true, style: { margin: "0" } });
                      setShareFinalImage(dataUrl);
                      return;
                    }

                    if (navigator.share) {
                      const { toBlob } = await import("html-to-image");
                      const blob = await toBlob(node, { quality: 0.95, cacheBust: true, style: { margin: "0" } });
                      if (!blob) return;
                      const file = new File([blob], "straykin.jpg", { type: blob.type });

                      if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                          title: `Spotted ${nameInput || (selectedCatId && cats.find((c) => c.id === selectedCatId)?.name) || "a Straykin"}!`,
                          text: `Check out this Straykin on the map!`,
                          files: [file],
                        });
                        setIsShareOpen(false);
                      } else {
                        await navigator.share({
                          title: `Spotted ${nameInput || (selectedCatId && cats.find((c) => c.id === selectedCatId)?.name) || "a Straykin"}!`,
                          text: `Check out this Straykin on the map!`,
                          url: window.location.href,
                        });
                      }
                    }
                  } catch (err) {
                    // Ignore share cancel
                  }
                }
              }}
              className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-black"
            >
              Share to App
            </button>
          </div>
          </>
        )}
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
    </div>
  );
}
