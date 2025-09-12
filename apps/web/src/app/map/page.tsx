"use client";

import { useState, useEffect } from 'react';
// import dynamic from 'next/dynamic'; // Disabled to prevent Mapbox loading
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Filter, MapPin, Navigation, Layers } from 'lucide-react';
import { motion } from 'motion/react';

// MapContainer dynamically import disabled to prevent Mapbox usage
// const MapContainer = dynamic(() => import('@/components/map/map-container'), {
//   ssr: false,
//   loading: () => (
//     <div className="w-full h-full flex items-center justify-center bg-gray-100">
//       <div className="text-center">
//         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
//         <p className="text-gray-600">Loading map...</p>
//       </div>
//     </div>
//   ),
// });

// Interface definitions
interface Place {
  id: string;
  name: string;
  description: string;
  tags: string[];
  lat: number;
  lng: number;
  address: string;
  price: number;
  image_url: string;
  slug: string;
}

interface MapFilters {
  search: string;
  categories: string[];
  priceRange: [number, number];
  distance: number;
}

export default function MapPage() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [filters, setFilters] = useState<MapFilters>({
    search: '',
    categories: [],
    priceRange: [0, 1000],
    distance: 10,
  });
  
  const [showFilters, setShowFilters] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Fetch places data
  useEffect(() => {
    const fetchPlaces = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:3000/api/places?limit=30`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch places');
        }
        
        const result = await response.json();
        
        if (result.success) {
          const placesWithCoords = result.data.filter((place: Place) => 
            place.lat && place.lng && 
            typeof place.lat === 'number' && 
            typeof place.lng === 'number' &&
            !isNaN(place.lat) && !isNaN(place.lng)
          );
          
          setPlaces(placesWithCoords);
          setFilteredPlaces(placesWithCoords);
        } else {
          throw new Error(result.message || 'Failed to fetch places');
        }
      } catch (err) {
        console.error('Error fetching places:', err);
        setError(err instanceof Error ? err.message : 'Failed to load places');
      } finally {
        setLoading(false);
      }
    };

    fetchPlaces();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...places];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(place =>
        place.name.toLowerCase().includes(searchLower) ||
        place.description.toLowerCase().includes(searchLower) ||
        place.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Category filter
    if (filters.categories.length > 0) {
      filtered = filtered.filter(place =>
        filters.categories.some(category =>
          place.tags.some(tag => tag.toLowerCase().includes(category.toLowerCase()))
        )
      );
    }

    // Price filter
    filtered = filtered.filter(place =>
      place.price >= filters.priceRange[0] && place.price <= filters.priceRange[1]
    );

    setFilteredPlaces(filtered);
  }, [places, filters]);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.longitude, position.coords.latitude]);
        },
        (error) => {
          console.warn('Geolocation error:', error);
        }
      );
    }
  }, []);

  const handlePlaceSelect = (place: Place) => {
    setSelectedPlace(place);
  };

  const handlePlaceDeselect = () => {
    setSelectedPlace(null);
  };

  const handleSearchChange = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Loading Bangkok places...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md mx-auto">
          <CardContent className="text-center">
            <div className="text-red-500 mb-4">
              <MapPin className="w-16 h-16 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Failed to Load Map</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
      <div className="relative w-[800px] h-[600px] overflow-hidden rounded-lg shadow-lg bg-white">
        {/* Search and Filter Panel - Hidden since POIs are removed */}
        {false && (
          <motion.div 
            className="absolute top-2 left-2 right-2 z-10 flex flex-col sm:flex-row gap-2"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="flex-1 bg-white/90 backdrop-blur-sm shadow-lg">
              <CardContent className="p-2">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <Input
                    placeholder="Search places..."
                    value={filters.search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="border-none bg-transparent focus:ring-0 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className="shrink-0 h-7 w-7 p-0"
                  >
                    <Filter className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Filter Panel (expandable) - Hidden since POIs are removed */}
        {false && showFilters && (
          <motion.div 
            className="absolute top-12 left-2 right-2 z-10"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-white/95 backdrop-blur-sm shadow-lg">
              <CardContent className="p-2">
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Categories</label>
                    <div className="flex flex-wrap gap-1">
                      {['temple', 'market', 'restaurant', 'park', 'museum'].map((category) => (
                        <Button
                          key={category}
                          variant={filters.categories.includes(category) ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setFilters(prev => ({
                              ...prev,
                              categories: prev.categories.includes(category)
                                ? prev.categories.filter(c => c !== category)
                                : [...prev.categories, category]
                            }));
                          }}
                          className="text-xs h-6 px-2"
                        >
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Price Range</label>
                      <div className="flex items-center gap-1">
                        <span className="text-xs">₿{filters.priceRange[0]}</span>
                        <div className="flex-1">
                          <input
                            type="range"
                            min="0"
                            max="1000"
                            value={filters.priceRange[1]}
                            onChange={(e) => {
                              setFilters(prev => ({
                                ...prev,
                                priceRange: [prev.priceRange[0], parseInt(e.target.value)]
                              }));
                            }}
                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                        <span className="text-xs">₿{filters.priceRange[1]}</span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium mb-1 block">Distance</label>
                      <select
                        value={filters.distance}
                        onChange={(e) => setFilters(prev => ({ ...prev, distance: parseInt(e.target.value) }))}
                        className="w-full p-1 border rounded text-xs h-6"
                      >
                        <option value={1}>Within 1km</option>
                        <option value={5}>Within 5km</option>
                        <option value={10}>Within 10km</option>
                        <option value={50}>All Bangkok</option>
                      </select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Results Counter */}
        <motion.div 
          className="absolute bottom-2 left-2 z-10"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
            <CardContent className="p-2">
              <div className="flex items-center gap-1 text-xs">
                <MapPin className="w-3 h-3 text-orange-500" />
                <span className="font-medium text-orange-600">
                  Map Paused (Saving Costs)
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Map Container - Temporarily disabled to save Mapbox costs */}
        <div className="w-full h-full">
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <div className="text-center p-8">
              <div className="mb-4">
                <MapPin className="w-16 h-16 mx-auto text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                Map Temporarily Disabled
              </h3>
              <p className="text-gray-500 mb-4 max-w-sm">
                Mapbox map loading has been paused to control usage costs.
              </p>
              <div className="text-sm text-gray-400">
                <p>Map Size: 800x600 pixels</p>
                <p>Center: Bangkok, Thailand</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}