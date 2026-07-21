import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, MapPin, Search, Star, Info, ShieldCheck } from "lucide-react";
import { Hub, HubPet } from "../types";
import { db } from "../config/firebase";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion } from "firebase/firestore";
import { useLazyAuth } from "../hooks/useLazyAuth";

export default function HubDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useLazyAuth();
  const [hub, setHub] = useState<Hub | null>(null);
  const [pets, setPets] = useState<HubPet[]>([]);
  const [products, setProducts] = useState<any[]>([]); // Assuming products will be added later
  const [activeTab, setActiveTab] = useState<"pets" | "products" | "info">("pets");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    const fetchHubAndData = async () => {
      try {
        if (!id) return;
        
        // Fetch Hub
        const snap = await getDoc(doc(db, 'hubs', id));
        if (snap.exists()) {
          setHub({ id: snap.id, ...snap.data() } as Hub);
        } else {
          setHub(null);
        }

        // Fetch Pets
        const q = query(collection(db, 'pets'), where('hub_id', '==', id));
        const petsSnap = await getDocs(q);
        setPets(petsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HubPet)));
        
        // Fetch Products (Placeholder for future)
        // const productsSnap = await getDocs(query(collection(db, 'products'), where('hub_id', '==', id)));
        // setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      } catch (err) {
        console.error("Failed to fetch hub data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHubAndData();
  }, [id]);

  const handleClaimHub = async () => {
    if (!user) {
      alert("Please log in to claim this hub.");
      return;
    }
    if (!hub || !id) return;

    setIsClaiming(true);
    try {
      await updateDoc(doc(db, "hubs", id), {
        managerIds: arrayUnion(user.uid)
      });
      setHub({ ...hub, managerIds: [...(hub.managerIds || []), user.uid] });
      alert("You have successfully claimed this hub and are now a manager.");
    } catch (error) {
      console.error("Failed to claim hub:", error);
      alert("Failed to claim hub. Please try again.");
    } finally {
      setIsClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full w-full bg-slate-50 flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!hub) return (
    <div className="h-full w-full overflow-y-auto bg-slate-50 flex flex-col items-center justify-center font-sans">
      <h2 className="text-xl font-bold text-slate-800 mb-4">Hub Not Found</h2>
      <button onClick={() => navigate(-1)} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-sm hover:bg-indigo-700">Go Back</button>
    </div>
  );

  const displayPets = pets.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const displayProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const isManager = user && hub.managerIds?.includes(user.uid);

  return (
    <div className="h-full w-full overflow-y-auto bg-slate-50 flex flex-col font-sans pb-safe">
      <div className="relative h-64 bg-slate-200 shrink-0">
        {hub.photoUrl ? (
          <img src={hub.photoUrl} alt={hub.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">🏪</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        <button
          onClick={() => navigate(-1)}
          className="absolute top-safe left-4 mt-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div className="absolute bottom-6 left-6 right-6">
          <span className="bg-indigo-500 text-white px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2 inline-block shadow-sm">
            {hub.hubType || "Hub"}
          </span>
          <h1 className="text-3xl font-black text-white leading-tight drop-shadow-sm mb-1">{hub.name}</h1>
          <div className="flex items-center gap-4 text-white/90">
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-medium">2.5 km away</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="text-sm font-bold">4.8 (120 reviews)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white px-6 py-4 shadow-sm sticky top-0 z-10 border-b border-slate-100">
        {activeTab !== "info" && (
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border-none rounded-2xl pl-11 pr-4 py-3.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("pets")}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-colors ${
              activeTab === "pets" 
                ? "bg-indigo-600 text-white shadow-md" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Pets
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-colors ${
              activeTab === "products" 
                ? "bg-indigo-600 text-white shadow-md" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Products
          </button>
          <button
            onClick={() => setActiveTab("info")}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-1 ${
              activeTab === "info" 
                ? "bg-indigo-600 text-white shadow-md" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Info
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === "info" && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-500" /> About this Hub
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {hub.description || "No description provided."}
              </p>
            </div>

            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-500" /> Location
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                {hub.address || "No address provided."}
              </p>
            </div>

            {!isManager && (
              <div className="bg-indigo-50 rounded-3xl p-6 border border-indigo-100 mt-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-indigo-900 mb-1">Are you the owner/manager?</h4>
                    <p className="text-xs text-indigo-700/80 mb-4 leading-relaxed">
                      Claim this hub to manage its pets, products, and information directly.
                    </p>
                    <button
                      onClick={handleClaimHub}
                      disabled={isClaiming}
                      className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      {isClaiming ? "Claiming..." : "Claim This Hub"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {isManager && (
              <div className="bg-emerald-50 rounded-3xl p-4 border border-emerald-100 flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                <p className="text-sm font-bold text-emerald-800">You manage this hub.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "pets" && (
          <div className="grid grid-cols-2 gap-4">
            {displayPets.map(pet => (
              <div 
                key={pet.id} 
                onClick={() => navigate(`/pet/${pet.id}`)}
                className="bg-white rounded-3xl p-3 shadow-sm border border-slate-100 cursor-pointer active:scale-95 transition-transform"
              >
                <div className="w-full aspect-square rounded-2xl bg-slate-100 mb-3 overflow-hidden relative">
                  {pet.photoDataUrl ? (
                    <img src={pet.photoDataUrl} alt={pet.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">🐾</div>
                  )}
                  <div className="absolute top-2 left-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-800">{pet.status}</span>
                  </div>
                </div>
                <h3 className="font-bold text-slate-800 text-sm mb-1">{pet.name}</h3>
                <p className="text-xs font-medium text-slate-500">{pet.breed || "Cat"}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "products" && (
          <div className="grid grid-cols-2 gap-4">
            {displayProducts.map(prod => (
              <div key={prod.id} className="bg-white rounded-3xl p-3 shadow-sm border border-slate-100">
                <div className="w-full aspect-square rounded-2xl bg-slate-100 mb-3 overflow-hidden relative">
                  {/* Just using dummy images for products, but in a real app these would be product images */}
                  <div className="w-full h-full flex items-center justify-center text-3xl">🛍️</div>
                  <div className="absolute top-2 left-2 bg-indigo-600/90 backdrop-blur px-2 py-1 rounded-lg">
                    <span className="text-[10px] font-bold text-white">{prod.price}</span>
                  </div>
                </div>
                <h3 className="font-bold text-slate-800 text-sm mb-1 leading-tight">{prod.name}</h3>
              </div>
            ))}
          </div>
        )}
        
        {((activeTab === "pets" && displayPets.length === 0) || (activeTab === "products" && displayProducts.length === 0)) && (
          <div className="text-center py-12">
            <p className="text-sm text-slate-500 font-medium">No {activeTab} found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
