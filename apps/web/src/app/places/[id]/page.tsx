"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { nameToSlug } from '@/lib/slug-utils';
import { 
  MapPin, 
  ArrowLeft, 
  Clock, 
  Star, 
  Share2,
  Heart,
  Navigation,
  Camera,
  Users
} from 'lucide-react';

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

interface NearbyPlace {
  id: string;
  name: string;
  image_url: string;
  tags: string[];
  slug: string;
}

export default function PlaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [place, setPlace] = useState<Place | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);

  const placeSlug = params.id as string; // This is actually a slug now

  useEffect(() => {
    if (placeSlug) {
      fetchPlaceDetails();
      fetchNearbyPlaces();
    }
  }, [placeSlug]);

  const fetchPlaceDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`http://localhost:3000/api/places/${placeSlug}`);
      
      // Check if response is ok
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Get response text first to debug JSON issues
      const responseText = await response.text();
      
      // Try to parse JSON
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Response Text:', responseText);
        throw new Error('Invalid JSON response from server');
      }

      if (result.success && result.data) {
        // Ensure data has safe defaults
        const safeData = {
          ...result.data,
          image_url: result.data.image_url || '',
          tags: Array.isArray(result.data.tags) ? result.data.tags : [],
          description: result.data.description || 'No description available',
          address: result.data.address || 'Address not available',
          price: typeof result.data.price === 'number' ? result.data.price : 0
        };
        setPlace(safeData);
      } else {
        throw new Error(result.message || 'Place not found');
      }
    } catch (err) {
      console.error('Error fetching place details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load place details');
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyPlaces = async () => {
    try {
      const response = await fetch(`http://localhost:3000/api/places/${placeSlug}/nearby?limit=4`);
      
      if (!response.ok) {
        console.error('Failed to fetch nearby places');
        return;
      }
      
      // Get response text first to debug JSON issues
      const responseText = await response.text();
      
      // Try to parse JSON
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON Parse Error for nearby places:', parseError);
        console.error('Response Text:', responseText);
        return;
      }

      if (result.success && Array.isArray(result.data)) {
        // Ensure each place has safe defaults
        const safeData = result.data.map((place: any) => ({
          ...place,
          image_url: place.image_url || '',
          tags: Array.isArray(place.tags) ? place.tags : [],
          name: place.name || 'Unknown Place',
          slug: place.slug || nameToSlug(place.name || 'unknown-place')
        }));
        setNearbyPlaces(safeData);
      }
    } catch (err) {
      console.error('Error fetching nearby places:', err);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share && place) {
        await navigator.share({
          title: place.name,
          text: place.description,
          url: window.location.href,
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const openInMaps = () => {
    if (place) {
      const url = `https://www.google.com/maps?q=${place.lat},${place.lng}`;
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-700 mx-auto mb-4"></div>
          <p className="text-xl text-black">Loading place details...</p>
        </div>
      </div>
    );
  }

  if (error || !place) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-red-600 mb-4">{error || 'Place not found'}</p>
          <Button 
            onClick={() => router.back()} 
            className="bg-blue-700 hover:bg-blue-800"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}

      {/* Hero Image */}
      <div className="relative h-96 bg-gradient-to-br from-gray-300 to-gray-500">
        {/* Always show placeholder/blank image for now */}
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
          <div className="text-center text-gray-400">
            <Camera className="w-16 h-16 mx-auto mb-2" />
            <p className="text-sm">Image placeholder</p>
          </div>
        </div>
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute bottom-6 left-6 text-white">
          <h1 className="text-4xl font-bold mb-2">{place.name}</h1>
          {place.tags && place.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {place.tags.map((tag, index) => (
                <span key={index} className="text-sm bg-white/20 px-3 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <Card className="bg-white">
              <CardContent className="p-6 bg-white">
                <h2 className="text-2xl font-semibold mb-4 text-black">About This Place</h2>
                <p className="text-black leading-relaxed text-lg">
                  {place.description}
                </p>
              </CardContent>
            </Card>

            {/* Location */}
            <Card className="bg-white">
              <CardContent className="p-6 bg-white">
                <h2 className="text-2xl font-semibold mb-4 text-black">Location</h2>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-blue-700 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-black">{place.address}</p>
                      <p className="text-sm text-black mt-1">
                        Coordinates: {place.lat.toFixed(6)}, {place.lng.toFixed(6)}
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={openInMaps}
                    className="bg-blue-700 hover:bg-blue-800 w-full sm:w-auto text-white"
                  >
                    <Navigation className="w-4 h-4 mr-2 text-white" />
                    Open in Maps
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Nearby Places */}
            {nearbyPlaces.length > 0 && (
              <Card className="bg-white">
                <CardContent className="p-6 bg-white">
                  <h2 className="text-2xl font-semibold mb-4 text-black">Nearby Places</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {nearbyPlaces.map((nearbyPlace) => (
                      <div 
                        key={nearbyPlace.id}
                        className="group cursor-pointer bg-white rounded-lg border hover:shadow-md transition-shadow duration-200"
                        onClick={() => router.push(`/places/${nearbyPlace.slug}`)}
                      >
                        {/* Always show placeholder for nearby places too */}
                        <div className="relative h-32 bg-gradient-to-br from-gray-200 to-gray-300 rounded-t-lg overflow-hidden flex items-center justify-center">
                          <Camera className="w-8 h-8 text-gray-400" />
                        </div>
                        <div className="p-3">
                          <h3 className="font-semibold text-black group-hover:text-blue-700 transition-colors">
                            {nearbyPlace.name}
                          </h3>
                          {nearbyPlace.tags && nearbyPlace.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {nearbyPlace.tags.slice(0, 2).map((tag, index) => (
                                <span key={index} className="text-xs bg-gray-100 text-black px-2 py-1 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Info */}
            <Card className="bg-white">
              <CardContent className="p-6 bg-white">
                <h2 className="text-xl font-semibold mb-4 text-black">Quick Info</h2>
                <div className="space-y-3">
                  {place.price > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-700 text-sm font-semibold">฿</span>
                      </div>
                      <div>
                        <p className="font-medium text-black">Price</p>
                        <p className="text-sm text-black">฿{place.price}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Clock className="w-4 h-4 text-green-700" />
                    </div>
                    <div>
                      <p className="font-medium text-black">Best Time</p>
                      <p className="text-sm text-black">9 AM - 6 PM</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-orange-700" />
                    </div>
                    <div>
                      <p className="font-medium text-black">Suitable For</p>
                      <p className="text-sm text-black">All ages</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card className="bg-white">
              <CardContent className="p-6 bg-white">
                <h2 className="text-xl font-semibold mb-4 text-black">Plan Your Visit</h2>
                <div className="space-y-3">
                  <Button className="w-full bg-blue-700 hover:bg-blue-800 text-white">
                    Add to Trip Plan
                  </Button>
                  <Button variant="outline" className="w-full border-gray-300 text-black hover:bg-gray-50">
                    Ask Chatbot
                  </Button>
                  <Button variant="outline" className="w-full border-gray-300 text-black hover:bg-gray-50">
                    Save for Later
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}