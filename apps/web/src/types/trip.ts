export interface TripStop {
  id: string;
  name: string;
  address: string;
  category: "Temple" | "Cafe" | "Restaurant" | "Shopping" | "Viewpoint";
  suggestedDurationMin: number;
  lat: number;
  lng: number;
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
}
