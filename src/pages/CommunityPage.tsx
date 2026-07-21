import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  ChevronLeft,
  MapPin,
  Star,
  Plus,
  X,
  ImagePlus,
  Camera,
} from "lucide-react";
import { Hub } from "../types";
import { db } from "../config/firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { useLazyAuth } from "../hooks/useLazyAuth";
import Webcam from "react-webcam";

export default function CommunityPage() {
  const navigate = useNavigate();
  const { user } = useLazyAuth();
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [proposeStep, setProposeStep] = useState<"closed" | "camera" | "form">(
    "closed",
  );

  const [activeTab, setActiveTab] = useState<
    "hubs" | "missing" | "board" | "friends" | "profile"
  >("hubs");

  // Propose Hub Form State
  const [proposeName, setProposeName] = useState("");
  const [proposeType, setProposeType] = useState<
    "hub" | "vet" | "shelter" | "cafe" | "petshop"
  >("hub");
  const [proposeAddress, setProposeAddress] = useState("");
  const [proposeContact, setProposeContact] = useState("");
  const [proposeDescription, setProposeDescription] = useState("");
  const [proposeImage, setProposeImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Missing Board State
  const [missingPets, setMissingPets] = useState<any[]>([]);
  const [loadingMissing, setLoadingMissing] = useState(true);
  const [missingStep, setMissingStep] = useState<"closed" | "camera" | "form">(
    "closed",
  );
  const [missingName, setMissingName] = useState("");
  const [missingChars, setMissingChars] = useState("");
  const [missingLocation, setMissingLocation] = useState("Current Location");
  const [missingImages, setMissingImages] = useState<string[]>([]);

  // BBS State
  const [bbsPosts, setBbsPosts] = useState<any[]>([]);
  const [loadingBbs, setLoadingBbs] = useState(true);
  const [showBbsForm, setShowBbsForm] = useState(false);
  const [bbsTitle, setBbsTitle] = useState("");
  const [bbsContent, setBbsContent] = useState("");

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedMissingPet, setSelectedMissingPet] = useState<any | null>(
    null,
  );
  const [selectedBbsPost, setSelectedBbsPost] = useState<any | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isReplying, setIsReplying] = useState(false);

  const webcamRef = React.useRef<Webcam>(null);

  const captureWebcam = React.useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      setProposeImage(imageSrc);
      setProposeStep("form");
    }
  }, [webcamRef]);

  const captureMissingWebcam = React.useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      setMissingImages((prev) => {
        if (prev.length < 3) return [...prev, imageSrc];
        return prev;
      });
      setMissingStep("form");
    }
  }, [webcamRef]);

  const requireAuth = (action: () => void) => {
    if (!user || user.isAnonymous) {
      setShowLoginModal(true);
    } else {
      action();
    }
  };

  useEffect(() => {
    fetchHubs();
    fetchMissingPets();
    fetchBbsPosts();
  }, []);

  const fetchBbsPosts = async () => {
    try {
      const snap = await getDocs(collection(db, "bbs_posts"));
      const posts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      // Sort by newest
      posts.sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      if (posts.length === 0) {
        setBbsPosts([]);
      } else {
        setBbsPosts(posts);
      }
    } catch (err) {
      console.error("Failed to fetch BBS posts", err);
      setBbsPosts([]);
    } finally {
      setLoadingBbs(false);
    }
  };

  const handleBbsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bbsTitle || !bbsContent) return;
    if (!user) {
      alert("Please log in to post.");
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "bbs_posts"), {
        title: bbsTitle,
        content: bbsContent,
        authorId: user.uid,
        authorName: user.displayName || `User #${user.uid.slice(-4)}`,
        createdAt: new Date().toISOString(),
        replies: 0,
      });
      alert("Discussion posted!");
      setShowBbsForm(false);
      setBbsTitle("");
      setBbsContent("");
      fetchBbsPosts();
    } catch (err) {
      console.error("Failed to post discussion", err);
      alert("Failed to post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent || !selectedBbsPost) return;
    if (!user) {
      alert("Please log in to reply.");
      return;
    }
    setIsReplying(true);
    try {
      // In a real app, this would add to a subcollection or array
      // and update the replies count on the parent post.
      // For this demo, we'll just mock success.
      alert("Reply posted successfully!");
      setReplyContent("");
      // Mock updating the UI
      setSelectedBbsPost({
        ...selectedBbsPost,
        replies: (selectedBbsPost.replies || 0) + 1,
      });
      fetchBbsPosts();
    } catch (err) {
      console.error("Failed to post reply", err);
      alert("Failed to post. Please try again.");
    } finally {
      setIsReplying(false);
    }
  };

  const fetchMissingPets = async () => {
    try {
      const snap = await getDocs(collection(db, "missing_pets"));
      const pets = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (pets.length === 0) {
        setMissingPets([]);
      } else {
        setMissingPets(pets);
      }
    } catch (err) {
      console.error("Failed to fetch missing pets", err);
      setMissingPets([]);
    } finally {
      setLoadingMissing(false);
    }
  };

  const handleMissingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!missingName || !missingChars || missingImages.length === 0) {
      alert("Name, characteristics, and at least one photo are required.");
      return;
    }
    if (!user) {
      alert("Please log in to post a missing pet.");
      return;
    }
    setIsSubmitting(true);
    try {
      const uploadedUrls = [];
      for (const img of missingImages) {
        if (img.startsWith("data:image")) {
          try {
            const res = await fetch("/api/upload-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageBase64: img }),
            });
            const data = await res.json();
            if (data.url) {
              uploadedUrls.push(data.url);
            } else {
              uploadedUrls.push(img); // Fallback to base64
            }
          } catch (e) {
            console.error("Failed to upload missing pet image", e);
            uploadedUrls.push(img); // Fallback to base64
          }
        } else {
          uploadedUrls.push(img);
        }
      }

      await addDoc(collection(db, "missing_pets"), {
        name: missingName,
        characteristics: missingChars,
        location: missingLocation || "Current Location",
        photoUrls: uploadedUrls,
        photoUrl: uploadedUrls[0] || null, // For backwards compatibility
        status: "missing",
        userId: user.uid,
        createdAt: new Date().toISOString(),
      });
      alert("Missing pet posted successfully!");
      setMissingStep("closed");
      setMissingName("");
      setMissingChars("");
      setMissingLocation("Current Location");
      setMissingImages([]);
      fetchMissingPets();
    } catch (err) {
      console.error("Failed to post missing pet", err);
      alert("Failed to post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchHubs = async () => {
    try {
      const snap = await getDocs(collection(db, "hubs"));
      const fetchedHubs = snap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Hub,
      );

      // Filter out inactive hubs based on status or isActive flag
      const activeHubs = fetchedHubs.filter(
        (h) =>
          h.isActive !== false &&
          (h as any).status !== "inactive" &&
          (h as any).status !== "under_review",
      );

      if (activeHubs.length === 0) {
        setHubs([]);
      } else {
        setHubs(activeHubs);
      }
    } catch (err) {
      console.error("Failed to fetch hubs", err);
      setHubs([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredHubs = hubs.filter(
    (hub) =>
      hub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (hub.hubType || "").toLowerCase().includes(searchQuery.toLowerCase()),
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
        const pos = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
            });
          },
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (locErr) {
        console.warn(
          "Could not get location for hub proposal, using default.",
          locErr,
        );
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
        createdAt: new Date().toISOString(),
      });

      if (proposeImage) {
        // Send image to backend for upload to CDN and Telegram review
        fetch("/api/submit-for-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: submissionId,
            type: "hub_proposal",
            details: {
              name: proposeName,
              address: proposeAddress,
              contact: proposeContact,
              description: proposeDescription,
            },
            imageBase64: proposeImage,
            docIdForReview: docRef.id,
          }),
        }).catch((e) => console.warn("Background upload failed", e));
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
    <div className="h-full w-full overflow-y-auto bg-slate-50 font-sans">
      <div className="w-full max-w-2xl mx-auto flex flex-col min-h-full">
        <div className="bg-white px-0 pt-safe pb-0 shadow-sm border-b border-slate-100 sticky top-0 z-10">
          <div className="flex items-center gap-4 mb-2 mt-2 px-6">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-black text-slate-800">Community</h1>
          </div>

          <div className="flex overflow-x-auto hide-scrollbar px-6 gap-2 pb-2 mt-4">
            {[
              { id: "hubs", label: "Hubs" },
              { id: "missing", label: "Missing Board" },
              { id: "board", label: "Discussions" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-colors ${
                  activeTab === tab.id
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "hubs" && (
            <div className="flex gap-2 items-stretch px-6 pb-4 mt-2">
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
                onClick={() => requireAuth(() => setProposeStep("camera"))}
                className="flex items-center justify-center bg-indigo-600 text-white rounded-2xl px-5 shadow-sm hover:bg-indigo-700 transition-colors shrink-0"
              >
                <Plus className="w-5 h-5 sm:mr-1.5" />
                <span className="hidden sm:inline font-bold text-sm">
                  Add Hub
                </span>
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 p-6 relative">
          {activeTab === "hubs" ? (
            loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            ) : filteredHubs.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 pb-20">
                {filteredHubs.map((hub) => (
                  <div
                    key={hub.id}
                    onClick={() => navigate(`/hub/${hub.id}`)}
                    className="bg-white rounded-3xl p-3 shadow-sm border border-slate-100 active:scale-95 transition-transform cursor-pointer flex flex-col"
                  >
                    <div className="w-full aspect-[4/3] rounded-2xl bg-slate-100 mb-3 overflow-hidden relative">
                      {hub.photoUrl ? (
                        <img
                          src={hub.photoUrl}
                          alt={hub.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">
                          🏪
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        <span className="text-[10px] font-bold text-slate-700">
                          4.8
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col">
                      <h3 className="font-bold text-slate-800 text-sm leading-tight mb-1 line-clamp-1">
                        {hub.name}
                      </h3>
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2">
                        {hub.hubType || "Community Hub"}
                      </span>
                      <div className="flex items-center gap-1 text-slate-500 mt-auto">
                        <MapPin className="w-3 h-3" />
                        <span className="text-xs font-medium truncate">
                          2.5 km away
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="text-4xl mb-4">🏪</div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">
                  No Hubs Found
                </h3>
                <p className="text-sm text-slate-500">
                  There are still no hubs registered in the area.
                </p>
              </div>
            )
          ) : activeTab === "missing" ? (
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-800">
                  Missing Pets
                </h2>
                <button
                  onClick={() => requireAuth(() => setMissingStep("camera"))}
                  className="flex items-center gap-1 text-sm font-bold bg-rose-50 text-rose-600 px-3 py-1.5 rounded-full hover:bg-rose-100 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Post Missing
                </button>
              </div>
              {loadingMissing ? (
                <div className="flex justify-center items-center h-32">
                  <div className="w-8 h-8 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin"></div>
                </div>
              ) : missingPets.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 pb-20">
                  {missingPets.map((pet) => (
                    <div
                      key={pet.id}
                      onClick={() => setSelectedMissingPet(pet)}
                      className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex gap-4 cursor-pointer active:scale-[0.98] transition-transform"
                    >
                      <div className="w-24 h-24 rounded-2xl bg-slate-100 overflow-hidden shrink-0">
                        {pet.photoUrl ? (
                          <img
                            src={pet.photoUrl}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl">
                            😿
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-bold text-slate-800 text-lg leading-tight truncate">
                            {pet.name}
                          </h3>
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${pet.status === "found" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                          >
                            {pet.status === "found" ? "Found" : "Missing"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-2 line-clamp-2">
                          {pet.characteristics}
                        </p>
                        {pet.location && (
                          <div className="flex items-center gap-1 text-slate-400 mt-1 mb-2">
                            <MapPin className="w-3 h-3" />
                            <span className="text-[10px] font-medium truncate">
                              {pet.location}
                            </span>
                          </div>
                        )}
                        <p className="text-[10px] text-slate-400 font-medium">
                          Posted {new Date(pet.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="text-4xl mb-4">😿</div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">
                    No Missing Pets
                  </h3>
                  <p className="text-sm text-slate-500">
                    There are no missing pets reported right now.
                  </p>
                </div>
              )}
            </div>
          ) : activeTab === "board" ? (
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-800">
                  Bulletin Board
                </h2>
                <button
                  onClick={() => requireAuth(() => setShowBbsForm(true))}
                  className="flex items-center gap-1 text-sm font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors"
                >
                  <Plus className="w-4 h-4" /> New Topic
                </button>
              </div>

              {loadingBbs ? (
                <div className="flex justify-center items-center h-32">
                  <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                </div>
              ) : bbsPosts.length > 0 ? (
                <div className="flex flex-col gap-3 pb-20">
                  {bbsPosts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => setSelectedBbsPost(post)}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 cursor-pointer active:bg-slate-50 transition-colors"
                    >
                      <h3 className="font-bold text-slate-800 text-base mb-1">
                        {post.title}
                      </h3>
                      <p className="text-sm text-slate-500 mb-3 line-clamp-2">
                        {post.content}
                      </p>
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <span>By {post.authorName}</span>
                        <div className="flex items-center gap-2">
                          <span>
                            {new Date(post.createdAt).toLocaleDateString()}
                          </span>
                          <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
                            {post.replies || 0} REPLIES
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="text-4xl mb-4">💬</div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">
                    No Discussions Yet
                  </h3>
                  <p className="text-sm text-slate-500">
                    Be the first to start a conversation!
                  </p>
                </div>
              )}
            </div>
          ) : null}
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
                height: { ideal: 1080 },
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
              <div className="flex justify-between items-center mb-6">
                <button
                  onClick={() => setProposeStep("camera")}
                  className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors shrink-0"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-black text-slate-800 text-center flex-1">
                  Hub Details
                </h2>
                <button
                  onClick={() => setProposeStep("closed")}
                  className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={handleProposeSubmit}
                className="flex flex-col gap-4 w-full"
              >
                {proposeImage && (
                  <div className="relative w-full h-32 rounded-xl overflow-hidden mb-2 shadow-sm border border-slate-100">
                    <img
                      src={proposeImage}
                      alt="Preview"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
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
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Hub Name
                  </label>
                  <input
                    type="text"
                    required
                    value={proposeName}
                    onChange={(e) => setProposeName(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="e.g. Happy Tails Vet"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Hub Type
                  </label>
                  <select
                    value={proposeType}
                    onChange={(e) => setProposeType(e.target.value as any)}
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
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Address / Location Info
                  </label>
                  <input
                    type="text"
                    required
                    value={proposeAddress}
                    onChange={(e) => setProposeAddress(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Street name or recognizable location"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Contact Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={proposeContact}
                    onChange={(e) => setProposeContact(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="e.g. +6281234567890"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Description
                  </label>
                  <textarea
                    value={proposeDescription}
                    onChange={(e) => setProposeDescription(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 min-h-[100px]"
                    placeholder="What makes this hub special?"
                  />
                </div>

                {!proposeImage && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Hub Photo (Optional)
                    </label>
                    <div className="relative w-full h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl overflow-hidden flex flex-col items-center justify-center text-slate-400 hover:bg-slate-100 hover:border-indigo-300 transition-colors">
                      <ImagePlus className="w-8 h-8 mb-2 text-slate-300" />
                      <span className="text-xs font-medium">
                        Tap to upload photo
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () =>
                              setProposeImage(reader.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="bg-indigo-50 rounded-xl p-4 mt-2 text-center">
                  <p className="text-xs text-indigo-700 font-medium">
                    Note: Your current GPS location will be attached to this
                    proposal. Submissions require approval from an administrator
                    before appearing on the map.
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

        {/* Missing Pet Camera Step */}
        {missingStep === "camera" && (
          <div className="fixed inset-x-0 inset-y-0 bg-black z-[100] flex flex-col pt-safe px-0 pb-0 overflow-hidden">
            {/* @ts-ignore */}
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "environment" }}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute top-0 inset-x-0 p-4 pt-safe flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent z-10">
              <button
                onClick={() => setMissingStep("closed")}
                className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white"
              >
                <X className="w-6 h-6" />
              </button>
              <span className="text-white font-bold tracking-wider uppercase text-sm">
                Post Missing Pet
              </span>
            </div>
            <div className="absolute bottom-0 inset-x-0 p-8 pb-safe flex justify-center bg-gradient-to-t from-black/80 to-transparent z-10">
              <button
                onClick={captureMissingWebcam}
                className="w-20 h-20 bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm"
              >
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <Camera className="w-8 h-8 text-rose-600" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Missing Pet Form Step */}
        {missingStep === "form" && (
          <div className="fixed inset-x-0 inset-y-0 bg-slate-50 z-[100] flex flex-col pt-safe px-0 pb-0 overflow-y-auto">
            <div className="w-full max-w-2xl mx-auto flex flex-col min-h-full">
              <div className="sticky top-0 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10 border-b border-slate-100 shadow-sm">
                <h2 className="text-xl font-black text-slate-800">
                  Pet Details
                </h2>
                <button
                  onClick={() => {
                    setMissingStep("closed");
                    setMissingImages([]);
                  }}
                  className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <form onSubmit={handleMissingSubmit} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Photos (Max 3)
                    </label>
                    <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                      {missingImages.map((img, idx) => (
                        <div
                          key={idx}
                          className="relative w-32 h-32 shrink-0 snap-start bg-slate-100 rounded-2xl overflow-hidden shadow-sm"
                        >
                          <img
                            src={img}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setMissingImages((prev) =>
                                prev.filter((_, i) => i !== idx),
                              )
                            }
                            className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {missingImages.length < 3 && (
                        <label className="w-32 h-32 shrink-0 snap-start bg-slate-100 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-300 text-slate-500 cursor-pointer hover:bg-slate-200 transition-colors">
                          <ImagePlus className="w-6 h-6 mb-2" />
                          <span className="text-xs font-bold">Add Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setMissingImages((prev) => [
                                    ...prev,
                                    reader.result as string,
                                  ]);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Pet Name
                    </label>
                    <input
                      type="text"
                      required
                      value={missingName}
                      onChange={(e) => setMissingName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-rose-500/20"
                      placeholder="What is the pet's name?"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Last Seen Location
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={missingLocation}
                        onChange={(e) => setMissingLocation(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-4 pl-12 text-sm font-medium focus:ring-2 focus:ring-rose-500/20"
                        placeholder="e.g. Near Central Park"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Characteristics
                    </label>
                    <textarea
                      required
                      value={missingChars}
                      onChange={(e) => setMissingChars(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-rose-500/20 min-h-[100px]"
                      placeholder="Breed, color, collar details..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 mt-2 bg-rose-600 text-white font-bold rounded-2xl shadow-md shadow-rose-200 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center text-center"
                  >
                    {isSubmitting ? "Posting..." : "Post Missing Pet"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* BBS Form Step */}
        {showBbsForm && (
          <div className="fixed inset-x-0 inset-y-0 bg-slate-50 z-[100] flex flex-col pt-safe px-0 pb-0 overflow-y-auto">
            <div className="w-full max-w-2xl mx-auto flex flex-col min-h-full">
              <div className="sticky top-0 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10 border-b border-slate-100 shadow-sm">
                <h2 className="text-xl font-black text-slate-800">New Topic</h2>
                <button
                  onClick={() => setShowBbsForm(false)}
                  className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <form onSubmit={handleBbsSubmit} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Topic Title
                    </label>
                    <input
                      type="text"
                      required
                      value={bbsTitle}
                      onChange={(e) => setBbsTitle(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="e.g. Any vet recommendations?"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Message
                    </label>
                    <textarea
                      required
                      value={bbsContent}
                      onChange={(e) => setBbsContent(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 min-h-[150px]"
                      placeholder="Share your thoughts..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 mt-2 bg-indigo-600 text-white font-bold rounded-2xl shadow-md shadow-indigo-200 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center text-center"
                  >
                    {isSubmitting ? "Posting..." : "Post Topic"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Selected Missing Pet Modal */}
        {selectedMissingPet && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="bg-white rounded-3xl overflow-hidden w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              <div className="relative h-64 bg-slate-100 shrink-0">
                {selectedMissingPet.photoUrls &&
                selectedMissingPet.photoUrls.length > 0 ? (
                  <div className="flex overflow-x-auto snap-x h-full">
                    {selectedMissingPet.photoUrls.map(
                      (url: string, i: number) => (
                        <img
                          key={i}
                          src={url}
                          className="w-full h-full object-cover shrink-0 snap-start"
                          alt={`${selectedMissingPet.name} - ${i + 1}`}
                        />
                      ),
                    )}
                  </div>
                ) : selectedMissingPet.photoUrl ? (
                  <img
                    src={selectedMissingPet.photoUrl}
                    className="w-full h-full object-cover"
                    alt={selectedMissingPet.name}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl">
                    😿
                  </div>
                )}
                <button
                  onClick={() => setSelectedMissingPet(null)}
                  className="absolute top-4 right-4 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                {selectedMissingPet.photoUrls &&
                  selectedMissingPet.photoUrls.length > 1 && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      {selectedMissingPet.photoUrls.map((_: any, i: number) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-white/70 shadow-sm"
                        />
                      ))}
                    </div>
                  )}
              </div>
              <div className="p-6 overflow-y-auto">
                <div className="flex justify-between items-start mb-2">
                  <h2 className="text-2xl font-black text-slate-800">
                    {selectedMissingPet.name}
                  </h2>
                  <span
                    className={`text-xs font-black uppercase px-3 py-1 rounded-full ${selectedMissingPet.status === "found" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                  >
                    {selectedMissingPet.status === "found"
                      ? "Found"
                      : "Missing"}
                  </span>
                </div>

                {selectedMissingPet.location && (
                  <div className="flex items-center gap-1.5 text-slate-500 mb-4">
                    <MapPin className="w-4 h-4 text-rose-500" />
                    <span className="text-sm font-medium">
                      {selectedMissingPet.location}
                    </span>
                  </div>
                )}

                <p className="text-slate-600 text-sm mb-6">
                  {selectedMissingPet.characteristics}
                </p>
                <div className="text-xs text-slate-400 font-medium border-t border-slate-100 pt-4">
                  Reported on{" "}
                  {new Date(selectedMissingPet.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Selected BBS Post Modal */}
        {selectedBbsPost && (
          <div className="fixed inset-0 z-[200] flex flex-col bg-slate-50 animate-in slide-in-from-bottom-full duration-300">
            <div className="sticky top-0 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center z-10 border-b border-slate-100 shadow-sm pt-safe gap-4">
              <button
                onClick={() => setSelectedBbsPost(null)}
                className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 shrink-0"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-lg font-black text-slate-800 truncate flex-1">
                Discussion
              </h2>
            </div>
            <div className="p-6 overflow-y-auto flex-1 w-full max-w-2xl mx-auto flex flex-col">
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-6 shrink-0">
                <h1 className="text-2xl font-black text-slate-800 mb-4">
                  {selectedBbsPost.title}
                </h1>
                <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-6">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                    {selectedBbsPost.authorName?.[0] || "A"}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800">
                      {selectedBbsPost.authorName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(selectedBbsPost.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  {selectedBbsPost.content}
                </p>
              </div>

              <h3 className="font-bold text-slate-800 mb-4">
                Replies ({selectedBbsPost.replies || 0})
              </h3>

              <div className="flex-1 overflow-y-auto pb-4">
                <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
                  No replies yet. Be the first to reply!
                </div>
              </div>

              <div className="mt-auto pt-4 bg-slate-50 sticky bottom-0">
                <form onSubmit={handleReplySubmit} className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 rounded-full px-5 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                    placeholder="Type a reply..."
                  />
                  <button
                    type="submit"
                    disabled={isReplying || !replyContent}
                    className="bg-indigo-600 text-white font-bold rounded-full px-6 py-3 shadow-md shadow-indigo-200 active:scale-95 transition-transform disabled:opacity-50 shrink-0"
                  >
                    {isReplying ? "..." : "Reply"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Login Modal */}
        {showLoginModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <h2 className="text-xl font-black text-white mb-2">
                Login Required
              </h2>
              <p className="text-slate-400 text-sm mb-6">
                You need to be registered and logged in to perform this action.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700 transition-colors"
                >
                  Maybe later
                </button>
                <button
                  onClick={() => {
                    setShowLoginModal(false);
                    navigate("/login");
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-indigo-500 text-white font-bold text-sm hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20"
                >
                  Login
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
