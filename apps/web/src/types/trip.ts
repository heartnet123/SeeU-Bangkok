export interface TripStop {
  id: string;
  placeId?: string;
  name: string;
  address: string;
  category: "Temple" | "Cafe" | "Restaurant" | "Shopping" | "Viewpoint";
  suggestedDurationMin: number;
  lat: number;
  lng: number;
  notes?: string;
  distanceFromPrevKm?: number;
  image_url?: string;
}

export interface Trip {
  id: string;
  name: string;
  date: string;
  totalDurationMin: number;
  totalDistanceKm: number;
  estimatedBudget: number;
  notes: string;
  stops: TripStop[];
  source?: "saved" | "draft";
  warnings?: string[];
}
