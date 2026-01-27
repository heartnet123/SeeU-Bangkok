"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { nameToSlug } from '@/lib/slug-utils';
import { useAuth } from '@/contexts/auth-context';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { 
  MapPin, 
  ArrowLeft, 
  Clock, 
  Star, 
  Share2,
  Heart,
  Navigation,
  Camera,
  Users,
  Plus,
  ExternalLink,
  Phone,
  Globe,
  ChevronRight,
  MessageSquare,
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
  price?: number;
}

export default function PlaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useAuth();
  const [place, setPlace] = useState<Place | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [imageError, setImageError] = useState(false);

  const placeSlug = params.id as string;

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
      
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000';
      const response = await fetch(`${serverUrl}/api/places/${placeSlug}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();

      if (result.success && result.data) {
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
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000';
      const response = await fetch(`${serverUrl}/api/places/${placeSlug}/nearby?limit=4`);
      
      if (!response.ok) {
        return;
      }
      
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
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
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
      }
    } catch (err) {
      // User cancelled
    }
  };

  const handleFavorite = () => {
    setIsFavorite(!isFavorite);
    if (!isFavorite) {
      toast.success('Added to favorites');
    } else {
      toast.info('Removed from favorites');
    }
  };

  const openInMaps = () => {
    if (place) {
      const url = `https://www.google.com/maps?q=${place.lat},${place.lng}`;
      window.open(url, '_blank');
    }
  };

  const handleAddToTrip = () => {
    if (place) {
      // Navigate to map page with place pre-selected
      router.push(`/map?place=${place.slug}`);
    }
  };

  const handleAskAssistant = () => {
    if (place) {
      router.push(`/map?chat=true&about=${place.name}`);
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Hero skeleton */}
        <div className="relative h-[50vh] bg-gray-200 animate-pulse">
          <div className="absolute bottom-8 left-8 right-8">
            <Skeleton className="h-10 w-2/3 mb-4" />
            <Skeleton className="h-6 w-1/3" />
          </div>
        </div>
        
        {/* Content skeleton */}
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-8 w-1/3 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            </div>
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-1/2 mb-4" />
                  <Skeleton className="h-10 w-full mb-3" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !place) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div 
          className="text-center p-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
            <MapPin className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Place Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'This place could not be found.'}</p>
          <Button 
            onClick={() => router.back()} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <motion.div 
        className="relative h-[50vh] min-h-[400px] bg-gradient-to-br from-blue-600 to-purple-700"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Background Image */}
        {place.image_url && !imageError ? (
          <img
            src={place.image_url}
            alt={place.name}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Camera className="w-24 h-24 text-white/30" />
          </div>
        )}
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

        {/* Back button */}
        <motion.div 
          className="absolute top-6 left-6"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Button 
            onClick={() => router.back()}
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-black/30 text-white hover:bg-black/50 hover:text-white backdrop-blur-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </motion.div>

        {/* Action buttons */}
        <motion.div 
          className="absolute top-6 right-6 flex gap-2"
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Button 
            onClick={handleFavorite}
            variant="ghost"
            size="icon"
            className={`h-10 w-10 rounded-full backdrop-blur-sm ${
              isFavorite 
                ? 'bg-red-500 text-white hover:bg-red-600 hover:text-white' 
                : 'bg-black/30 text-white hover:bg-black/50 hover:text-white'
            }`}
          >
            <Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
          </Button>
          <Button 
            onClick={handleShare}
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-black/30 text-white hover:bg-black/50 hover:text-white backdrop-blur-sm"
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </motion.div>

        {/* Content overlay */}
        <motion.div 
          className="absolute bottom-0 left-0 right-0 p-8"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="max-w-6xl mx-auto">
            {/* Tags */}
            {place.tags && place.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {place.tags.map((tag, index) => (
                  <Badge
                    key={index}
                    className="bg-white/20 text-white backdrop-blur-sm border-0 hover:bg-white/30"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 drop-shadow-lg">
              {place.name}
            </h1>

            {/* Quick stats */}
            <div className="flex flex-wrap items-center gap-4 text-white/90">
              <div className="flex items-center gap-1.5">
                <Star className="h-5 w-5 text-yellow-400 fill-current" />
                <span className="font-semibold">4.5</span>
                <span className="text-white/70">(128 reviews)</span>
              </div>
              <span className="text-white/50">•</span>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-5 w-5" />
                <span>{place.address}</span>
              </div>
              {place.price > 0 && (
                <>
                  <span className="text-white/50">•</span>
                  <span className="text-green-400 font-semibold">฿{place.price}</span>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Content Section */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* About */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="overflow-hidden">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">About</h2>
                  <p className="text-gray-700 leading-relaxed text-lg">
                    {place.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Location */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="overflow-hidden">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Location</h2>
                  
                  {/* Map Preview */}
                  <div className="relative h-48 rounded-xl overflow-hidden mb-4 bg-gray-100">
                    <img
                      src={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+3b82f6(${place.lng},${place.lat})/${place.lng},${place.lat},15,0/600x300@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`}
                      alt="Map preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/5 hover:bg-black/10 transition-colors cursor-pointer" onClick={openInMaps}>
                      <Button className="bg-white/90 text-gray-900 hover:bg-white shadow-lg">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open in Maps
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-gray-900 font-medium">{place.address}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {place.lat.toFixed(6)}, {place.lng.toFixed(6)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Opening Hours (placeholder) */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Card className="overflow-hidden">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Opening Hours</h2>
                  <div className="space-y-3">
                    {[
                      { day: 'Monday - Friday', hours: '9:00 AM - 6:00 PM' },
                      { day: 'Saturday', hours: '10:00 AM - 8:00 PM' },
                      { day: 'Sunday', hours: '10:00 AM - 5:00 PM' },
                    ].map((item, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <span className="text-gray-700">{item.day}</span>
                        <span className="text-gray-900 font-medium">{item.hours}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Nearby Places */}
            {nearbyPlaces.length > 0 && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                <Card className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-2xl font-bold text-gray-900">Nearby Places</h2>
                      <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                        View All
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {nearbyPlaces.map((nearby, index) => (
                        <motion.div
                          key={nearby.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1 * index }}
                          whileHover={{ scale: 1.02 }}
                          className="cursor-pointer"
                          onClick={() => router.push(`/places/${nearby.slug}`)}
                        >
                          <div className="group bg-white rounded-xl border hover:shadow-lg transition-all duration-200 overflow-hidden">
                            <div className="relative h-32 bg-gradient-to-br from-blue-100 to-purple-100">
                              {nearby.image_url ? (
                                <img
                                  src={nearby.image_url}
                                  alt={nearby.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Camera className="w-8 h-8 text-gray-400" />
                                </div>
                              )}
                            </div>
                            <div className="p-4">
                              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                {nearby.name}
                              </h3>
                              {nearby.tags && nearby.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {nearby.tags.slice(0, 2).map((tag, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="sticky top-4"
            >
              <Card className="overflow-hidden">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Plan Your Visit</h2>
                  <div className="space-y-3">
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium h-12"
                      onClick={handleAddToTrip}
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Add to Trip
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full h-12"
                      onClick={openInMaps}
                    >
                      <Navigation className="w-5 h-5 mr-2" />
                      Get Directions
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full h-12"
                      onClick={handleAskAssistant}
                    >
                      <MessageSquare className="w-5 h-5 mr-2" />
                      Ask Trip Assistant
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Info */}
              <Card className="overflow-hidden mt-6">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Info</h2>
                  <div className="space-y-4">
                    {place.price > 0 && (
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                          <span className="text-green-700 font-bold">฿</span>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Entry Fee</p>
                          <p className="font-semibold text-gray-900">฿{place.price}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-blue-700" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Suggested Time</p>
                        <p className="font-semibold text-gray-900">1-2 hours</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <Users className="w-5 h-5 text-purple-700" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Best For</p>
                        <p className="font-semibold text-gray-900">All ages</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                        <Star className="w-5 h-5 text-yellow-700 fill-current" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Rating</p>
                        <p className="font-semibold text-gray-900">4.5 / 5</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Info (placeholder) */}
              <Card className="overflow-hidden mt-6">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Contact</h2>
                  <div className="space-y-3">
                    <a 
                      href="tel:+66-2-xxx-xxxx" 
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Phone className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-700">+66-2-xxx-xxxx</span>
                    </a>
                    <a 
                      href="#" 
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Globe className="w-5 h-5 text-gray-400" />
                      <span className="text-blue-600">Visit Website</span>
                    </a>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
