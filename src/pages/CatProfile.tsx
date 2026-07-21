import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useCatDatabase } from "../hooks/useCatDatabase";
import { useLazyAuth } from "../hooks/useLazyAuth";
import {
  ChevronLeft,
  Plus,
  Check,
  User,
  Images,
  Edit2,
  Share2,
  ChevronDown,
  ChevronUp,
  History,
  X,
  ShieldAlert,
  Heart,
  QrCode,
  Send,
} from "lucide-react";
import { CatRecord } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { AdBanner } from "../components/AdBanner";
import { toPng, toBlob } from "html-to-image";
import { useError } from "../context/ErrorContext";

import Webcam from "react-webcam";
export default function CatProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { cats, updateCatSighting, updateCatProfile, addCheckInLog } =
    useCatDatabase();
  const { user, loading, upgradeToGoogleAccount } = useLazyAuth();

  const [cat, setCat] = useState<CatRecord | null>(location.state?.cat || null);
  const [showInterstitial, setShowInterstitial] = useState(false);

  const [isFavorite, setIsFavorite] = useState(() => {
    const profileStr = localStorage.getItem("user_profile");
    if (profileStr) {
      const profile = JSON.parse(profileStr);
      return profile.favorites?.includes(id) || false;
    }
    return false;
  });

  const toggleFavorite = () => {
    let profile: any = { favorites: [] };
    const str = localStorage.getItem("user_profile");
    if (str) profile = JSON.parse(str);
    if (!profile.favorites) profile.favorites = [];
    if (isFavorite) {
      profile.favorites = profile.favorites.filter((f: string) => f !== id);
      setIsFavorite(false);
    } else {
      profile.favorites.push(id);
      setIsFavorite(true);
    }
    localStorage.setItem("user_profile", JSON.stringify(profile));
  };

  useEffect(() => {
    if (!loading) {
      setShowInterstitial(!user || user.isAnonymous);
    }
  }, [user, loading]);

  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [checkInsHistory, setCheckInsHistory] = useState<any[]>([]);

  useEffect(() => {
    if (cat && checkInsHistory.length === 0) {
      let isSubscribed = true;
      let unsubscribe: () => void = () => {};
      const loadHistory = async () => {
        try {
          const { collection, query, where, onSnapshot } =
            await import("firebase/firestore");
          const { db } = await import("../config/firebase");
          const q = query(
            collection(db, "check_ins"),
            where("catId", "==", cat.id),
          );
          unsubscribe = onSnapshot(q, (snap) => {
            if (!isSubscribed) return;
            const realHistory = snap.docs.map((d) => ({
              id: d.id,
              time: d.data().timestamp?.seconds
                ? d.data().timestamp.seconds * 1000
                : Date.now(),
              fed: d.data().wasFed,
              health: d.data().healthStatus || "Healthy",
              notes: d.data().notes || "",
              user: "Community Member",
              status: d.data().status,
            }));

            let h = [...realHistory];
            
            // Extract bunny upload timestamp if available
            let bunnyTime = null;
            if (cat.imageUrl) {
              const match = cat.imageUrl.match(/straykin_(\d+)_/);
              if (match && match[1]) {
                bunnyTime = parseInt(match[1]);
              }
            }

            // Include original submission if it exists
            const creationTime = cat.createdAt ? (cat.createdAt as any).seconds * 1000 : 
                                 bunnyTime ? bunnyTime :
                                 (cat.last_check_in?.timestamp as any)?.seconds ? (cat.last_check_in.timestamp as any).seconds * 1000 : null;
            
            if (creationTime && !realHistory.find(item => Math.abs(item.time - creationTime) < 5000)) {
              h.push({
                id: "h_creation",
                time: creationTime,
                fed: cat.last_check_in?.was_fed || false,
                health: cat.last_check_in?.status_health || "Healthy",
                notes: "First spotted!",
                user: "Community Member",
                status: "approved",
              });
            }

            h.sort((a, b) => b.time - a.time);
            h = h.slice(0, 5);

            setCheckInsHistory(h);
          });
        } catch (err) {
          console.error("Failed to fetch history", err);
        }
      };
      loadHistory();
      return () => {
        isSubscribed = false;
        unsubscribe();
      };
    }
  }, [cat?.id]);

  const [newTagInput, setNewTagInput] = useState("");
  const [newTraitInput, setNewTraitInput] = useState("");

  // Check-in state
  const [wasFed, setWasFed] = useState<boolean | null>(null);
  const [healthStatus, setHealthStatus] = useState<string>("Healthy");
  const [sightingColor, setSightingColor] = useState("");
  const [sightingType, setSightingType] = useState("");
  const [sightingNeutered, setSightingNeutered] = useState<boolean | null>(
    null,
  );
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInGender, setCheckInGender] = useState<"Male" | "Female" | null>(null);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [userDistanceKm, setUserDistanceKm] = useState<number | null>(null);
  const { showError } = useError();

  useEffect(() => {
    if (cat?.lat && cat?.lng && "geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const { distanceBetween } = await import("geofire-common");
          const dist = distanceBetween([latitude, longitude], [cat.lat, cat.lng]);
          setUserDistanceKm(dist);
        },
        (error) => console.warn("Watching position not available"),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [cat?.lat, cat?.lng]);

  const handleOpenCheckIn = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    if (!cat?.lat || !cat?.lng) {
      startCheckInProcess();
      return;
    }

    if (userDistanceKm !== null) {
      if (userDistanceKm <= 0.5) {
         startCheckInProcess();
      } else {
         alert("You must be near the Straykin's location to check in! (Within 500 meters)");
      }
      return;
    }

    setIsCheckingLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          setIsCheckingLocation(false);
          const { latitude, longitude } = position.coords;
          const { distanceBetween } = await import("geofire-common");
          const distanceInKm = distanceBetween([latitude, longitude], [cat.lat, cat.lng]);
          setUserDistanceKm(distanceInKm);
          
          if (distanceInKm <= 0.5) { // 500 meters
             startCheckInProcess();
          } else {
             alert("You must be near the Straykin's location to check in! (Within 500 meters)");
          }
        },
        (error) => {
          setIsCheckingLocation(false);
          alert("Could not get your location. Please enable location services to check in.");
        },
        { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
      );
    } else {
       setIsCheckingLocation(false);
       alert("Geolocation is not supported by your browser.");
    }
  };

  const startCheckInProcess = () => {
    setIsCheckInOpen(true);
    setReportStep("camera");
    setPhotoAttempts(0);
    setPhotoDataUrl(null);
    setCheckInGender(null);
  };

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [reportStep, setReportStep] = useState<"camera" | "form">("camera");
  const [photoAttempts, setPhotoAttempts] = useState(0);
  const webcamRef = useRef<Webcam>(null);

  const captureWebcam = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      setPhotoDataUrl(imageSrc);
      setReportStep("form");
      setIsCameraActive(false);
    }
  }, [webcamRef]);

  const [addToGallery, setAddToGallery] = useState(true);
  const [fedToggle, setFedToggle] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [votesSpentNames, setVotesSpentNames] = useState<number>(0);
  const [votesSpentTraits, setVotesSpentTraits] = useState<number>(0);
  const [votesSpentGallery, setVotesSpentGallery] = useState<number>(0);

  // Settings
  const [userSettings, setUserSettings] = useState({
    displayName: "",
    isAnonymous: false,
  });
  useEffect(() => {
    const saved = localStorage.getItem("user_settings");
    if (saved) setUserSettings(JSON.parse(saved));
  }, []);

  const [votedNames, setVotedNames] = useState<string[]>([]);
  const [votedTraits, setVotedTraits] = useState<string[]>([]);
  const [votedGallery, setVotedGallery] = useState<string[]>([]);

  useEffect(() => {
    if (id) {
      setVotesSpentNames(
        parseInt(localStorage.getItem(`cat_vote_power_names_${id}`) || "0", 10),
      );
      setVotesSpentTraits(
        parseInt(
          localStorage.getItem(`cat_vote_power_traits_${id}`) || "0",
          10,
        ),
      );
      setVotesSpentGallery(
        parseInt(
          localStorage.getItem(`cat_vote_power_gallery_${id}`) || "0",
          10,
        ),
      );

      setVotedNames(
        JSON.parse(localStorage.getItem(`cat_voted_names_${id}`) || "[]"),
      );
      setVotedTraits(
        JSON.parse(localStorage.getItem(`cat_voted_traits_${id}`) || "[]"),
      );
      setVotedGallery(
        JSON.parse(localStorage.getItem(`cat_voted_gallery_${id}`) || "[]"),
      );
    }
  }, [id]);

  useEffect(() => {
    // In a real app we'd fetch directly from DB if not in local array,
    // but here we wait for cats to load.
    if (id && cats.length > 0) {
      const found = cats.find((c) => c.id === id);
      if (found) {
        setCat(found);
      }
    }
  }, [id, cats]);

  const topPhotos: string[] = [];
  if (cat) {
    if (cat.imageUrl) topPhotos.push(cat.imageUrl);
    if (cat.gallery) {
      const sortedGallery = [...cat.gallery].sort((a, b) => b.votes - a.votes);
      sortedGallery.forEach((p) => {
        if (p.url !== cat.imageUrl) topPhotos.push(p.url);
      });
    }
  }
  const displayPhotos = topPhotos.slice(0, 3);

  useEffect(() => {
    if (displayPhotos.length > 1) {
      const timer = setInterval(() => {
        setCurrentImageIndex((prev) =>
          prev < displayPhotos.length - 1 ? prev + 1 : 0,
        );
      }, 7000);
      return () => clearInterval(timer);
    }
  }, [displayPhotos.length]);

  if (!cat) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4 text-center bg-[#e5e7eb]">
        <div className="text-slate-500 font-medium">
          Loading Straykin profile...
        </div>
      </div>
    );
  }

  // 1. Name Tag Cloud logic
  let sortedNames = [...(cat.names || [])].sort((a, b) => b.votes - a.votes);
  if (sortedNames.length === 0 && cat.name) {
    sortedNames.push({ name: cat.name, votes: 1, suggestedBy: "system" });
  }
  const topName =
    sortedNames.length > 0
      ? sortedNames[0].name
      : `Straykin #${cat.id.slice(-4)}`;
  const aliasNames = [...sortedNames];
  if (!aliasNames.find((n) => n.name === cat.name)) {
    aliasNames.unshift({ name: cat.name, votes: 0, suggestedBy: "system" });
  }

  const executeWithVotePower = async (
    category: "names" | "traits" | "gallery",
    itemId: string,
    actionDesc: string,
  ) => {
    if (loading) return 0;
    if (!user || user.isAnonymous) {
      setShowLoginModal(true);
      return 0;
    }

    let currentSpent = 0;
    let currentVoted: string[] = [];
    if (category === "names") {
      currentSpent = votesSpentNames;
      currentVoted = votedNames;
    }
    if (category === "traits") {
      currentSpent = votesSpentTraits;
      currentVoted = votedTraits;
    }
    if (category === "gallery") {
      currentSpent = votesSpentGallery;
      currentVoted = votedGallery;
    }

    const isDevoting = currentVoted.includes(itemId?.toLowerCase() || "");

    if (!isDevoting && currentSpent >= 3) {
      alert(`You used all 3 votes for ${category} on this Straykin!`);
      return 0;
    }

    const newSpent = isDevoting ? currentSpent - 1 : currentSpent + 1;
    const newVoted = isDevoting
      ? currentVoted.filter((id) => id !== (itemId?.toLowerCase() || ""))
      : [...currentVoted, itemId?.toLowerCase() || ""];

    if (category === "names") {
      setVotesSpentNames(newSpent);
      setVotedNames(newVoted);
    }
    if (category === "traits") {
      setVotesSpentTraits(newSpent);
      setVotedTraits(newVoted);
    }
    if (category === "gallery") {
      setVotesSpentGallery(newSpent);
      setVotedGallery(newVoted);
    }

    if (id) {
      localStorage.setItem(
        `cat_vote_power_${category}_${id}`,
        newSpent.toString(),
      );
      localStorage.setItem(
        `cat_voted_${category}_${id}`,
        JSON.stringify(newVoted),
      );
    }

    return isDevoting ? -1 : 1;
  };

  const handleVoteName = async (nameToVote: string) => {
    const change = await executeWithVotePower(
      "names",
      nameToVote,
      `You voted for name "${nameToVote}"!`,
    );
    if (change !== 0 && cat && id) {
      let found = false;
      let newNames = (cat.names || []).map((n) => {
        if (n.name === nameToVote) {
          found = true;
          return { ...n, votes: Math.max(0, n.votes + change) };
        }
        return n;
      });
      if (!found) {
        newNames = [
          ...newNames,
          {
            name: nameToVote,
            votes: Math.max(0, change),
            suggestedBy: "community",
          },
        ];
      }
      setCat((prev) => (prev ? { ...prev, names: newNames } : prev));
      await updateCatProfile(id, { names: newNames }).catch(() => {});
    }
  };

  const handleSuggestName = async (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter" && newTagInput.trim()) {
      const suggestValue = newTagInput.trim();
      
      const existingName = (cat?.names || []).find(n => n.name.toLowerCase() === suggestValue.toLowerCase());
      if (existingName) {
         setNewTagInput("");
         handleVoteName(existingName.name);
         return;
      }

      const change = await executeWithVotePower(
        "names",
        suggestValue,
        `Suggested name: ${suggestValue}!`,
      );
      if (change === 1 && cat && id) {
        setNewTagInput("");
        const newNames = [
          ...(cat.names || []),
          { name: suggestValue, votes: 1, suggestedBy: "user" },
        ];
        setCat((prev) => (prev ? { ...prev, names: newNames } : prev));
        await updateCatProfile(id, { names: newNames }).catch(() => {});
      }
    }
  };

  const handleCheckIn = async () => {
    if (loading) return;
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    
    if (!checkInGender) {
      alert("Please select a gender.");
      return;
    }

    setCheckInLoading(true);

    const isQualifiedForGallery = !!(user && !user.isAnonymous);
    const actualAddToGallery = addToGallery && isQualifiedForGallery;

    // Send to manual review
    const submissionId = `checkin_${Date.now()}`;
    let docIdForReview = "";
    try {
      const checkInRes = await addCheckInLog({
        catId: cat.id,
        wasFed,
        healthStatus,
        geo_point: undefined,
        photoDataUrl: null, // Defer image save to avoid Firestore limits until approved
        addToGallery: actualAddToGallery,
        status: "under_review",
        submissionId,
        submittedBy: user?.uid,
      });
      docIdForReview = checkInRes.id;

      fetch("/api/submit-for-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: submissionId,
          docIdForReview,
          type: "check_in",
          details: {
            catId: cat.id,
            wasFed,
            healthStatus,
            geo_point: undefined,
            addToGallery: actualAddToGallery,
            submittedBy: user?.uid,
            checkInId: checkInRes.id,
          },
          imageBase64: photoDataUrl,
        }),
      })
      .then(res => res.json())
      .then(data => {
        updateCatSighting(cat.id, { 
          status: data.status, 
          isCheckIn: true,
          gender: checkInGender,
          addToGallery: actualAddToGallery,
          ...(data.imageUrl ? { photoDataUrl: data.imageUrl } : {})
        });
      })
      .catch((err) => console.error("Background review failed", err));
    } catch (err: any) {
      console.error("Failed to submit:", err);
      // Offline mode handling...
      try {
        await addCheckInLog({
          catId: cat.id,
          wasFed,
          healthStatus,
          geo_point: undefined,
          photoDataUrl: null,
          addToGallery: actualAddToGallery,
          status: "approved",
          submissionId,
          submittedBy: user?.uid,
        });
        await updateCatSighting(cat.id, {
          wasFed,
          activities: wasFed ? ["Feed"] : [],
          notes: healthStatus !== "Good" ? healthStatus : undefined,
          photoDataUrl: null,
          addToGallery: actualAddToGallery,
          isCheckIn: true,
          gender: checkInGender,
          status: "approved",
          submittedBy: user?.uid,
        });
      } catch (offlineErr: any) {
        showError(
          err?.message || offlineErr?.message || "Connection error. Failed to save your check-in."
        );
        setCheckInLoading(false);
        return; // Stop here if it fails
      }
    }

    setCheckInLoading(false);
    setIsCheckInOpen(false);
    navigate("/share", {
      replace: true,
      state: {
        type: "submission",
        cat,
        topName,
        userSettings,
        user: user
          ? {
              uid: user.uid,
              displayName: user.displayName,
              photoURL: user.photoURL,
              isAnonymous: user.isAnonymous,
            }
          : null,
        photoDataUrl,
      },
    });
  };

  // 3. Crowdsourced Certainty
  let domGender = "Unknown";
  if (cat.genderVotes) {
    const { male, female, unknown } = cat.genderVotes;
    if (male > female && male > unknown) domGender = "Male";
    else if (female > male && female > unknown) domGender = "Female";
    else if (unknown > male && unknown > female) domGender = "Unknown";
  }

  const isSterilized = (cat.sterilizedVotes || 0) > 0;

  const defaultColors =
    cat.color_tags && cat.color_tags.length > 0
      ? cat.color_tags
      : ["Unknown Color"];

  return (
    <div className="relative h-full w-full font-sans bg-black flex flex-col overflow-y-auto pb-32">
      <div className="sticky top-0 inset-x-0 p-4 bg-gradient-to-b from-black/60 to-transparent pt-6 flex justify-between items-start z-[60] w-full mb-[-88px] pointer-events-none">
        <button
          onClick={() => navigate("/")}
          className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors pointer-events-auto"
        >
          <ChevronLeft className="w-7 h-7 -ml-0.5" />
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => setIsDetailsOpen(true)}
            className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors shadow-sm cursor-pointer pointer-events-auto"
          >
            <Edit2 className="w-5 h-5" />
          </button>
          <button
            onClick={toggleFavorite}
            className={`w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center transition-colors shadow-sm cursor-pointer pointer-events-auto ${isFavorite ? "text-rose-500" : "text-white hover:bg-black/60"}`}
          >
            <Heart className={`w-5 h-5 ${isFavorite ? "fill-current" : ""}`} />
          </button>
          <button
            onClick={() => {
              setIsGalleryOpen(true);
              setViewerIndex(null);
            }}
            className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors shadow-sm cursor-pointer pointer-events-auto"
          >
            <Images className="w-5 h-5" />
          </button>
          <button
            onClick={() =>
              navigate("/share", {
                state: {
                  type: "cat",
                  cat,
                  topName,
                  userSettings,
                  user: user
                    ? {
                        uid: user.uid,
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        isAnonymous: user.isAnonymous,
                      }
                    : null,
                  photoDataUrl,
                },
              })
            }
            className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors shadow-sm cursor-pointer pointer-events-auto"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate("/account")}
            className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors shadow-sm cursor-pointer pointer-events-auto"
          >
            <User className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showInterstitial && (
        <div className="absolute inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 slide-in-from-bottom-full animate-in duration-500">
          <button
            onClick={() => setShowInterstitial(false)}
            className="absolute top-6 right-6 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 hover:bg-slate-200"
          >
            ✕
          </button>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Sponsor</h2>
          <p className="text-slate-500 text-sm font-medium text-center mb-8">
            Advertisement
          </p>
          <AdBanner format="skyscraper" />
          <button
            onClick={() => setShowInterstitial(false)}
            className="px-8 py-4 mt-8 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-200"
          >
            Continue to {topName}
          </button>
        </div>
      )}

      {/* Header Image */}
      <div className="relative w-full h-[85vh] shrink-0 bg-slate-800 rounded-b-[2.5rem] overflow-hidden shadow-2xl z-10 group">
        {displayPhotos.length > 0 ? (
          <>
            <AnimatePresence mode="wait">
              <motion.img
                key={currentImageIndex}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={(event, info) => {
                  if (info.offset.x > 50) {
                    setCurrentImageIndex((prev) =>
                      prev > 0 ? prev - 1 : displayPhotos.length - 1,
                    );
                  } else if (info.offset.x < -50) {
                    setCurrentImageIndex((prev) =>
                      prev < displayPhotos.length - 1 ? prev + 1 : 0,
                    );
                  }
                }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                src={displayPhotos[currentImageIndex]}
                className="w-full h-full object-cover absolute inset-0 cursor-grab active:cursor-grabbing"
                alt={topName}
              />
            </AnimatePresence>

            {/* Carousel Nav Removed for unobstructed viewing */}

            {/* Dots */}
            {displayPhotos.length > 1 && (
              <div className="absolute top-24 inset-x-0 flex justify-center gap-1.5 z-20">
                {displayPhotos.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === currentImageIndex ? "bg-white w-6" : "bg-white/50 w-2"}`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex w-full h-full items-center justify-center text-8xl bg-orange-100">
            🐈
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-6 pb-8 pt-32 text-white">
          <div className="flex flex-col gap-1 mb-2">
            {cat.status === "under_review" && (
              <div className="self-start bg-amber-500/20 text-amber-300 text-[10px] uppercase font-black px-2 py-0.5 rounded-full border border-amber-500/30 backdrop-blur-sm mb-1 flex items-center gap-1.5">
                <div className="w-2 h-2 border-2 border-amber-400 border-r-transparent rounded-full animate-spin" />
                Under Review
              </div>
            )}
            <div className="flex items-end gap-3">
              <h1 className="text-5xl font-black drop-shadow-md">{topName}</h1>
              <span className="text-2xl opacity-90 pb-1">
                {domGender === "Male" ? "♂" : domGender === "Female" ? "♀" : ""}
              </span>
            </div>
          </div>

          {/* Minimal Tag display directly on image */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="bg-indigo-500/90 text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm backdrop-blur-md border border-indigo-400/50">
              {cat.strayType || cat.animalType || "Cat"}
            </span>
            {(cat.color ? [cat.color] : defaultColors).map((c) => (
              <span
                key={c}
                className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm"
              >
                {c}
              </span>
            ))}
            {cat.isResidentPet && (
              <span className="bg-indigo-500/90 text-white px-3 py-1 rounded-full text-sm font-bold backdrop-blur-md shadow-sm border border-indigo-400/50">
                Resident Pet
              </span>
            )}
            {(isSterilized || cat.isNeutered) && (
              <span className="bg-emerald-500/90 text-white px-3 py-1 rounded-full text-sm font-bold backdrop-blur-md shadow-sm border border-emerald-400/50">
                TNR Verified
              </span>
            )}
          </div>

          <p className="text-sm font-medium text-white/80 flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"></span>
            Last seen{" "}
            {cat.locationName
              ? `near ${cat.locationName.length > 18 ? cat.locationName.substring(0, 18) + "..." : cat.locationName}`
              : "recently"}
          </p>
          
          <p className="text-sm font-medium text-white/80 flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)]"></span>
            First spotted{" "}
            {cat.createdAt ? new Date((cat.createdAt as any).seconds ? (cat.createdAt as any).seconds * 1000 : cat.createdAt).toLocaleDateString() : 
             (cat.imageUrl && cat.imageUrl.match(/straykin_(\d+)_/)) ? new Date(parseInt(cat.imageUrl.match(/straykin_(\d+)_/)![1])).toLocaleDateString() :
             (cat.last_check_in?.timestamp as any)?.seconds ? new Date((cat.last_check_in.timestamp as any).seconds * 1000).toLocaleDateString() : "recently"}
          </p>

          <p className="text-xs font-mono text-white/40 mb-2">ID: {cat.id}</p>
        </div>
      </div>

      <div className="px-5 space-y-6 pt-6 relative z-0">
        {/* Check-In History Accordion */}
        <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-slate-800 whitespace-nowrap"
          >
            <div className="flex items-center gap-2 truncate">
              <History className="w-5 h-5 text-slate-400 shrink-0" />
              <span className="text-sm font-bold text-white truncate">
                Check-in History (Last 5)
              </span>
            </div>
            {isHistoryOpen ? (
              <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
            )}
          </button>

          <AnimatePresence>
            {isHistoryOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 pt-0 space-y-3">
                  {checkInsHistory.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex gap-4 items-start p-3 bg-slate-800 rounded-xl"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0 mt-1">
                        <span className="text-xs">
                          {item.fed ? "🍽️" : "🐾"}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-sm font-bold text-white">
                            {item.user}
                          </p>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                            {new Date(item.time).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-1">
                          {item.status && item.status !== "approved" && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${item.status === "under_review" ? "text-yellow-300 bg-yellow-500/20" : "text-red-300 bg-red-500/20"}`}
                            >
                              {item.status === "under_review"
                                ? "Pending"
                                : "Rejected"}
                            </span>
                          )}
                          {item.fed && (
                            <span className="text-[10px] font-bold text-orange-400 bg-orange-500/20 px-2 py-0.5 rounded-md">
                              Fed
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${item.health === "Healthy" ? "text-emerald-400 bg-emerald-500/20" : "text-red-400 bg-red-500/20"}`}
                          >
                            {item.health}
                          </span>
                        </div>
                        {item.notes && (
                          <p className="text-xs text-slate-400 italic mt-1 bg-slate-800 p-2 rounded-lg border border-slate-700">
                            "{item.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Name Tag Cloud (Community Aliases) */}
        <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Community Aliases
            </h3>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((v) => (
                <span
                  key={v}
                  className={`text-xs ${v > 3 - votesSpentNames ? "opacity-20" : "text-orange-500"}`}
                >
                  ⚡
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {aliasNames.length > 0 ? (
              aliasNames.map((alias) => (
                <button
                  key={alias.name}
                  onClick={() => handleVoteName(alias.name)}
                  className={`group flex flex-col items-center border rounded-2xl px-4 py-2 transition-all active:scale-95 ${votedNames.includes(alias.name?.toLowerCase() || "") ? "bg-slate-800 border-orange-500 ring-2 ring-orange-500/50" : "bg-slate-800 border-slate-700/50 hover:bg-slate-700 hover:border-slate-600"}`}
                >
                  <span className="text-sm font-bold text-white mb-1">
                    {alias.name}
                  </span>
                  <span className="text-xs text-orange-400 font-bold bg-orange-400/10 px-2 py-0.5 rounded-md group-hover:bg-orange-400/20">
                    +{alias.votes}
                  </span>
                </button>
              ))
            ) : (
              <span className="text-sm text-slate-500 font-medium italic px-1">
                No aliases yet.
              </span>
            )}
          </div>
          <div className="mt-2 text-white relative flex gap-2">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => {
                const val = e.target.value.replace(/[^A-Za-z]/g, "");
                if (val.length <= 12) setNewTagInput(val);
              }}
              onKeyDown={handleSuggestName}
              placeholder="Suggest an alias (max 12 chars)"
              className="w-full bg-slate-800 text-white placeholder-slate-500 border border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-colors"
            />
            <button
              onClick={() => {
                if (newTagInput.trim()) {
                  // spoof enter key event
                  handleSuggestName({
                    key: "Enter",
                    preventDefault: () => {},
                  } as any);
                }
              }}
              disabled={!newTagInput.trim()}
              className="bg-orange-500 px-4 py-3 rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <div className="my-4">
          <AdBanner format="rectangle" />
        </div>

        {/* Characteristics / Traits Cloud */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Characteristics & Traits
            </h3>
          </div>
          <div className="flex items-center gap-1 mb-4">
            {[1, 2, 3].map((v) => (
              <span
                key={v}
                className={`text-xs ${v > 3 - votesSpentTraits ? "opacity-20" : "text-orange-500"}`}
              >
                ⚡
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {(() => {
              const defaultTraits = [
                "Playful",
                "Vocal",
                "Clingy",
                "Bite",
                "Scratchy",
              ];
              const existingTraitsMap = new Map(
                (cat.characteristics || []).map((c) => [
                  c.tag?.toLowerCase() || "",
                  c,
                ]),
              );

              const combinedTraits = [...(cat.characteristics || [])];

              defaultTraits.forEach((dt) => {
                if (!existingTraitsMap.has(dt?.toLowerCase() || "")) {
                  combinedTraits.push({ tag: dt, votes: 0 });
                }
              });

              return combinedTraits
                .sort((a, b) => b.votes - a.votes)
                .map((char) => (
                  <button
                    key={char.tag}
                    onClick={async () => {
                      const change = await executeWithVotePower(
                        "traits",
                        char.tag,
                        `You voted for trait "${char.tag}"!`,
                      );
                      if (change !== 0 && cat && id) {
                        const chars = cat.characteristics || [];
                        const exists = chars.find(
                          (c) =>
                            (c.tag?.toLowerCase() || "") ===
                            (char.tag?.toLowerCase() || ""),
                        );
                        let newTraits = [];
                        if (exists) {
                          newTraits = chars.map((c) =>
                            c.tag === char.tag
                              ? { ...c, votes: Math.max(0, c.votes + change) }
                              : c,
                          );
                        } else {
                          newTraits = [...chars, { tag: char.tag, votes: 1 }];
                        }
                        setCat((prev) =>
                          prev ? { ...prev, characteristics: newTraits } : prev,
                        );
                        await updateCatProfile(id, {
                          characteristics: newTraits,
                        }).catch(() => {});
                      }
                    }}
                    className={`group flex flex-col items-center border rounded-2xl px-4 py-2 transition-all active:scale-95 ${votedTraits.includes(char.tag?.toLowerCase() || "") ? "bg-orange-50 border-orange-500 ring-2 ring-orange-500/50" : char.votes > 0 ? "bg-slate-50 border-slate-200 hover:bg-orange-50 hover:border-orange-200" : "bg-transparent border-dashed border-slate-300 hover:border-orange-300 hover:bg-orange-50/50"}`}
                  >
                    <span
                      className={`text-sm font-bold mb-1 ${char.votes > 0 ? "text-slate-700" : "text-slate-500 group-hover:text-orange-700"}`}
                    >
                      {char.tag}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-md ${char.votes > 0 ? "text-orange-500 bg-orange-100 group-hover:bg-orange-200" : "text-slate-400 bg-slate-100 group-hover:text-orange-600 group-hover:bg-orange-200"}`}
                    >
                      {char.votes > 0 ? `+${char.votes}` : "Vote"}
                    </span>
                  </button>
                ));
            })()}
          </div>
          <div className="mt-2 relative flex gap-2">
            <input
              type="text"
              value={newTraitInput}
              onChange={(e) => setNewTraitInput(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && newTraitInput.trim()) {
                  const suggestValue = newTraitInput.trim();
                  
                  const chars = cat?.characteristics || [];
                  const existing = chars.find(c => c.tag?.toLowerCase() === suggestValue.toLowerCase());
                  
                  if (existing) {
                    setNewTraitInput("");
                    const change = await executeWithVotePower(
                      "traits",
                      existing.tag,
                      `You voted for trait "${existing.tag}"!`,
                    );
                    if (change !== 0 && cat && id) {
                      const newTraits = chars.map((c) =>
                        c.tag === existing.tag
                          ? { ...c, votes: Math.max(0, c.votes + change) }
                          : c,
                      );
                      setCat((prev) =>
                        prev ? { ...prev, characteristics: newTraits } : prev,
                      );
                      await updateCatProfile(id, {
                        characteristics: newTraits,
                      }).catch(() => {});
                    }
                    return;
                  }

                  const change = await executeWithVotePower(
                    "traits",
                    suggestValue,
                    `Suggested trait: ${suggestValue}!`,
                  );
                  if (change === 1 && cat && id) {
                    setNewTraitInput("");
                    const newTraits = [
                      ...(cat.characteristics || []),
                      { tag: suggestValue, votes: 1 },
                    ];
                    setCat((prev) =>
                      prev ? { ...prev, characteristics: newTraits } : prev,
                    );
                    await updateCatProfile(id, {
                      characteristics: newTraits,
                    }).catch(() => {});
                  }
                }
              }}
              placeholder="Add a trait (e.g., Friendly, Vocal)..."
              className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-500 focus:bg-white transition-colors"
            />
            <button
              onClick={async () => {
                if (newTraitInput.trim()) {
                  const suggestValue = newTraitInput.trim();
                  
                  const chars = cat?.characteristics || [];
                  const existing = chars.find(c => c.tag?.toLowerCase() === suggestValue.toLowerCase());
                  
                  if (existing) {
                    setNewTraitInput("");
                    const change = await executeWithVotePower(
                      "traits",
                      existing.tag,
                      `You voted for trait "${existing.tag}"!`,
                    );
                    if (change !== 0 && cat && id) {
                      const newTraits = chars.map((c) =>
                        c.tag === existing.tag
                          ? { ...c, votes: Math.max(0, c.votes + change) }
                          : c,
                      );
                      setCat((prev) =>
                        prev ? { ...prev, characteristics: newTraits } : prev,
                      );
                      await updateCatProfile(id, {
                        characteristics: newTraits,
                      }).catch(() => {});
                    }
                    return;
                  }

                  const change = await executeWithVotePower(
                    "traits",
                    suggestValue,
                    `Suggested trait: ${suggestValue}!`,
                  );
                  if (change === 1 && cat && id) {
                    setNewTraitInput("");
                    const newTraits = [
                      ...(cat.characteristics || []),
                      { tag: suggestValue, votes: 1 },
                    ];
                    setCat((prev) =>
                      prev ? { ...prev, characteristics: newTraits } : prev,
                    );
                    await updateCatProfile(id, {
                      characteristics: newTraits,
                    }).catch(() => {});
                  }
                }
              }}
              disabled={!newTraitInput.trim()}
              className="bg-orange-500 px-4 py-3 rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Check-In Gallery */}
        <div
          id="gallery-section"
          className="bg-slate-900 rounded-3xl p-5 border border-slate-800"
        >
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Check-in Gallery
            </h3>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                {cat.gallery?.length || 0} Photos
              </span>
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((v) => (
                  <span
                    key={v}
                    className={`text-[10px] ${v > 3 - votesSpentGallery ? "opacity-20" : "text-orange-500"}`}
                  >
                    ⚡
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {cat.imageUrl &&
              !(cat.gallery || []).find((g) => g.url === cat.imageUrl) && (
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-800">
                  <img
                    src={cat.imageUrl}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const change = await executeWithVotePower(
                          "gallery",
                          "main",
                          "You voted for this photo!",
                        );
                        if (change !== 0 && cat && id) {
                          const newVotes = Math.max(
                            0,
                            (cat.imageUrlVotes || 0) + change,
                          );
                          setCat((prev) =>
                            prev ? { ...prev, imageUrlVotes: newVotes } : prev,
                          );
                          await updateCatProfile(id, {
                            imageUrlVotes: newVotes,
                          }).catch(() => {});
                        }
                      }}
                      className={`bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 transition-colors ${votedGallery.includes("main") ? "text-orange-400 ring-1 ring-orange-500 border border-orange-500" : "hover:bg-orange-500"}`}
                    >
                      ♥️ {cat.imageUrlVotes || 0}
                    </button>
                  </div>
                </div>
              )}

            {cat.gallery && cat.gallery.length > 0
              ? [...cat.gallery]
                  .sort((a, b) => b.votes - a.votes)
                  .slice(0, 3)
                  .map((photo, index) => (
                    <div
                      key={photo.id}
                      onClick={() => {
                        setViewerIndex(index);
                        setIsGalleryOpen(true);
                      }}
                      className={`relative aspect-square rounded-2xl overflow-hidden bg-slate-800 cursor-pointer ${votedGallery.includes(photo.id) ? "ring-2 ring-orange-500 ring-offset-2 ring-offset-slate-900" : ""}`}
                    >
                      <img
                        src={photo.url}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 right-2 flex gap-1">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const change = await executeWithVotePower(
                              "gallery",
                              photo.id,
                              "You voted for this photo!",
                            );
                            if (change !== 0 && cat && id) {
                              const newGallery = (cat.gallery || []).map((g) =>
                                g.id === photo.id
                                  ? {
                                      ...g,
                                      votes: Math.max(0, g.votes + change),
                                    }
                                  : g,
                              );
                              setCat((prev) =>
                                prev ? { ...prev, gallery: newGallery } : prev,
                              );
                              await updateCatProfile(id, {
                                gallery: newGallery,
                              }).catch(() => {});
                            }
                          }}
                          className="bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 hover:bg-orange-500 transition-colors"
                        >
                          ♥️ {photo.votes}
                        </button>
                      </div>
                    </div>
                  ))
              : null}
            {cat.gallery && cat.gallery.length > 3 && (
              <div
                onClick={() => {
                  setViewerIndex(3);
                  setIsGalleryOpen(true);
                }}
                className="relative aspect-square rounded-2xl overflow-hidden bg-slate-800 flex items-center justify-center cursor-pointer hover:bg-slate-700 transition-colors"
              >
                <span className="text-white font-bold">
                  +{cat.gallery.length - 3}
                </span>
              </div>
            )}
            {!cat.imageUrl && (!cat.gallery || cat.gallery.length === 0) && (
              <div className="col-span-2 py-6 text-center text-sm font-medium text-slate-500 italic">
                No check-in photos yet. Be the first!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Camera Mode Overlay */}
      {isCheckInOpen && reportStep === "camera" && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center animate-in zoom-in-95 overflow-hidden">
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

          {/* Header */}
          <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10 pt-safe">
            <h2 className="text-white font-black text-xl tracking-tight">
              Focus on Straykin
            </h2>
            <button
              onClick={() => setIsCheckInOpen(false)}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Viewfinder brackets */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[75vw] h-[55vw] max-w-[300px] max-h-[220px] pointer-events-none">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white drop-shadow-md rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white drop-shadow-md rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white drop-shadow-md rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white drop-shadow-md rounded-br-xl" />
          </div>

          {/* Capture button */}
          <div className="absolute bottom-0 inset-x-0 p-8 flex justify-center items-end bg-gradient-to-t from-black/80 via-black/40 to-transparent pb-safe-12 z-10 w-full min-w-full">
            <button
              onClick={(e) => {
                e.preventDefault();
                if (!checkInLoading) captureWebcam();
              }}
              disabled={checkInLoading}
              className={`w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl transition-transform border-[6px] border-orange-500/50 ${checkInLoading ? "opacity-50" : "active:scale-95"}`}
            >
              {checkInLoading && (
                <div className="w-6 h-6 border-4 border-slate-800 border-r-transparent rounded-full animate-spin"></div>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Floating Check-In Button / Container */}
      <div className="fixed sm:absolute bottom-0 inset-x-0 p-4 z-50 pointer-events-none flex justify-center">
        {!isCheckInOpen ? (
          <>
            {((!cat?.lat || !cat?.lng) || (userDistanceKm !== null && userDistanceKm <= 0.5)) && (
              <button
                onClick={handleOpenCheckIn}
                disabled={isCheckingLocation}
                className="w-full max-w-sm py-4 rounded-full bg-orange-500 text-white font-black text-lg shadow-[0_10px_30px_rgba(249,115,22,0.4)] pointer-events-auto hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:bg-orange-300 disabled:scale-100"
              >
                {isCheckingLocation ? (
                   <div className="w-6 h-6 border-4 border-slate-100 border-r-transparent rounded-full animate-spin"></div>
                ) : (
                  <Plus className="w-6 h-6" />
                )}
                {isCheckingLocation ? "Getting Location..." : "Check In Straykin"}
              </button>
            )}
          </>
        ) : reportStep === "form" ? (
          <div className="w-full bg-slate-900 rounded-[2rem] p-6 shadow-2xl pointer-events-auto border border-slate-800 animate-in slide-in-from-bottom-8 fade-in duration-300">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-black text-white">Spotted today?</h2>
              <button
                onClick={() => setIsCheckInOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold hover:bg-slate-700 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2.5">
                  Take a Photo
                </p>
                <div className="relative w-full h-40 rounded-2xl overflow-hidden bg-slate-800 border-2 border-slate-700 flex flex-col group">
                  {photoDataUrl ? (
                    <>
                      <img
                        src={photoDataUrl}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setReportStep("camera");
                        }}
                        className="absolute top-2 right-2 bg-black/60 backdrop-blur text-white text-xs font-bold px-3 py-1.5 rounded-full z-10 transition-opacity"
                      >
                        Retake
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setReportStep("camera")}
                      className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-orange-500 transition-colors relative z-10"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center">
                        <Plus className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-bold">Open Camera</span>
                    </button>
                  )}
                </div>
                {photoDataUrl && (
                  <div className="flex flex-col mt-3 px-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-300">
                        Add to Gallery
                      </span>
                      <button
                        onClick={() => {
                          if (!user || user.isAnonymous) {
                            setShowLoginModal(true);
                            return;
                          }
                          setAddToGallery(!addToGallery);
                        }}
                        className={`w-12 h-6 rounded-full relative transition-colors ${addToGallery && !user?.isAnonymous ? "bg-orange-500" : "bg-slate-600"} ${!user || user.isAnonymous ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <span
                          className={`absolute top-1 bottom-1 w-4 bg-white rounded-full transition-all ${addToGallery && !user?.isAnonymous ? "left-7" : "left-1"}`}
                        ></span>
                      </button>
                    </div>
                    {(!user || user.isAnonymous) && (
                      <p className="text-[10px] text-slate-500 mt-1">
                        Register to post photos to the community gallery.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2.5">
                  Gender
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => { e.preventDefault(); setCheckInGender("Male"); }}
                    className={`flex-1 py-3.5 rounded-2xl text-sm font-bold transition-all ${checkInGender === "Male" ? "bg-orange-500 text-white shadow-md" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                  >
                    Male
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); setCheckInGender("Female"); }}
                    className={`flex-1 py-3.5 rounded-2xl text-sm font-bold transition-all ${checkInGender === "Female" ? "bg-orange-500 text-white shadow-md" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                  >
                    Female
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2.5">
                  Feed Status
                </p>
                <div className="flex">
                  <button
                    onClick={() => setWasFed(wasFed === true ? null : true)}
                    className={`w-full py-4 rounded-2xl text-sm font-bold flex justify-center items-center gap-2 transition-all ${wasFed === true ? "bg-orange-500 text-white shadow-md" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                  >
                    I Fed the Straykin
                    {wasFed === true && (
                      <Check className="w-5 h-5 border-2 border-white rounded-md" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2.5">
                  Health condition
                </p>
                <div className="flex flex-col gap-2">
                  {["Healthy", "Injured", "Needs Attention"].map((status) => (
                    <button
                      key={status}
                      onClick={() => setHealthStatus(status)}
                      className={`w-full py-3.5 px-5 rounded-2xl text-sm font-bold text-left flex justify-between items-center transition-all ${healthStatus === status ? "bg-orange-500 text-white shadow-md" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                    >
                      {status}
                      {healthStatus === status && (
                        <Check className="w-5 h-5 border-2 border-white rounded-md" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCheckIn}
                disabled={checkInLoading}
                className="w-full py-4 mt-2 rounded-2xl bg-white text-orange-600 font-black active:scale-95 transition-all text-sm disabled:opacity-70 disabled:active:scale-100 shadow-lg"
              >
                {checkInLoading ? "Working..." : "Submit Check-In"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Login Prompt Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-white mb-2">
              Login Required
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              You need to be registered and logged in to use your vote power or
              perform this action.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLoginModal(false)}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700 transition-colors"
              >
                Maybe later
              </button>
              <button
                onClick={async () => {
                  setShowLoginModal(false);
                  navigate("/login");
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20"
              >
                {!user || user.isAnonymous ? "Login" : "My Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Submission Modal */}
      {isDetailsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-white mb-2">
              Update Details
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              Verified members can contribute details.
            </p>
            <div className="flex flex-col gap-2 mb-4">
              <input
                type="text"
                placeholder="Color (e.g., Orange)"
                value={sightingColor}
                onChange={(e) => setSightingColor(e.target.value)}
                className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm placeholder-slate-500"
              />
              <input
                type="text"
                placeholder="Type (e.g., Persian)"
                value={sightingType}
                onChange={(e) => setSightingType(e.target.value)}
                className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm placeholder-slate-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setSightingNeutered(true)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold ${sightingNeutered === true ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-300"}`}
                >
                  Neutered
                </button>
                <button
                  onClick={() => setSightingNeutered(false)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold ${sightingNeutered === false ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-300"}`}
                >
                  Not Neutered
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const updates = {
                      color: sightingColor || undefined,
                      strayType: sightingType || undefined,
                      isNeutered: sightingNeutered !== null ? sightingNeutered : undefined,
                    };
                    if (id) {
                      await updateCatProfile(id, updates);
                    }
                    setCat((prev) =>
                      prev
                        ? {
                            ...prev,
                            ...(sightingColor ? { color: sightingColor } : {}),
                            ...(sightingType ? { strayType: sightingType } : {}),
                            ...(sightingNeutered !== null ? { isNeutered: sightingNeutered } : {}),
                          }
                        : prev,
                    );
                    alert("Details submitted for community verification!");
                    setSightingColor("");
                    setSightingType("");
                    setSightingNeutered(null);
                    setIsDetailsOpen(false);
                  } catch (e) {
                    console.error(e);
                    alert("Failed to submit details.");
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-bold text-sm shadow-lg shadow-orange-500/20 hover:bg-orange-600"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Gallery Overlay */}
      {isGalleryOpen && (
        <div className="fixed inset-0 z-[60] bg-black text-white flex flex-col w-full">
          <div className="sticky top-0 bg-black/80 backdrop-blur-md p-4 flex justify-between items-center z-10">
            <h2 className="text-xl font-black">
              {viewerIndex === null ? "Gallery" : "Photo Detail"}
            </h2>
            <button
              onClick={() => {
                viewerIndex === null
                  ? setIsGalleryOpen(false)
                  : setViewerIndex(null);
              }}
              className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold hover:bg-slate-700 transition-colors"
            >
              {viewerIndex === null ? "✕" : "←"}
            </button>
          </div>
          <div className="flex-1 w-full overflow-hidden relative">
            {viewerIndex === null ? (
              <div className="grid grid-cols-3 gap-2 overflow-y-auto p-2">
                {cat.gallery &&
                  [...cat.gallery]
                    .sort((a, b) => b.votes - a.votes)
                    .map((photo, i) => (
                      <img
                        key={photo.id}
                        src={photo.url}
                        onClick={() => setViewerIndex(i)}
                        className="aspect-square object-cover rounded-xl cursor-pointer"
                      />
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
                      const gallery = [...(cat.gallery || [])].sort(
                        (a, b) => b.votes - a.votes,
                      );
                      if (info.offset.x > 50 && viewerIndex > 0)
                        setViewerIndex(viewerIndex - 1);
                      else if (
                        info.offset.x < -50 &&
                        viewerIndex < gallery.length - 1
                      )
                        setViewerIndex(viewerIndex + 1);
                    }}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="w-full h-full flex items-center justify-center"
                  >
                    <img
                      src={
                        [...(cat.gallery || [])].sort(
                          (a, b) => b.votes - a.votes,
                        )[viewerIndex].url
                      }
                      className="w-full rounded-2xl p-2"
                    />
                  </motion.div>
                </AnimatePresence>
                <button
                  onClick={async () => {
                    const photo = [...(cat.gallery || [])].sort(
                      (a, b) => b.votes - a.votes,
                    )[viewerIndex!];
                    const change = await executeWithVotePower(
                      "gallery",
                      photo.id,
                      "You voted for this photo!",
                    );
                    if (change !== 0 && cat && id) {
                      const newGallery = (cat.gallery || []).map((g) =>
                        g.id === photo.id
                          ? { ...g, votes: Math.max(0, g.votes + change) }
                          : g,
                      );
                      setCat((prev) =>
                        prev ? { ...prev, gallery: newGallery } : prev,
                      );
                      await updateCatProfile(id, { gallery: newGallery }).catch(
                        () => {},
                      );
                    }
                  }}
                  className={`absolute bottom-6 right-6 backdrop-blur-md text-white font-bold px-6 py-3 rounded-full flex items-center gap-2 transition-colors ${votedGallery.includes([...(cat.gallery || [])].sort((a, b) => b.votes - a.votes)[viewerIndex!].id) ? "bg-orange-500/80 ring-2 ring-orange-400" : "bg-black/50 hover:bg-black/80"}`}
                >
                  ♥️{" "}
                  {
                    [...(cat.gallery || [])].sort((a, b) => b.votes - a.votes)[
                      viewerIndex!
                    ].votes
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
