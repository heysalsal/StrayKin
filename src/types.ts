import { Timestamp } from 'firebase/firestore';

export interface AchievementRule {
  id: string;
  name: string;
  description: string;
  metric: 'submissions' | 'check_ins' | 'votes' | 'gallery_adds';
  required_count: number;
  icon_name: string;
}

export interface Hub {
  id: string;
  name: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  hubType?: 'hub' | 'vet' | 'shelter' | 'cafe' | 'petshop';
  photoUrl?: string;
  socialMediaUrls?: string[];
  managerIds: string[];
  isActive?: boolean;
}

export interface HubPet {
  id: string;
  hub_id: string;
  name: string;
  age: string;
  breed: string;
  status: "Available for Adoption" | "Resident Cat";
  photoDataUrl?: string;
}

export interface CatRecord {
  id: string;
  geohash: string;
  lat: number;
  lng: number;
  animalType?: string; // e.g. 'Cat', 'Dog', 'Other'
  name?: string;
  names?: Array<{ name: string; votes: number; suggestedBy: string }>;
  genderVotes?: { male: number; female: number; unknown: number };
  sterilizedVotes?: number;
  imageUrl?: string;
  imageUrlVotes?: number;
  description?: string;
  managed_by_ngo_url?: string;
  color_tags?: string[];
  color?: string;
  strayType?: string;
  isNeutered?: boolean;
  status?: 'under_review' | 'approved' | 'rejected';
  submissionId?: string;
  submittedBy?: string; // Original submitter, the "primary caretaker"
  hub_id?: string;
  isResidentPet?: boolean;
  inviteCode?: string; // Claim code
  caretakers?: string[]; // Array of user UIDs who claimed this pet
  characteristics?: Array<{ tag: string; votes: number }>;
  gallery?: Array<{ id: string; url: string; timestamp: number; votes: number; submittedBy?: string }>;
  locationName?: string;
  createdAt?: string | number;
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
