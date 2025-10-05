"use client";

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation } from 'lucide-react';

interface AdminMapPickerProps {
  lat?: number;
  lng?: number;
  onLocationSelect: (lat: number, lng: number) => void;
  className?: string;
}

export const AdminMapPicker: React.FC<AdminMapPickerProps> = ({
  lat,
  lng,
  onLocationSelect,
  className = '',
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(
    lat && lng ? { lat, lng } : null
  );

  // Initialize map
  useEffect(() => {
    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    
    if (!accessToken) {
      console.error('Mapbox access token is not configured');
      return;
    }

    if (map.current) return; // Initialize map only once

    mapboxgl.accessToken = accessToken;

    // Use provided coordinates or default to Bangkok center
    const initialCenter: [number, number] = lng && lat ? [lng, lat] : [100.5018, 13.7563];

    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: initialCenter,
      zoom: 13,
      maxBounds: [
        [100.1, 13.4], // Southwest coordinates (Bangkok bounds)
        [100.9, 14.1], // Northeast coordinates
      ],
      minZoom: 10,
      maxZoom: 18,
    });

    // Map event listeners
    map.current.on('load', () => {
      setMapLoaded(true);
      console.log('Admin map picker loaded');
    });

    // Click handler to place/move marker
    map.current.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      setCurrentCoords({ lat, lng });
      onLocationSelect(lat, lng);
      
      // Update or create marker
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      } else {
        createMarker(lng, lat);
      }
    });

    // Navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Create marker
  const createMarker = (lng: number, lat: number) => {
    if (!map.current) return;

    // Create custom marker element
    const markerElement = document.createElement('div');
    markerElement.className = 'admin-marker';
    markerElement.style.cssText = `
      width: 40px;
      height: 40px;
      background-color: #EF4444;
      border: 4px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      cursor: pointer;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    const iconWrapper = document.createElement('div');
    iconWrapper.style.cssText = `
      transform: rotate(45deg);
      color: white;
      font-size: 20px;
    `;
    iconWrapper.innerHTML = '📍';
    markerElement.appendChild(iconWrapper);

    markerRef.current = new mapboxgl.Marker({
      element: markerElement,
      anchor: 'bottom',
      draggable: true,
    })
      .setLngLat([lng, lat])
      .addTo(map.current!);

    // Handle marker drag
    markerRef.current.on('dragend', () => {
      const lngLat = markerRef.current!.getLngLat();
      setCurrentCoords({ lat: lngLat.lat, lng: lngLat.lng });
      onLocationSelect(lngLat.lat, lngLat.lng);
    });
  };

  // Update marker when lat/lng props change externally
  useEffect(() => {
    if (lat && lng && map.current && mapLoaded) {
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      } else {
        createMarker(lng, lat);
      }
      map.current.flyTo({
        center: [lng, lat],
        zoom: 15,
        duration: 1000,
      });
      setCurrentCoords({ lat, lng });
    }
  }, [lat, lng, mapLoaded]);

  // Get current location
  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentCoords({ lat: latitude, lng: longitude });
          onLocationSelect(latitude, longitude);
          
          if (map.current) {
            map.current.flyTo({
              center: [longitude, latitude],
              zoom: 15,
              duration: 1000,
            });
          }

          if (markerRef.current) {
            markerRef.current.setLngLat([longitude, latitude]);
          } else {
            createMarker(longitude, latitude);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Could not get your current location. Please ensure location permissions are enabled.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Map container */}
      <div 
        ref={mapContainer} 
        className="w-full h-full rounded-lg overflow-hidden border-2 border-gray-300"
        style={{ minHeight: '400px' }}
      />
      
      {/* Instructions overlay */}
      <Card className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm shadow-lg p-3 max-w-xs">
        <div className="flex items-start gap-2">
          <MapPin className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-gray-900 mb-1">Click to place marker</p>
            <p className="text-gray-600">Click anywhere on the map to set the POI location. You can drag the marker to adjust.</p>
          </div>
        </div>
      </Card>

      {/* Current location button */}
      <Button
        onClick={handleGetCurrentLocation}
        className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
        size="sm"
      >
        <Navigation className="h-4 w-4 mr-2" />
        Use My Location
      </Button>

      {/* Coordinates display */}
      {currentCoords && (
        <Card className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm shadow-lg p-3">
          <div className="text-sm">
            <p className="font-semibold text-gray-900 mb-1">Selected Location:</p>
            <p className="text-gray-600">
              Lat: {currentCoords.lat.toFixed(6)}, Lng: {currentCoords.lng.toFixed(6)}
            </p>
          </div>
        </Card>
      )}
      
      {/* Loading overlay */}
      {!mapLoaded && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
};