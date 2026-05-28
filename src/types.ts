import { Timestamp } from 'firebase/firestore';

export interface CatRecord {
  id: string;
  geohash: string;
  lat: number;
  lng: number;
  animalType?: string; // e.g. 'Cat', 'Dog', 'Other'
  name?: string; // Currently used, we might deprecate this soon in favor of names array, but keep for backward compat
  names?: Array<{ name: string; votes: number; suggestedBy: string }>;
  genderVotes?: { male: number; female: number; unknown: number };
  sterilizedVotes?: number;
  imageUrl?: string;
  description?: string;
  managed_by_ngo_url?: string;
  color_tags?: string[];
  status?: 'under_review' | 'approved' | 'rejected';
  submissionId?: string;
  characteristics?: Array<{ tag: string; votes: number }>;
  gallery?: Array<{ id: string; url: string; timestamp: number; votes: number }>;
  last_check_in: {
    timestamp: Timestamp | { seconds: number, nanoseconds: number, toMillis?: () => number };
    was_fed: boolean;
    status_health?: string;
    geo_point?: [number, number];
    activities?: string[];
    notes?: string;
    color?: string;
    strayType?: string;
    isNeutered?: boolean;
  };
}
