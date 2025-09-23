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

export const mockTrips: Trip[] = [
  {
    id: "trip-1",
    name: "ตะลุยคาเฟ่ย่านเมืองเก่า",
    date: "26 กันยายน 2568",
    totalDurationMin: 240,
    totalDistanceKm: 7.5,
    estimatedBudget: 1500,
    notes: "ทริปชิลๆ สำหรับสายกาแฟและถ่ายรูป ลองชิมครัวซองต์ที่ร้านแรกอร่อยมาก",
    stops: [
      { id: "stop-1a", name: "โรงคั่วกาแฟ วรุณ", address: "ถนนแพร่งภูธร", category: "Cafe", suggestedDurationMin: 60, lat: 13.752, lng: 100.498 },
      { id: "stop-1b", name: "Patina Bangkok", address: "ซอยวานิช 2", category: "Cafe", suggestedDurationMin: 75, lat: 13.744, lng: 100.505 },
      { id: "stop-1c", name: "HĒIJīi Bangkok", address: "ซอยเจริญกรุง 43", category: "Cafe", suggestedDurationMin: 60, lat: 13.738, lng: 100.513 },
      { id: "stop-1d", name: "ผัดไทยประตูผี", address: "ถนนมหาไชย", category: "Restaurant", suggestedDurationMin: 45, lat: 13.753, lng: 100.505 },
    ],
  },
  {
    id: "trip-2",
    name: "ไหว้พระริมแม่น้ำเจ้าพระยา",
    date: "30 กันยายน 2568",
    totalDurationMin: 300,
    totalDistanceKm: 5.2,
    estimatedBudget: 800,
    notes: "เตรียมหมวกและแว่นกันแดดไปด้วย อากาศอาจจะร้อนช่วงบ่าย นั่งเรือข้ามฟากสนุกดี",
    stops: [
      { id: "stop-2a", name: "วัดอรุณราชวราราม", address: "ถนนวังเดิม", category: "Temple", suggestedDurationMin: 90, lat: 13.743, lng: 100.489 },
      { id: "stop-2b", name: "วัดพระเชตุพนวิมลมังคลาราม (วัดโพธิ์)", address: "ถนนสนามไชย", category: "Temple", suggestedDurationMin: 90, lat: 13.746, lng: 100.493 },
      { id: "stop-2c", name: "ท่ามหาราช", address: "ถนนมหาราช", category: "Shopping", suggestedDurationMin: 60, lat: 13.753, lng: 100.490 },
      { id: "stop-2d", name: "The Deck by Arun Residence", address: "ซอยประตูนกยูง", category: "Restaurant", suggestedDurationMin: 60, lat: 13.745, lng: 100.491 },
    ],
  },
];