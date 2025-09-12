"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Navigation, Heart, Share2 } from 'lucide-react';
import Image from 'next/image';

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

interface PlacePopupProps {
  place: Place;
  onViewDetails: (place: Place) => void;
  onGetDirections: (place: Place) => void;
  onClose: () => void;
  userLocation?: [number, number] | null;
}

export const PlacePopup: React.FC<PlacePopupProps> = ({
  place,
  onViewDetails,
  onGetDirections,
  onClose,
  userLocation,
}) => {
  const handleViewDetails = () => {
    onViewDetails(place);
  };

  const handleGetDirections = () => {
    onGetDirections(place);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: place.name,
          text: place.description,
          url: `${window.location.origin}/places/${place.slug}`,
        });
      } catch (error) {
        // Fallback to clipboard
        navigator.clipboard.writeText(`${window.location.origin}/places/${place.slug}`);
      }
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(`${window.location.origin}/places/${place.slug}`);
    }
  };

  return (
    <Card className="w-80 max-w-sm shadow-lg border-0 overflow-hidden">
      {/* Header Image */}
      <div className="relative h-32 bg-gradient-to-br from-blue-500 to-purple-600">
        {place.image_url && (
          <Image
            src={place.image_url}
            alt={place.name}
            fill
            className="object-cover"
            onError={(e) => {
              // Hide image on error, show gradient background
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-white font-bold text-lg leading-tight">
            {place.name}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-2 right-2 h-8 w-8 p-0 text-white hover:bg-white/20"
        >
          ×
        </Button>
      </div>

      <CardContent className="p-4">
        {/* Description */}
        <p className="text-gray-600 text-sm mb-3 line-clamp-3">
          {place.description.length > 120 
            ? `${place.description.substring(0, 120)}...` 
            : place.description
          }
        </p>

        {/* Price and Tags */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-green-600 font-bold text-lg">
              {place.price > 0 ? `₿${place.price}` : 'Free'}
            </span>
          </div>
          <div className="flex gap-1">
            {place.tags.slice(0, 2).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Address */}
        {place.address && (
          <div className="flex items-start gap-2 mb-4">
            <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="text-gray-600 text-sm leading-tight">
              {place.address}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleViewDetails}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            View Details
          </Button>
          
          <Button
            onClick={handleGetDirections}
            variant="outline"
            size="sm"
            className="px-3"
            title="Get Directions"
          >
            <Navigation className="h-4 w-4" />
          </Button>
          
          <Button
            onClick={handleShare}
            variant="outline"
            size="sm"
            className="px-3"
            title="Share"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};