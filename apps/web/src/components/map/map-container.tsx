"use client";

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PlacePopup } from './place-popup';
import { MapControls } from './map-controls';

// Import CSS for Mapbox GL JS
import 'mapbox-gl/dist/mapbox-gl.css';

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

interface MapContainerProps {
  places: Place[];
  selectedPlace?: Place | null;
  onPlaceSelect: (place: Place) => void;
  onPlaceDeselect: () => void;
  userLocation?: [number, number] | null;
  initialCenter?: [number, number];
  initialZoom?: number;
}

const MapContainer: React.FC<MapContainerProps> = ({
  places,
  selectedPlace,
  onPlaceSelect,
  onPlaceDeselect,
  userLocation,
  initialCenter = [100.5018, 13.7563], // Bangkok center
  initialZoom = 11,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const clusterMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  const [clusteredPlaces, setClusteredPlaces] = useState<any[]>([]);
  const [currentZoom, setCurrentZoom] = useState(initialZoom);

  // Initialize map
  useEffect(() => {
    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    
    if (!accessToken) {
      console.error('Mapbox access token is not configured');
      return;
    }

    if (map.current) return; // Initialize map only once

    mapboxgl.accessToken = accessToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: initialCenter,
      zoom: initialZoom,
      pitch: 0,
      bearing: 0,
      maxBounds: [
        [100.1, 13.4], // Southwest coordinates (Bangkok bounds)
        [100.9, 14.1], // Northeast coordinates
      ],
      minZoom: 8,
      maxZoom: 18,
    });

    // Map event listeners
    map.current.on('load', () => {
      setMapLoaded(true);
      console.log('Map loaded successfully');
    });

    map.current.on('zoom', () => {
      if (map.current) {
        setCurrentZoom(map.current.getZoom());
      }
    });

    map.current.on('click', () => {
      // Close popup when clicking on empty areas
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      onPlaceDeselect();
    });

    map.current.on('error', (e) => {
      console.error('Map error:', e);
    });

    // Navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Geolocate control
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: true,
      showUserHeading: true,
    });
    
    map.current.addControl(geolocateControl, 'top-right');

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [initialCenter, initialZoom, onPlaceDeselect]);

  // Update map style
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const styleUrl = mapStyle === 'satellite' 
      ? 'mapbox://styles/mapbox/satellite-streets-v12'
      : 'mapbox://styles/mapbox/streets-v12';
    
    map.current.setStyle(styleUrl);
  }, [mapStyle, mapLoaded]);

  // Clustering algorithm
  const clusterPlaces = (places: Place[], zoom: number) => {
    const clusterRadius = Math.max(50, 100 - zoom * 5); // Dynamic radius based on zoom
    const clusters: any[] = [];
    const processed = new Set<string>();

    places.forEach((place) => {
      if (processed.has(place.id)) return;

      const cluster = {
        id: `cluster-${place.id}`,
        lat: place.lat,
        lng: place.lng,
        places: [place],
        isCluster: false,
      };

      // Find nearby places to cluster
      places.forEach((otherPlace) => {
        if (place.id === otherPlace.id || processed.has(otherPlace.id)) return;

        const distance = getDistance(
          { lat: place.lat, lng: place.lng },
          { lat: otherPlace.lat, lng: otherPlace.lng }
        );

        // Convert distance to pixels approximately
        const pixelDistance = distance * (156543.03 * Math.cos(place.lat * Math.PI / 180)) / Math.pow(2, zoom);
        
        if (pixelDistance < clusterRadius) {
          cluster.places.push(otherPlace);
          processed.add(otherPlace.id);
        }
      });

      // Mark as cluster if it has multiple places
      if (cluster.places.length > 1) {
        cluster.isCluster = true;
        // Calculate center of cluster
        const centerLat = cluster.places.reduce((sum, p) => sum + p.lat, 0) / cluster.places.length;
        const centerLng = cluster.places.reduce((sum, p) => sum + p.lng, 0) / cluster.places.length;
        cluster.lat = centerLat;
        cluster.lng = centerLng;
      }

      clusters.push(cluster);
      processed.add(place.id);
    });

    return clusters;
  };

  // Calculate distance between two coordinates
  const getDistance = (coord1: {lat: number, lng: number}, coord2: {lat: number, lng: number}) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Add/update place markers with clustering
  useEffect(() => {
    if (!map.current || !mapLoaded || !places.length) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    clusterMarkersRef.current.forEach(marker => marker.remove());
    clusterMarkersRef.current = [];

    // Apply clustering based on zoom level
    const shouldCluster = currentZoom < 14;
    const clusters = shouldCluster ? clusterPlaces(places, currentZoom) : 
      places.map(place => ({ id: place.id, lat: place.lat, lng: place.lng, places: [place], isCluster: false }));

    setClusteredPlaces(clusters);

    // Add markers for clusters/individual places
    clusters.forEach((cluster) => {
      if (!cluster.lat || !cluster.lng || isNaN(cluster.lat) || isNaN(cluster.lng)) {
        console.warn(`Invalid coordinates for cluster:`, cluster);
        return;
      }

      // Create marker element
      const markerElement = document.createElement('div');
      markerElement.className = cluster.isCluster ? 'cluster-marker' : 'place-marker';
      
      if (cluster.isCluster) {
        // Cluster marker styling
        const count = cluster.places.length;
        const size = Math.min(60, Math.max(32, 24 + count * 2));
        const color = getClusterColor(count);
        
        markerElement.style.cssText = `
          width: ${size}px;
          height: ${size}px;
          background-color: ${color};
          border: 3px solid white;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${Math.max(12, Math.min(18, 10 + count))}px;
          color: white;
          font-weight: bold;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          transition: all 0.2s ease;
          position: relative;
        `;
        
        markerElement.innerHTML = `${count}`;
        
        // Cluster hover effects
        markerElement.addEventListener('mouseenter', () => {
          markerElement.style.transform = 'scale(1.1)';
          markerElement.style.zIndex = '1000';
        });

        markerElement.addEventListener('mouseleave', () => {
          markerElement.style.transform = 'scale(1)';
          markerElement.style.zIndex = '1';
        });
        
        // Cluster click handler - zoom in to expand
        markerElement.addEventListener('click', (e) => {
          e.stopPropagation();
          if (map.current) {
            map.current.flyTo({
              center: [cluster.lng, cluster.lat],
              zoom: Math.min(18, currentZoom + 3),
              duration: 800,
            });
          }
        });
        
        clusterMarkersRef.current.push(
          new mapboxgl.Marker({ element: markerElement, anchor: 'center' })
            .setLngLat([cluster.lng, cluster.lat])
            .addTo(map.current!)
        );
      } else {
        // Individual place marker
        const place = cluster.places[0];
        markerElement.style.cssText = `
          width: 32px;
          height: 32px;
          background-color: ${getMarkerColor(place)};
          border: 3px solid white;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          color: white;
          font-weight: bold;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          transition: all 0.2s ease;
        `;
        
        // Add icon or first letter of name
        const icon = getPlaceIcon(place);
        markerElement.innerHTML = icon;

        // Hover effects
        markerElement.addEventListener('mouseenter', () => {
          markerElement.style.transform = 'scale(1.2)';
          markerElement.style.zIndex = '1000';
        });

        markerElement.addEventListener('mouseleave', () => {
          markerElement.style.transform = 'scale(1)';
          markerElement.style.zIndex = '1';
        });

        // Click handler
        markerElement.addEventListener('click', (e) => {
          e.stopPropagation();
          handleMarkerClick(place);
        });

        markersRef.current.push(
          new mapboxgl.Marker({ element: markerElement, anchor: 'center' })
            .setLngLat([place.lng, place.lat])
            .addTo(map.current!)
        );
      }
    });
  }, [places, mapLoaded, currentZoom]);

  // Add user location marker
  useEffect(() => {
    if (!map.current || !mapLoaded || !userLocation) return;

    // Remove existing user marker
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }

    // Create user location marker
    const userMarkerElement = document.createElement('div');
    userMarkerElement.className = 'user-location-marker';
    userMarkerElement.style.cssText = `
      width: 20px;
      height: 20px;
      background-color: #3B82F6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
    `;

    userMarkerRef.current = new mapboxgl.Marker({
      element: userMarkerElement,
      anchor: 'center',
    })
      .setLngLat(userLocation)
      .addTo(map.current!);
  }, [userLocation, mapLoaded]);

  // Handle selected place
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (selectedPlace) {
      // Fly to selected place
      map.current.flyTo({
        center: [selectedPlace.lng, selectedPlace.lat],
        zoom: 15,
        duration: 1000,
      });

      // Show popup for selected place
      showPlacePopup(selectedPlace);
    }
  }, [selectedPlace, mapLoaded]);

  const getClusterColor = (count: number): string => {
    if (count < 5) return '#3B82F6'; // Blue
    if (count < 10) return '#8B5CF6'; // Purple
    if (count < 25) return '#EF4444'; // Red
    return '#DC2626'; // Dark red
  };

  const getMarkerColor = (place: Place): string => {
    // Color based on place category/tags
    const tags = place.tags.map(tag => tag.toLowerCase());
    
    if (tags.some(tag => tag.includes('temple'))) return '#F59E0B'; // Orange
    if (tags.some(tag => tag.includes('market'))) return '#EF4444'; // Red
    if (tags.some(tag => tag.includes('restaurant'))) return '#10B981'; // Green
    if (tags.some(tag => tag.includes('park'))) return '#059669'; // Emerald
    if (tags.some(tag => tag.includes('museum'))) return '#8B5CF6'; // Violet
    if (tags.some(tag => tag.includes('shopping'))) return '#EC4899'; // Pink
    
    return '#3B82F6'; // Default blue
  };

  const getPlaceIcon = (place: Place): string => {
    const tags = place.tags.map(tag => tag.toLowerCase());
    
    if (tags.some(tag => tag.includes('temple'))) return '🏛️';
    if (tags.some(tag => tag.includes('market'))) return '🛍️';
    if (tags.some(tag => tag.includes('restaurant'))) return '🍽️';
    if (tags.some(tag => tag.includes('park'))) return '🌳';
    if (tags.some(tag => tag.includes('museum'))) return '🏛️';
    if (tags.some(tag => tag.includes('shopping'))) return '🛒';
    
    return '📍'; // Default pin
  };

  const handleMarkerClick = (place: Place) => {
    onPlaceSelect(place);
    showPlacePopup(place);
  };

  const showPlacePopup = (place: Place) => {
    if (!map.current) return;

    // Remove existing popup
    if (popupRef.current) {
      popupRef.current.remove();
    }

    // Create popup content
    const popupContent = document.createElement('div');
    popupContent.innerHTML = `
      <div class="place-popup" style="min-width: 250px; max-width: 300px;">
        <div class="popup-header" style="position: relative; height: 120px; background: linear-gradient(45deg, #3B82F6, #8B5CF6); border-radius: 8px 8px 0 0; overflow: hidden;">
          ${place.image_url ? `
            <img src="${place.image_url}" alt="${place.name}" 
                 style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0;" 
                 onerror="this.style.display='none'">
          ` : ''}
          <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.7)); padding: 16px;">
            <h3 style="color: white; font-size: 16px; font-weight: bold; margin: 0;">${place.name}</h3>
          </div>
        </div>
        <div class="popup-content" style="padding: 16px;">
          <p style="color: #6B7280; font-size: 14px; margin: 0 0 12px 0; line-height: 1.4;">
            ${place.description.length > 100 ? place.description.substring(0, 100) + '...' : place.description}
          </p>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="color: #059669; font-weight: bold; font-size: 16px;">
              ${place.price > 0 ? `₿${place.price}` : 'Free'}
            </span>
            <div style="display: flex; gap: 4px;">
              ${place.tags.slice(0, 2).map(tag => 
                `<span style="background: #E5E7EB; color: #374151; padding: 2px 8px; border-radius: 12px; font-size: 12px;">${tag}</span>`
              ).join('')}
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="view-details-${place.id}" 
                    style="flex: 1; background: #3B82F6; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer;">
              View Details
            </button>
            <button id="get-directions-${place.id}" 
                    style="background: #F3F4F6; color: #374151; border: none; padding: 8px 12px; border-radius: 6px; font-size: 14px; cursor: pointer;">
              Directions
            </button>
          </div>
        </div>
      </div>
    `;

    // Create popup
    popupRef.current = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      anchor: 'bottom',
      offset: [0, -10],
    })
      .setLngLat([place.lng, place.lat])
      .setDOMContent(popupContent)
      .addTo(map.current);

    // Add event listeners to popup buttons
    setTimeout(() => {
      const viewDetailsBtn = document.getElementById(`view-details-${place.id}`);
      const directionsBtn = document.getElementById(`get-directions-${place.id}`);

      if (viewDetailsBtn) {
        viewDetailsBtn.addEventListener('click', () => {
          window.location.href = `/places/${place.slug}`;
        });
      }

      if (directionsBtn) {
        directionsBtn.addEventListener('click', () => {
          if (userLocation) {
            const url = `https://www.google.com/maps/dir/${userLocation[1]},${userLocation[0]}/${place.lat},${place.lng}`;
            window.open(url, '_blank');
          } else {
            const url = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
            window.open(url, '_blank');
          }
        });
      }
    }, 100);

    // Handle popup close
    popupRef.current.on('close', () => {
      onPlaceDeselect();
      popupRef.current = null;
    });
  };

  const handleStyleChange = (style: 'streets' | 'satellite') => {
    setMapStyle(style);
  };

  const handleZoomIn = () => {
    if (map.current) {
      map.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (map.current) {
      map.current.zoomOut();
    }
  };

  const handleFlyToUserLocation = () => {
    if (map.current && userLocation) {
      map.current.flyTo({
        center: userLocation,
        zoom: 15,
        duration: 1000,
      });
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Map container */}
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Map controls */}
      <MapControls
        onStyleChange={handleStyleChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFlyToUserLocation={handleFlyToUserLocation}
        currentStyle={mapStyle}
        hasUserLocation={!!userLocation}
      />
      
      {/* Loading overlay */}
      {!mapLoaded && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Initializing map...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapContainer;