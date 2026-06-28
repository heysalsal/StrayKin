import React, { useState, useEffect } from "react";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { Hub, HubPet } from "../types";
import { Plus, Image as ImageIcon, MapPin, XCircle, Settings, Camera, ArrowLeft } from "lucide-react";

export function HubManager({ hubId, userId, onClose }: { hubId: string, userId: string, onClose?: () => void }) {
  const [hub, setHub] = useState<Hub | null>(null);
  const [pets, setPets] = useState<HubPet[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms state
  const [editHubMode, setEditHubMode] = useState(false);
  const [hubFormData, setHubFormData] = useState({ name: "", description: "", address: "", photoUrl: "", socialMediaUrls: "", hubType: "hub" });

  const [addPetMode, setAddPetMode] = useState(false);
  const [editingPetId, setEditingPetId] = useState<string | null>(null);
  const [petFormData, setPetFormData] = useState({ name: "",  age: "", breed: "", status: "Available for Adoption", photoDataUrl: "" });

  const fetchHubData = async () => {
    setLoading(true);
    try {
      const hubRef = doc(db, "hubs", hubId);
      const hubSnap = await getDoc(hubRef);
      if (hubSnap.exists()) {
        const h = { id: hubSnap.id, ...hubSnap.data() } as Hub;
        setHub(h);
        setHubFormData({
          name: h.name || "",
          description: h.description || "",
          address: h.address || "",
          photoUrl: h.photoUrl || "",
          socialMediaUrls: (h.socialMediaUrls || []).join(", "),
          hubType: h.hubType || "hub",
        });
      }

      const q = query(collection(db, "pets"), where("hub_id", "==", hubId));
      const petSnaps = await getDocs(q);
      const fetchedPets = petSnaps.docs.map(d => ({ id: d.id, ...d.data() } as HubPet));
      setPets(fetchedPets);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHubData();
  }, [hubId]);

  const handleUpdateHub = async () => {
    if (!hub) return;
    try {
      const urls = hubFormData.socialMediaUrls.split(",").map(s => s.trim()).filter(Boolean);
      await updateDoc(doc(db, "hubs", hubId), {
        name: hubFormData.name,
        description: hubFormData.description,
        address: hubFormData.address,
        photoUrl: hubFormData.photoUrl,
        socialMediaUrls: urls,
        hubType: hubFormData.hubType,
      });
      setEditHubMode(false);
      fetchHubData();
    } catch (err) {
      console.error("error updating hub", err);
    }
  };

  const handleAddPet = async () => {
    try {
      let photoUrl = petFormData.photoDataUrl;
      if (photoUrl && photoUrl.startsWith("data:image")) {
        const res = await fetch("/api/upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: photoUrl })
        });
        if (res.ok) {
          const data = await res.json();
          photoUrl = data.url;
        }
      }

      if (editingPetId) {
        await updateDoc(doc(db, "pets", editingPetId), {
          name: petFormData.name,
          age: petFormData.age,
          breed: petFormData.breed,
          status: petFormData.status,
          ...(photoUrl ? { photoDataUrl: photoUrl } : {})
        });
      } else {
        await addDoc(collection(db, "pets"), {
          hub_id: hubId,
          ownerId: userId,
          name: petFormData.name,
          age: petFormData.age,
          breed: petFormData.breed,
          status: petFormData.status,
          photoDataUrl: photoUrl
        });
      }
      setAddPetMode(false);
      setEditingPetId(null);
      setPetFormData({ name: "", age: "", breed: "", status: "Available for Adoption", photoDataUrl: "" });
      fetchHubData();
    } catch(err) {
      console.error(err);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>, isHub: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (isHub) setHubFormData(p => ({ ...p, photoUrl: ev.target?.result as string }));
        else setPetFormData(p => ({ ...p, photoDataUrl: ev.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) return <div className="p-4 bg-white rounded-3xl opacity-50">Loading Hub settings...</div>;
  if (!hub) return <div className="p-4 bg-white rounded-3xl text-slate-500">Hub not found or access denied.</div>;

  return (
    <div className="bg-white rounded-[2rem] shadow-sm p-6 space-y-6">
      <div className="flex items-center gap-3 border-b pb-4">
        {onClose && (
          <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h2 className="font-black text-xl text-slate-800 flex-1">Hub Manager</h2>
        <MapPin className="text-orange-500 shrink-0" />
      </div>

      {!editHubMode && !addPetMode && (
        <div className="space-y-6">
          <div className="bg-slate-50 rounded-2xl p-4 flex gap-4 border border-slate-100">
             {hub.photoUrl ? (
                <img src={hub.photoUrl} className="w-20 h-20 bg-slate-200 rounded-xl object-cover shrink-0" />
             ) : (
                <div className="w-20 h-20 bg-slate-200 rounded-xl flex items-center justify-center shrink-0">
                  <ImageIcon className="text-slate-400" />
                </div>
             )}
             <div className="flex-1">
                <h3 className="font-bold text-lg text-slate-800">{hub.name || "Unnamed Hub"}</h3>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{hub.description}</p>
                <button onClick={() => setEditHubMode(true)} className="mt-3 text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                  Hub Setting
                </button>
             </div>
          </div>

          <div>
             <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold text-slate-800">Hub Pets ({pets.length})</h3>
               <button onClick={() => setAddPetMode(true)} className="flex items-center gap-1 text-sm font-bold bg-slate-900 text-white px-3 py-1.5 rounded-xl hover:bg-slate-800">
                 <Plus className="w-4 h-4"/> Add Pet
               </button>
             </div>
             <div className="space-y-3">
               {pets.map(pet => (
                 <div key={pet.id} className="flex bg-slate-50 p-3 rounded-2xl items-center gap-4">
                    {pet.photoDataUrl ? (
                      <img src={pet.photoDataUrl} className="w-12 h-12 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center shrink-0 border border-slate-300">
                        🐾
                      </div>
                    )}
                    <div className="flex-1">
                       <h4 className="font-bold text-slate-800">{pet.name}</h4>
                       <p className="text-xs text-slate-500 font-medium">{pet.breed} • {pet.age} • <span className={pet.status === 'Resident Cat' ? 'text-indigo-600' : 'text-emerald-600'}>{pet.status}</span></p>
                    </div>
                    <button 
                       onClick={() => {
                         setEditingPetId(pet.id);
                         setPetFormData({
                           name: pet.name || "",
                           age: pet.age || "",
                           breed: pet.breed || "",
                           status: pet.status as "Available for Adoption" | "Resident Cat",
                           photoDataUrl: pet.photoDataUrl || ""
                         });
                         setAddPetMode(true);
                       }}
                       className="p-2 text-slate-400 hover:text-indigo-600"
                    >
                       <Settings className="w-5 h-5" />
                    </button>
                 </div>
               ))}
               {pets.length === 0 && <p className="text-sm text-slate-500 italic p-4 text-center bg-slate-50 rounded-2xl">No pets managed yet.</p>}
             </div>
          </div>
        </div>
      )}

      {editHubMode && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between mb-2">
             <h3 className="font-black text-slate-800">Hub Setting</h3>
             <button onClick={() => setEditHubMode(false)}><XCircle className="text-slate-400"/></button>
          </div>
          <div className="flex justify-center mb-4">
             <label className="w-24 h-24 bg-slate-100 rounded-full border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden">
                {hubFormData.photoUrl ? (
                   <img src={hubFormData.photoUrl} className="w-full h-full object-cover" />
                ) : (
                   <Camera className="text-slate-400" />
                )}
                <input type="file" accept="image/*" onChange={(e) => handlePhotoSelect(e, true)} className="hidden" />
             </label>
          </div>
          <input className="w-full p-3 bg-slate-50 rounded-xl" placeholder="Hub Name" value={hubFormData.name} onChange={e => setHubFormData(p => ({...p, name: e.target.value}))}/>
          <textarea className="w-full p-3 bg-slate-50 rounded-xl" placeholder="Description" rows={3} value={hubFormData.description} onChange={e => setHubFormData(p => ({...p, description: e.target.value}))}/>
          <input className="w-full p-3 bg-slate-50 rounded-xl" placeholder="Full Address" value={hubFormData.address} onChange={e => setHubFormData(p => ({...p, address: e.target.value}))}/>
          <select className="w-full p-3 bg-slate-50 rounded-xl" value={hubFormData.hubType} onChange={e => setHubFormData(p => ({...p, hubType: e.target.value}))}>
            <option value="hub">Community Hub</option>
            <option value="vet">Vet / Clinic</option>
            <option value="shelter">Shelter</option>
            <option value="cafe">Cat Cafe</option>
            <option value="petshop">Pet Shop</option>
          </select>
          <input className="w-full p-3 bg-slate-50 rounded-xl" placeholder="Social Links (comma separated)" value={hubFormData.socialMediaUrls} onChange={e => setHubFormData(p => ({...p, socialMediaUrls: e.target.value}))}/>
          
          <button onClick={handleUpdateHub} className="w-full bg-slate-900 text-white font-bold rounded-xl py-3 mt-4">Save Changes</button>
        </div>
      )}

      {addPetMode && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between mb-2">
             <h3 className="font-black text-slate-800">{editingPetId ? "Edit" : "Add"} Hub Pet</h3>
             <button onClick={() => { setAddPetMode(false); setEditingPetId(null); setPetFormData({ name: "", age: "", breed: "", status: "Available for Adoption", photoDataUrl: "" }); }}><XCircle className="text-slate-400"/></button>
          </div>
          <div className="flex justify-center mb-4">
             <label className="w-24 h-24 bg-slate-100 rounded-full border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden">
                {petFormData.photoDataUrl ? (
                   <img src={petFormData.photoDataUrl} className="w-full h-full object-cover" />
                ) : (
                   <Camera className="text-slate-400" />
                )}
                <input type="file" accept="image/*" onChange={(e) => handlePhotoSelect(e, false)} className="hidden" />
             </label>
          </div>
          <input className="w-full p-3 bg-slate-50 rounded-xl" placeholder="Pet Name" value={petFormData.name} onChange={e => setPetFormData(p => ({...p, name: e.target.value}))}/>
          
          <div className="flex gap-2">
             <input className="w-1/2 p-3 bg-slate-50 rounded-xl" placeholder="Age" value={petFormData.age} onChange={e => setPetFormData(p => ({...p, age: e.target.value}))}/>
             <input className="w-1/2 p-3 bg-slate-50 rounded-xl" placeholder="Breed" value={petFormData.breed} onChange={e => setPetFormData(p => ({...p, breed: e.target.value}))}/>
          </div>
          
          <select className="w-full p-3 bg-slate-50 rounded-xl" value={petFormData.status} onChange={e => setPetFormData(p => ({...p, status: e.target.value as any}))}>
            <option value="Available for Adoption">Available for Adoption</option>
            <option value="Resident Cat">Resident Cat</option>
          </select>
          
          <button onClick={handleAddPet} className="w-full bg-indigo-600 text-white font-bold rounded-xl py-3 mt-4 hover:bg-indigo-700">{editingPetId ? "Save Pet" : "Add Pet"}</button>
        </div>
      )}
    </div>
  );
}
