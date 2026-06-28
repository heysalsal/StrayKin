import React, { createContext, useContext, useState, useEffect } from "react";
import { db } from "../config/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

export interface MeasurementBadge {
  id: string;
  title: string;
  description: string;
  type: "strays" | "checkins";
  threshold: number;
}

interface Settings {
  autoApproveSubmissions: boolean;
  achievements: MeasurementBadge[];
}

interface SettingsContextProps {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  loading: boolean;
}

const defaultSettings: Settings = {
  autoApproveSubmissions: false,
  achievements: [
    { id: "pawtrainee", title: "Pawtrainee", description: "Registered", type: "checkins", threshold: 0 },
    { id: "pawrent", title: "Pawrent", description: "1 Stray", type: "strays", threshold: 1 },
    { id: "stray_savior", title: "Stray Savior", description: "5 Strays", type: "strays", threshold: 5 },
    { id: "cat_whisperer", title: "Cat Whisperer", description: "10 Strays", type: "strays", threshold: 10 },
    { id: "good_samaritan", title: "Samaritan", description: "1 Check-in", type: "checkins", threshold: 1 },
    { id: "reliable_feeder", title: "Feeder", description: "10 Check-ins", type: "checkins", threshold: 10 },
    { id: "neighborhood_guardian", title: "Guardian", description: "50 Check-ins", type: "checkins", threshold: 50 },
  ]
};

const SettingsContext = createContext<SettingsContextProps | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "global"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Partial<Settings>;
        setSettings(prev => ({ ...prev, ...data }));
      }
      setLoading(false);
    }, (error) => {
      console.warn("Unable to fetch settings, using defaults.", error.message);
      setLoading(false); // don't block the app forever on permission error
    });
    return () => unsub();
  }, []);

  const updateSettings = async (updates: Partial<Settings>) => {
    const ref = doc(db, "settings", "global");
    await setDoc(ref, updates, { merge: true });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within SettingsProvider");
  return context;
};
