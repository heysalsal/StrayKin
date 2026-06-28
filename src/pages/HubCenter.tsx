import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronLeft, MapPin, Star, Plus, X, ImagePlus, Camera } from "lucide-react";
import { Hub } from "../types";
import { db } from "../config/firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { useLazyAuth } from "../hooks/useLazyAuth";
import Webcam from "react-webcam";

export default function HubCenter() {
  const navigate = useNavigate();
  const { user } = useLazyAuth();
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [proposeStep, setProposeStep] = useState<"closed" | "camera" | "form">("closed");
  
  // Propose Hub Form State
  const [proposeName, setProposeName] = useState("");
  const [proposeType, setProposeType] = useState<"hub" | "vet" | "shelter" | "cafe" | "petshop">("hub");
  const [proposeAddress, setProposeAddress] = useState("");
  const [proposeContact, setProposeContact] = useState("");
  const [proposeDescription, setProposeDescription] = useState("");
  const [proposeImage, setProposeImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const webcamRef = React.useRef<Webcam>(null);

  const captureWebcam = React.useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setProposeImage(imageSrc);
      setProposeStep("form");
    }
  }, [webcamRef]);

  useEffect(() => {
    fetchHubs();
  }, []);

  const fetchHubs = async () => {
    try {
      const snap = await getDocs(collection(db, 'hubs'));
      const fetchedHubs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hub));
      
      // Filter out inactive hubs based on status or isActive flag
      const activeHubs = fetchedHubs.filter(h => h.isActive !== false && (h as any).status !== 'inactive' && (h as any).status !== 'under_review');
      
      setHubs(activeHubs);
    } catch (err) {
      console.error("Failed to fetch hubs", err);
      setHubs([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredHubs = hubs.filter(hub => 
    hub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (hub.hubType || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposeName || !proposeAddress) {
      alert("Name and Address are required.");
      return;
    }

    if (!user) {
      alert("Please log in to propose a hub.");
      return;
    }

    setIsSubmitting(true);
    try {
      let lat = -6.2; // default
      let lng = 106.8; // default
      // Try to get actual location
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (locErr) {
        console.warn("Could not get location for hub proposal, using default.", locErr);
      }

      const submissionId = `hub_${Date.now()}`;
      
      const docRef = await addDoc(collection(db, "hubs"), {
        name: proposeName,
        hubType: proposeType,
        address: proposeAddress,
        contact: proposeContact,
        description: proposeDescription,
        photoUrl: null, // Defer image save to avoid Firestore limits until uploaded
        lat,
        lng,
        managerIds: [],
        isActive: false, // Not active yet
        status: "under_review", // requires approval
        submissionId,
        proposedBy: user.uid,
        createdAt: new Date().toISOString()
      });

      if (proposeImage) {
        // Send image to backend for upload to CDN and Telegram review
        fetch("/api/submit-for-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
              id: submissionId,
              type: "hub_proposal", 
              details: { name: proposeName, address: proposeAddress, contact: proposeContact, description: proposeDescription }, 
              imageBase64: proposeImage, 
              docIdForReview: docRef.id 
          }),
        }).catch(e => console.warn("Background upload failed", e));
      }

      alert("Hub proposal submitted successfully! It will be reviewed soon.");
      setProposeStep("closed");
      setProposeName("");
      setProposeAddress("");
      setProposeContact("");
      setProposeDescription("");
      setProposeImage(null);
    } catch (error) {
      console.error("Failed to propose hub:", error);
      alert("Failed to propose hub. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="bg-white pl-6 pr-8 pt-safe pb-4 shadow-sm border-b border-slate-100 sticky top-0 z-10">
        <div className="flex items-center gap-4 mb-4 mt-2">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black text-slate-800">Hub Center</h1>
        </div>

        <div className="flex gap-2 items-stretch">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search hubs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border-none rounded-2xl pl-11 pr-4 py-3.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <button 
            onClick={() => setProposeStep("camera")}
            className="flex items-center justify-center bg-indigo-600 text-white rounded-2xl px-5 shadow-sm hover:bg-indigo-700 transition-colors shrink-0"
          >
            <Plus className="w-5 h-5 sm:mr-1.5" />
            <span className="hidden sm:inline font-bold text-sm">Add Hub</span>
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 relative">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : filteredHubs.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 pb-20">
            {filteredHubs.map(hub => (
              <div 
                key={hub.id} 
                onClick={() => navigate(`/hub/${hub.id}`)}
                className="bg-white rounded-3xl p-3 shadow-sm border border-slate-100 active:scale-95 transition-transform cursor-pointer flex flex-col"
              >
                <div className="w-full aspect-[4/3] rounded-2xl bg-slate-100 mb-3 overflow-hidden relative">
                  {hub.photoUrl ? (
                    <img src={hub.photoUrl} alt={hub.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">🏪</div>
                  )}
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span className="text-[10px] font-bold text-slate-700">4.8</span>
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  <h3 className="font-bold text-slate-800 text-sm leading-tight mb-1 line-clamp-1">{hub.name}</h3>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2">
                    {hub.hubType || 'Community Hub'}
                  </span>
                  <div className="flex items-center gap-1 text-slate-500 mt-auto">
                    <MapPin className="w-3 h-3" />
                    <span className="text-xs font-medium truncate">2.5 km away</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">🏪</div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">No Hubs Found</h3>
            <p className="text-sm text-slate-500">There are still no hubs registered in the area.</p>
          </div>
        )}

      </div>

      {/* Propose Hub Camera Step */}
      {proposeStep === "camera" && (
        <div className="fixed inset-x-0 inset-y-0 bg-black z-[100] flex flex-col pt-safe px-0 pb-0 overflow-hidden">
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
            <div className="p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
              <button
                onClick={() => setProposeStep("closed")}
                className="pointer-events-auto rounded-full w-10 h-10 flex items-center justify-center text-white bg-black/30 backdrop-blur-md"
              >
                <X className="w-6 h-6" />
              </button>
              <h2 className="text-white font-bold text-lg tracking-wide drop-shadow-md">
                Hub Photo
              </h2>
              <button
                onClick={() => setProposeStep("form")}
                className="pointer-events-auto text-white font-bold text-sm bg-black/30 backdrop-blur-md px-4 py-2 rounded-full"
              >
                Skip
              </button>
            </div>

            <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent p-8 pb-safe-12 flex justify-center items-center pointer-events-auto w-full gap-8">
              <label className="w-12 h-12 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white cursor-pointer hover:bg-black/70 transition-colors">
                <ImagePlus className="w-5 h-5" />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setProposeImage(reader.result as string);
                        setProposeStep("form");
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  captureWebcam();
                }}
                className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-[0_0_0_6px_rgba(79,70,229,0.5)] active:scale-95 transition-transform"
              >
                <div className="w-16 h-16 rounded-full border-2 border-slate-200 flex items-center justify-center bg-white">
                  <div className="w-8 h-8 bg-indigo-600 rounded-full" />
                </div>
              </button>

              <div className="w-12 h-12" />
            </div>
          </div>
        </div>
      )}

      {/* Propose Hub Form Modal */}
      {proposeStep === "form" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            onClick={() => setProposeStep("closed")}
          />
          
          <div className="bg-white w-full max-w-md rounded-[2rem] p-6 sm:p-8 relative z-10 max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col mx-auto">
            <div className="flex justify-between items-center mb-6 px-0 -ml-[15px] mr-[14px]">
              <button 
                onClick={() => setProposeStep("camera")}
                className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors shrink-0"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-xl font-black text-slate-800 text-center flex-1">Hub Details</h2>
              <button 
                onClick={() => setProposeStep("closed")}
                className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleProposeSubmit} className="flex flex-col gap-4 w-full p-0 my-0 -ml-[15px] -mr-[6px]">
              {proposeImage && (
                <div className="relative w-full h-32 rounded-xl overflow-hidden mb-2 shadow-sm border border-slate-100">
                  <img src={proposeImage} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setProposeImage(null)}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hub Name</label>
                <input 
                  type="text" 
                  required
                  value={proposeName}
                  onChange={e => setProposeName(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="e.g. Happy Tails Vet"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hub Type</label>
                <select 
                  value={proposeType}
                  onChange={e => setProposeType(e.target.value as any)}
                  className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="hub">Community Hub</option>
                  <option value="vet">Vet Clinic</option>
                  <option value="shelter">Animal Shelter</option>
                  <option value="cafe">Pet Cafe</option>
                  <option value="petshop">Pet Shop</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Address / Location Info</label>
                <input 
                  type="text"
                  required
                  value={proposeAddress}
                  onChange={e => setProposeAddress(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Street name or recognizable location"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contact Number</label>
                <input 
                  type="tel"
                  required
                  value={proposeContact}
                  onChange={e => setProposeContact(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="e.g. +6281234567890"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                <textarea 
                  value={proposeDescription}
                  onChange={e => setProposeDescription(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 min-h-[100px]"
                  placeholder="What makes this hub special?"
                />
              </div>

              {!proposeImage && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hub Photo (Optional)</label>
                  <div className="relative w-full h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl overflow-hidden flex flex-col items-center justify-center text-slate-400 hover:bg-slate-100 hover:border-indigo-300 transition-colors">
                    <ImagePlus className="w-8 h-8 mb-2 text-slate-300" />
                    <span className="text-xs font-medium">Tap to upload photo</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setProposeImage(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="bg-indigo-50 rounded-xl p-4 mt-2 text-center">
                <p className="text-xs text-indigo-700 font-medium">
                  Note: Your current GPS location will be attached to this proposal. Submissions require approval from an administrator before appearing on the map.
                </p>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full py-4 mt-2 bg-indigo-600 text-white font-bold rounded-2xl shadow-md shadow-indigo-200 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center text-center"
              >
                {isSubmitting ? "Submitting..." : "Submit Proposal"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
