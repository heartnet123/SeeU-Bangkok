"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Supercluster from 'supercluster';
import { MapControls } from './map-controls';
import { PlacePopupContent } from './place-popup-content';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { motion, AnimatePresence } from 'motion/react';

// Types
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

interface ItineraryStop {
  lat: number;
  lng: number;
  slug: string;
  name: string;
}

interface MapContainerProps {
  places: Place[];
  selectedPlace?: Place | null;
  onPlaceSelect: (place: Place) => void;
  onPlaceDeselect: () => void;
  onVisiblePlacesChange?: (places: Place[]) => void;
  userLocation?: [number, number] | null;
  initialCenter?: [number, number];
  initialZoom?: number;
  previewItinerary?: any | null;
  show3D?: boolean;
  tripRoute?: [number, number][]; // Array of [lng, lat] coordinates for the route
  onRouteInfo?: (info: { distanceKm: number; durationMin: number; routeGeoJSON?: GeoJSON.FeatureCollection }) => void;
}

// Feature type for Supercluster
type PointFeature = {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: Place & { cluster?: boolean };
};

type ClusterFeature = {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    cluster: true;
    cluster_id: number;
    point_count: number;
    point_count_abbreviated: string | number;
  };
};

type SuperclusterFeature = PointFeature | ClusterFeature;

// Category colors for markers
const CATEGORY_COLORS: Record<string, string> = {
  temple: '#F59E0B',
  market: '#EF4444',
  restaurant: '#10B981',
  park: '#059669',
  museum: '#8B5CF6',
  shopping: '#EC4899',
  default: '#3B82F6',
};

// Category icons
const CATEGORY_ICONS: Record<string, string> = {
  temple: '🏛️',
  market: '🛍️',
  restaurant: '🍽️',
  park: '🌳',
  museum: '🏛️',
  shopping: '🛒',
  default: '📍',
};

// Marker Content Component
const MarkerContent: React.FC<{
  place: Place;
  isSelected: boolean;
  color: string;
  icon: string | React.ReactNode;
  onClick: () => void;
  isSequence?: boolean;
}> = ({ place, isSelected, color, icon, onClick, isSequence }) => {
  return (
    <div
      className={`place-marker ${isSelected ? 'selected' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        width: isSelected ? '40px' : '36px',
        height: isSelected ? '40px' : '36px',
        backgroundColor: color,
        border: isSequence ? '2px solid white' : '3px solid white',
        borderRadius: '50%',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: isSequence ? (isSelected ? '20px' : '18px') : (isSelected ? '18px' : '16px'),
        color: isSequence ? 'white' : 'inherit',
        fontWeight: isSequence ? 'bold' : 'normal',
        boxShadow: isSelected
          ? '0 4px 12px rgba(0,0,0,0.4)'
          : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'background-color 0.15s ease-in-out, transform 0.15s ease-in-out',
        transform: isSelected ? 'scale(1.15)' : 'scale(1)',
        zIndex: isSelected ? 100 : 10,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = isSelected ? 'scale(1.2)' : 'scale(1.1)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = isSelected ? 'scale(1.15)' : 'scale(1)';
      }}
    >
      {icon}
    </div>
  );
};

// Cluster Content Component
const ClusterContent: React.FC<{
  count: number;
  color: string;
  size: number;
  fontSize: number;
  onClick: () => void;
}> = ({ count, color, size, fontSize, onClick }) => {
  return (
    <div
      className="cluster-marker"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        border: '3px solid white',
        borderRadius: '50%',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${fontSize}px`,
        color: 'white',
        fontWeight: 'bold',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'transform 0.15s ease-in-out',
        transform: 'scale(1)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.1)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
      }}
    >
      {count}
    </div>
  );
};

const MapContainer: React.FC<MapContainerProps> = ({
  places,
  selectedPlace,
  onPlaceSelect,
  onPlaceDeselect,
  onVisiblePlacesChange,
  userLocation,
  initialCenter = [100.5018, 13.7563], // Bangkok center
  initialZoom = 11,
  previewItinerary = null,
  show3D = false,
  tripRoute = [],
  onRouteInfo,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const clusterMarkersRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const popupRootRef = useRef<Root | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const superclusterRef = useRef<Supercluster | null>(null);
  const markerRootsRef = useRef<Map<string, Root>>(new Map());
  const clusterRootsRef = useRef<Map<number, Root>>(new Map());
  const lastTripRouteKeyRef = useRef<string | null>(null);
  const lastPreviewRouteKeyRef = useRef<string | null>(null);

  // Callback refs to avoid stale closures in event handlers
  const onPlaceDeselectRef = useRef(onPlaceDeselect);
  const onPlaceSelectRef = useRef(onPlaceSelect);
  const onVisiblePlacesChangeRef = useRef(onVisiblePlacesChange);
  const userLocationRef = useRef(userLocation);

  // Keep refs in sync with props
  useEffect(() => {
    onPlaceDeselectRef.current = onPlaceDeselect;
  }, [onPlaceDeselect]);

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  useEffect(() => {
    onVisiblePlacesChangeRef.current = onVisiblePlacesChange;
  }, [onVisiblePlacesChange]);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<'dark' | 'light' | 'satellite'>('dark');
  const [currentZoom, setCurrentZoom] = useState(initialZoom);
  const [currentBounds, setCurrentBounds] = useState<[number, number, number, number] | null>(null);
  const [is3DEnabled, setIs3DEnabled] = useState(show3D);
  const [isTrafficEnabled, setIsTrafficEnabled] = useState(false);

  // Initialize Supercluster
  const initSupercluster = useCallback(() => {
    superclusterRef.current = new Supercluster({
      radius: 60,
      maxZoom: 16,
      minZoom: 0,
      minPoints: 2,
    });
  }, []);

  // Convert places to GeoJSON features for Supercluster
  const placesToFeatures = useCallback((places: Place[]): PointFeature[] => {
    return places
      .filter((p) => isFiniteNumber(p.lat) && isFiniteNumber(p.lng))
      .map((place) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [place.lng, place.lat] as [number, number],
        },
        properties: place,
      }));
  }, []);

  // Get clustered features
  const clusteredFeatures = useMemo(() => {
    if (!superclusterRef.current || !currentBounds) return [];

    const features = placesToFeatures(places);
    superclusterRef.current.load(features);

    if (previewItinerary) {
      // Disable clustering when previewing an itinerary so sequence numbers render individually
      return features as SuperclusterFeature[];
    }

    return superclusterRef.current.getClusters(
      currentBounds,
      Math.floor(currentZoom)
    ) as SuperclusterFeature[];
  }, [places, currentBounds, currentZoom, placesToFeatures, previewItinerary]);

  // Emit currently visible (unclustered) places to parent for UI sync
  useEffect(() => {
    const visiblePlaces = clusteredFeatures
      .filter((feature) => !("cluster" in feature.properties && feature.properties.cluster === true))
      .map((feature) => feature.properties as Place);

    onVisiblePlacesChangeRef.current?.(visiblePlaces);
  }, [clusteredFeatures]);

  // Initialize map - only runs once on mount (best practice: empty dependency array)
  useEffect(() => {
    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    if (!accessToken) {
      setMapError('Mapbox access token is not configured');
      return;
    }

    // Guard against double initialization (React StrictMode)
    if (map.current) return;
    if (!mapContainer.current) return;

    try {
      mapboxgl.accessToken = accessToken;
      initSupercluster();

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: initialCenter,
        zoom: initialZoom,
        pitch: show3D ? 45 : 0,
        bearing: 0,
        maxBounds: [
          [100.1, 13.4],
          [100.9, 14.1],
        ],
        minZoom: 8,
        maxZoom: 18,
        antialias: true,
      });

      const mapInstance = map.current;

      // Map event listeners
      const handleLoad = () => {
        setMapLoaded(true);
        updateBounds();

        // Add 3D building layer if enabled
        if (show3D && map.current) {
          add3DBuildingLayer();
        }
      };

      const handleZoom = () => {
        if (map.current) {
          setCurrentZoom(map.current.getZoom());
        }
      };

      const handleClick = (e: mapboxgl.MapMouseEvent) => {
        // Ignore clicks on overlays/controls/popups to avoid accidental deselect
        const target = e.originalEvent.target as HTMLElement | null;
        if (
          target?.closest('.marker-container') ||
          target?.closest('.cluster-container') ||
          target?.closest('.mapboxgl-popup') ||
          target?.closest('.mapboxgl-ctrl')
        ) {
          return;
        }

        closePopup();
        onPlaceDeselectRef.current();
      };

      const handleError = (e: mapboxgl.ErrorEvent) => {
        console.error('Map error:', e);
        setMapError('Failed to load map');
      };

      mapInstance.on('load', handleLoad);
      mapInstance.on('zoom', handleZoom);
      mapInstance.on('moveend', updateBounds);
      mapInstance.on('zoomend', updateBounds);
      mapInstance.on('click', handleClick);
      mapInstance.on('error', handleError);

      // Navigation controls
      mapInstance.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: true }),
        'top-right'
      );

      // Geolocate control
      const geolocateControl = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      });

      mapInstance.addControl(geolocateControl, 'top-right');

      // Scale control
      mapInstance.addControl(
        new mapboxgl.ScaleControl({ maxWidth: 100 }),
        'bottom-left'
      );
    } catch (error) {
      console.error('Map initialization error:', error);
      setMapError('Failed to initialize map');
    }

    // Cleanup function - comprehensive cleanup on unmount
    return () => {
      // Clear all place markers
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();

      // Clear all cluster markers  
      clusterMarkersRef.current.forEach((marker) => marker.remove());
      clusterMarkersRef.current.clear();

      // Remove user marker
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;

      // Close popup and cleanup React root
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (popupRootRef.current) {
        const root = popupRootRef.current;
        popupRootRef.current = null;
        // Defer unmount to avoid React 18 synchronous unmount warning
        queueMicrotask(() => root.unmount());
      }

      // Unmount all marker roots
      markerRootsRef.current.forEach((root) => {
        queueMicrotask(() => root.unmount());
      });
      markerRootsRef.current.clear();

      // Unmount all cluster roots
      clusterRootsRef.current.forEach((root) => {
        queueMicrotask(() => root.unmount());
      });
      clusterRootsRef.current.clear();

      // Remove map instance
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - map should only initialize once

  // Update bounds
  const updateBounds = useCallback(() => {
    if (!map.current) return;

    const bounds = map.current.getBounds();
    if (bounds) {
      setCurrentBounds([
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ]);
    }
  }, []);

  // Add 3D building layer
  const add3DBuildingLayer = useCallback(() => {
    if (!map.current) return;

    const layers = map.current.getStyle().layers;
    const labelLayerId = layers?.find(
      (layer) =>
        layer.type === 'symbol' && layer.layout?.['text-field']
    )?.id;

    if (map.current.getLayer('3d-buildings')) {
      map.current.removeLayer('3d-buildings');
    }

    map.current.addLayer(
      {
        id: '3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['zoom'],
            14,
            0,
            14.5,
            ['get', 'height'],
          ],
          'fill-extrusion-base': [
            'interpolate',
            ['linear'],
            ['zoom'],
            14,
            0,
            14.5,
            ['get', 'min_height'],
          ],
          'fill-extrusion-opacity': 0.6,
        },
      },
      labelLayerId
    );
  }, []);

  // Toggle 3D buildings
  const toggle3D = useCallback(() => {
    if (!map.current) return;

    const newValue = !is3DEnabled;
    setIs3DEnabled(newValue);

    if (newValue) {
      map.current.easeTo({ pitch: 45, duration: 500 });
      add3DBuildingLayer();
    } else {
      map.current.easeTo({ pitch: 0, duration: 500 });
      if (map.current.getLayer('3d-buildings')) {
        map.current.removeLayer('3d-buildings');
      }
    }
  }, [is3DEnabled, add3DBuildingLayer]);

  // Toggle traffic layer
  const toggleTraffic = useCallback(() => {
    if (!map.current) return;

    const newValue = !isTrafficEnabled;
    setIsTrafficEnabled(newValue);

    if (newValue) {
      // Check if source already exists before adding
      if (!map.current.getSource('traffic')) {
        map.current.addSource('traffic', {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-traffic-v1',
        });
      }

      // Check if layer already exists before adding
      if (!map.current.getLayer('traffic-line')) {
        map.current.addLayer({
          id: 'traffic-line',
          type: 'line',
          source: 'traffic',
          'source-layer': 'traffic',
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'congestion'], 'low'],
              '#4CAF50',
              ['==', ['get', 'congestion'], 'moderate'],
              '#FFC107',
              ['==', ['get', 'congestion'], 'heavy'],
              '#FF5722',
              ['==', ['get', 'congestion'], 'severe'],
              '#F44336',
              '#9E9E9E',
            ],
            'line-width': 2,
          },
        });
      }
    } else {
      if (map.current.getLayer('traffic-line')) {
        map.current.removeLayer('traffic-line');
      }
      if (map.current.getSource('traffic')) {
        map.current.removeSource('traffic');
      }
    }
  }, [isTrafficEnabled]);

  // Draw trip route following actual roads using Mapbox Directions API
  useEffect(() => {
    if (!map.current || !mapLoaded || previewItinerary || !tripRoute || tripRoute.length < 2) {
      // Remove route layer if trip route is empty
      if (map.current?.getLayer('trip-route')) {
        map.current.removeLayer('trip-route');
      }
      if (map.current?.getSource('trip-route')) {
        map.current.removeSource('trip-route');
      }
      lastTripRouteKeyRef.current = null;
      return;
    }

    const routeKey = tripRoute.map(([lng, lat]) => `${lng},${lat}`).join(';');
    if (lastTripRouteKeyRef.current === routeKey && map.current.getSource('trip-route')) {
      return;
    }
    lastTripRouteKeyRef.current = routeKey;

    const fetchRouteDirections = async () => {
      try {
        const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
        if (!accessToken) {
          console.error('Mapbox access token not found');
          drawStraightRoute();
          return;
        }

        // Build coordinates string for API: lng,lat;lng,lat;lng,lat
        const coordinatesString = tripRoute.map(([lng, lat]) => `${lng},${lat}`).join(';');

        // Build waypoints string - all points should be waypoints so we get a route through all
        // Format: ?waypoints=0;1;2 for all points
        const waypointIndices = Array.from({ length: tripRoute.length }, (_, i) => i).join(';');

        const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinatesString}?waypoints=${waypointIndices}&access_token=${accessToken}&overview=full&geometries=geojson`;

        console.log('Fetching route:', directionsUrl);

        const response = await fetch(directionsUrl);

        if (!response.ok) {
          console.error('Failed to fetch directions:', response.status, response.statusText);
          drawStraightRoute();
          return;
        }

        const data = await response.json();
        console.log('Route response:', data);

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const routeCoordinates = route.geometry.coordinates;

          // route.distance in meters, route.duration in seconds
          const distanceKm = route.distance ? route.distance / 1000 : 0;
          const travelDurationMin = route.duration ? Math.round(route.duration / 60) : 0;

          // Remove existing route layer if it exists
          if (map.current?.getLayer('trip-route')) {
            map.current.removeLayer('trip-route');
          }
          if (map.current?.getSource('trip-route')) {
            map.current.removeSource('trip-route');
          }

          // Create GeoJSON from the actual route
          const routeGeoJSON: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: routeCoordinates,
                },
                properties: {},
              },
            ],
          };

          // notify parent about route info (distance, travel duration)
          try {
            (onRouteInfo as any)?.({ distanceKm, durationMin: travelDurationMin, routeGeoJSON });
          } catch (e) {
            console.warn('onRouteInfo callback failed', e);
          }

          // Add the route source
          map.current!.addSource('trip-route', {
            type: 'geojson',
            data: routeGeoJSON,
          });

          // Add the route layer with solid line (not dashed)
          map.current!.addLayer({
            id: 'trip-route',
            type: 'line',
            source: 'trip-route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#3b82f6',
              'line-width': 4,
              'line-opacity': 0.85,
            },
          });

          // Fit bounds to show entire route with padding
          if (routeCoordinates.length > 0) {
            const bounds = routeCoordinates.reduce(
              (bounds: mapboxgl.LngLatBounds, coord: [number, number]) => bounds.extend(coord),
              new mapboxgl.LngLatBounds(
                routeCoordinates[0] as [number, number],
                routeCoordinates[0] as [number, number]
              )
            );
            map.current!.fitBounds(bounds, { padding: 80, duration: 1000 });
          }
        } else {
          console.warn('No routes found in response');
          drawStraightRoute();
        }
      } catch (error) {
        console.error('Error fetching route directions:', error);
        drawStraightRoute();
      }
    };

    const drawStraightRoute = () => {
      if (!map.current) return;

      console.log('Using fallback straight line route');

      // Remove existing route layer if it exists
      if (map.current.getLayer('trip-route')) {
        map.current.removeLayer('trip-route');
      }
      if (map.current.getSource('trip-route')) {
        map.current.removeSource('trip-route');
      }

      // Create a straight line as fallback
      const routeGeoJSON: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: tripRoute,
            },
            properties: {},
          },
        ],
      };

      map.current.addSource('trip-route', {
        type: 'geojson',
        data: routeGeoJSON,
      });

      map.current.addLayer({
        id: 'trip-route',
        type: 'line',
        source: 'trip-route',
        paint: {
          'line-color': '#3b82f6',
          'line-width': 4,
          'line-opacity': 0.8,
          'line-dasharray': [2, 2],
        },
      });

      // Fit bounds
      if (tripRoute.length > 0) {
        const bounds = tripRoute.reduce(
          (bounds, coord) => bounds.extend(coord),
          new mapboxgl.LngLatBounds(tripRoute[0], tripRoute[0])
        );
        map.current.fitBounds(bounds, { padding: 80 });
      }

      // compute approximate straight-line distance (km)
      const computeDistanceKm = (coords: [number, number][]) => {
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        let dist = 0;
        for (let i = 1; i < coords.length; i++) {
          const [lon1, lat1] = coords[i - 1];
          const [lon2, lat2] = coords[i];
          const R = 6371; // km
          const dLat = toRad(lat2 - lat1);
          const dLon = toRad(lon2 - lon1);
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          dist += R * c;
        }
        return dist;
      };

      const approxDistanceKm = computeDistanceKm(tripRoute as [number, number][]);
      // approximate walking speed 5 km/h -> travel duration minutes
      const approxTravelMin = Math.round((approxDistanceKm / 5) * 60);
      try {
        (onRouteInfo as any)?.({ distanceKm: approxDistanceKm, durationMin: approxTravelMin, routeGeoJSON });
      } catch (e) {
        console.warn('onRouteInfo callback failed', e);
      }
    };

    fetchRouteDirections();
  }, [tripRoute, mapLoaded, previewItinerary]);

  // Update map style
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const styleUrls: Record<'dark' | 'light' | 'satellite', string> = {
      dark: 'mapbox://styles/mapbox/dark-v11',
      light: 'mapbox://styles/mapbox/streets-v12',
      satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
    };

    map.current.setStyle(styleUrls[mapStyle]);

    // Re-add 3D buildings after style change if enabled
    map.current.once('style.load', () => {
      if (is3DEnabled) {
        add3DBuildingLayer();
      }
    });
  }, [mapStyle, mapLoaded, is3DEnabled, add3DBuildingLayer]);

  // Close popup - with proper React 18 root cleanup
  const closePopup = useCallback(() => {
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
    if (popupRootRef.current) {
      // Defer unmount to avoid React 18 synchronous unmount warning
      const root = popupRootRef.current;
      popupRootRef.current = null;
      queueMicrotask(() => root.unmount());
    }
  }, []);

  // Show place popup with React component
  const showPlacePopup = useCallback(
    (place: Place) => {
      if (!map.current) return;

      closePopup();

      // Create popup container
      const popupContainer = document.createElement('div');
      popupContainer.className = 'place-popup-container';

      // Create React root and render component
      popupRootRef.current = createRoot(popupContainer);
      popupRootRef.current.render(
        <PlacePopupContent
          place={place}
          onViewDetails={() => {
            window.location.href = `/places/${place.slug}`;
          }}
          onGetDirections={() => {
            if (userLocation) {
              const url = `https://www.google.com/maps/dir/${userLocation[1]},${userLocation[0]}/${place.lat},${place.lng}`;
              window.open(url, '_blank');
            } else {
              const url = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
              window.open(url, '_blank');
            }
          }}
          onClose={() => {
            closePopup();
            onPlaceDeselect();
          }}
          userLocation={userLocation}
        />
      );

      // Create Mapbox popup
      popupRef.current = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        anchor: 'bottom',
        offset: [0, -20],
        maxWidth: 'none',
        className: 'mapbox-popup-custom',
      })
        .setLngLat([place.lng, place.lat])
        .setDOMContent(popupContainer)
        .addTo(map.current);

      popupRef.current.on('close', () => {
        if (popupRootRef.current) {
          const root = popupRootRef.current;
          popupRootRef.current = null;
          // Defer unmount to avoid React 18 synchronous unmount warning
          queueMicrotask(() => root.unmount());
        }
        onPlaceDeselectRef.current();
      });
    },
    [closePopup, onPlaceDeselect, userLocation]
  );

  // Get marker color based on tags
  const getMarkerColor = useCallback((place: Place): string => {
    const tags = place.tags.map((tag) => tag.toLowerCase());

    for (const [category, color] of Object.entries(CATEGORY_COLORS)) {
      if (tags.some((tag) => tag.includes(category))) {
        return color;
      }
    }
    return CATEGORY_COLORS.default;
  }, []);

  // Get marker icon based on tags
  const getMarkerIcon = useCallback((place: Place): string => {
    const tags = place.tags.map((tag) => tag.toLowerCase());

    for (const [category, icon] of Object.entries(CATEGORY_ICONS)) {
      if (tags.some((tag) => tag.includes(category))) {
        return icon;
      }
    }
    return CATEGORY_ICONS.default;
  }, []);

  // Get cluster color based on count
  const getClusterColor = useCallback((count: number): string => {
    if (count < 5) return '#3B82F6';
    if (count < 10) return '#8B5CF6';
    if (count < 25) return '#EF4444';
    return '#DC2626';
  }, []);

  // Create marker element container
  const createMarkerElement = useCallback(
    (isSelected: boolean = false): HTMLElement => {
      const el = document.createElement('div');
      el.className = `marker-container ${isSelected ? 'selected' : ''}`;
      return el;
    },
    []
  );

  // Create cluster marker container
  const createClusterElement = useCallback(
    (): HTMLElement => {
      const el = document.createElement('div');
      el.className = 'cluster-container';
      return el;
    },
    []
  );

  // Update markers based on clustered features
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const currentMarkerIds = new Set<string>();
    const currentClusterIds = new Set<number>();

    // Process clustered features
    clusteredFeatures.forEach((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      const props = feature.properties;

      if ('cluster' in props && props.cluster === true) {
        const clusterProps = props as { cluster: true; cluster_id: number; point_count: number; point_count_abbreviated: string | number };
        const clusterId = clusterProps.cluster_id;
        const count = clusterProps.point_count;
        currentClusterIds.add(clusterId);

        let marker = clusterMarkersRef.current.get(clusterId);
        let root = clusterRootsRef.current.get(clusterId);

        if (!marker) {
          const el = createClusterElement();
          marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([lng, lat])
            .addTo(map.current!);

          root = createRoot(el);
          clusterMarkersRef.current.set(clusterId, marker);
          clusterRootsRef.current.set(clusterId, root);
        } else {
          marker.setLngLat([lng, lat]);
        }

        const size = Math.min(60, Math.max(36, 28 + count * 1.5));
        const color = getClusterColor(count);
        const fontSize = Math.max(12, Math.min(18, 10 + count * 0.5));

        root?.render(
          <ClusterContent
            count={count}
            color={color}
            size={size}
            fontSize={fontSize}
            onClick={() => {
              if (superclusterRef.current && map.current) {
                const expansionZoom = Math.min(
                  superclusterRef.current.getClusterExpansionZoom(clusterId),
                  18
                );

                map.current.flyTo({
                  center: [lng, lat],
                  zoom: expansionZoom,
                  duration: 800,
                  easing: (t) => t * (2 - t),
                });
              }
            }}
          />
        );
      } else {
        // Individual place marker
        const place = feature.properties as Place;
        const markerId = place.id;
        currentMarkerIds.add(markerId);

        const isSelected = selectedPlace?.id === place.id;
        let marker = markersRef.current.get(markerId);
        let root = markerRootsRef.current.get(markerId);

        let sequenceNumber: number | undefined;
        let isSequence = false;
        if (previewItinerary && previewItinerary.stops) {
          const stops = previewItinerary.stops as any[];
          const index = stops.findIndex((s: any) => s.slug === place.slug || s.name === place.name);
          if (index !== -1) {
            sequenceNumber = index + 1;
            isSequence = true;
          }
        }

        if (!marker) {
          const el = createMarkerElement(isSelected);
          marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([lng, lat])
            .addTo(map.current!);

          root = createRoot(el);
          markersRef.current.set(markerId, marker);
          markerRootsRef.current.set(markerId, root);
        } else {
          marker.setLngLat([lng, lat]);
        }

        const color = isSequence ? '#2563eb' : getMarkerColor(place);
        const icon = isSequence ? sequenceNumber : getMarkerIcon(place);

        root?.render(
          <MarkerContent
            place={place}
            isSelected={isSelected}
            color={color}
            icon={icon as any}
            onClick={() => {
              showPlacePopup(place);
              onPlaceSelect(place);
            }}
            isSequence={isSequence}
          />
        );
      }
    });

    // Remove markers that are no longer visible
    markersRef.current.forEach((marker, id) => {
      if (!currentMarkerIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);

        const root = markerRootsRef.current.get(id);
        if (root) {
          queueMicrotask(() => root.unmount());
          markerRootsRef.current.delete(id);
        }
      }
    });

    clusterMarkersRef.current.forEach((marker, id) => {
      if (!currentClusterIds.has(id)) {
        marker.remove();
        clusterMarkersRef.current.delete(id);

        const root = clusterRootsRef.current.get(id);
        if (root) {
          queueMicrotask(() => root.unmount());
          clusterRootsRef.current.delete(id);
        }
      }
    });
  }, [
    clusteredFeatures,
    mapLoaded,
    selectedPlace,
    createMarkerElement,
    createClusterElement,
    showPlacePopup,
    onPlaceSelect,
    previewItinerary,
    getMarkerColor,
    getMarkerIcon,
  ]);

  // Draw route line for itinerary preview
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const sourceId = 'preview-route-source';
    const layerId = 'preview-route-layer';

    if (!previewItinerary || !previewItinerary.stops || previewItinerary.stops.length < 2) {
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
      lastPreviewRouteKeyRef.current = null;
      return;
    }

    const stops = previewItinerary.stops as any[];
    const coordinates = stops
      .filter((s) => typeof s.lng === 'number' && typeof s.lat === 'number')
      .map((s) => [s.lng, s.lat]);

    if (coordinates.length < 2) return;

    const previewRouteKey = coordinates.map((c: number[]) => c.join(',')).join(';');
    if (lastPreviewRouteKeyRef.current === previewRouteKey && map.current.getSource(sourceId)) {
      return;
    }
    lastPreviewRouteKeyRef.current = previewRouteKey;

    const drawRoute = (routeCoordinates: [number, number][]) => {
      if (!map.current) return;

      const geojson = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeCoordinates,
        },
      };

      if (map.current.getSource(sourceId)) {
        (map.current.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(geojson as any);
        return;
      }

      map.current.addSource(sourceId, {
        type: 'geojson',
        data: geojson as any,
      });

      map.current.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#2563eb',
          'line-width': 4,
          'line-opacity': 0.85,
        },
      });
    };

    const drawStraightRoute = () => {
      drawRoute(coordinates as [number, number][]);
    };

    // Fetch realistic walking route from Mapbox Directions API first
    const fetchDirections = async () => {
      try {
        const coordsString = coordinates.map((c: number[]) => c.join(',')).join(';');
        const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

        if (!token) {
          console.error('Mapbox access token not found for preview itinerary');
          drawStraightRoute();
          return;
        }

        const waypointIndices = Array.from({ length: coordinates.length }, (_, i) => i).join(';');
        const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordsString}?waypoints=${waypointIndices}&overview=full&geometries=geojson&access_token=${token}`;

        const res = await fetch(url);

        if (!res.ok) {
          console.error('Failed to fetch directions for preview itinerary', res.status, res.statusText);
          drawStraightRoute();
          return;
        }

        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const routeCoordinates = data.routes[0].geometry?.coordinates;
          if (Array.isArray(routeCoordinates) && routeCoordinates.length > 1) {
            drawRoute(routeCoordinates as [number, number][]);
            return;
          }
        }

        drawStraightRoute();
      } catch (err) {
        console.error('Failed to fetch directions for preview itinerary', err);
        drawStraightRoute();
      }
    };

    fetchDirections();
  }, [previewItinerary, mapLoaded]);

  // Add user location marker
  useEffect(() => {
    if (!map.current || !mapLoaded || !userLocation) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }

    // Create container for user marker
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      width: 32px;
      height: 32px;
    `;

    // Create the main dot
    const el = document.createElement('div');
    el.className = 'user-location-marker';
    el.style.cssText = `
      width: 18px;
      height: 18px;
      background-color: #3B82F6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.6), 0 0 0 2px rgba(59, 130, 246, 0.2);
      position: relative;
      z-index: 2;
    `;

    // Create accuracy circle (outer ring)
    const accuracyRing = document.createElement('div');
    accuracyRing.style.cssText = `
      position: absolute;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1px solid rgba(59, 130, 246, 0.4);
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1;
    `;

    container.appendChild(accuracyRing);
    container.appendChild(el);

    userMarkerRef.current = new mapboxgl.Marker({
      element: container,
      anchor: 'center',
    })
      .setLngLat(userLocation)
      .addTo(map.current);
  }, [userLocation, mapLoaded]);

  // Fly to selected place with enhanced animation
  useEffect(() => {
    if (!map.current || !mapLoaded || !selectedPlace) return;

    // Enhanced flyTo with smooth easing and optional 3D pitch
    map.current.flyTo({
      center: [selectedPlace.lng, selectedPlace.lat],
      zoom: 16,
      pitch: is3DEnabled ? 50 : 0,
      bearing: 0,
      duration: 1200,
      essential: true,
      // easeOutQuad for smooth deceleration
      easing: (t) => t * (2 - t),
    });

    showPlacePopup(selectedPlace);
  }, [selectedPlace, mapLoaded, showPlacePopup, is3DEnabled]);

  // Auto-fit bounds for itinerary preview
  useEffect(() => {
    if (!map.current || !mapLoaded || !previewItinerary?.stops?.length) return;

    const stops = previewItinerary.stops as any[];
    const coordinates = stops
      .filter((s) => typeof s.lng === 'number' && typeof s.lat === 'number')
      .map((s) => [s.lng, s.lat] as [number, number]);

    if (coordinates.length < 2) return;

    const bounds = new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]);
    for (const coord of coordinates) {
      bounds.extend(coord);
    }

    map.current.fitBounds(bounds, {
      padding: { top: 80, bottom: 80, left: 80, right: 400 }, // right padding for the itinerary panel
      duration: 1200,
      maxZoom: 15,
    });
  }, [previewItinerary, mapLoaded]);

  // Map control handlers
  const handleStyleChange = useCallback((style: 'dark' | 'light' | 'satellite') => {
    setMapStyle(style);
  }, []);

  const handleZoomIn = useCallback(() => {
    map.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    map.current?.zoomOut();
  }, []);

  const handleFlyToUserLocation = useCallback(() => {
    if (map.current && userLocation) {
      map.current.flyTo({
        center: userLocation,
        zoom: 16,
        duration: 1000,
        easing: (t) => t * (2 - t), // easeOutQuad
      });
    }
  }, [userLocation]);

  // Error fallback
  if (mapError) {
    return (
      <div className="relative w-full h-full bg-gray-100 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Map Loading Error
          </h3>
          <p className="text-gray-600">{mapError}</p>
        </div>
      </div>
    );
  }

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
        onToggle3D={toggle3D}
        onToggleTraffic={toggleTraffic}
        currentStyle={mapStyle}
        hasUserLocation={!!userLocation}
        is3DEnabled={is3DEnabled}
        isTrafficEnabled={isTrafficEnabled}
      />

      {/* Loading overlay */}
      <AnimatePresence>
        {!mapLoaded && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-gray-100 flex items-center justify-center"
          >
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
              <p className="text-gray-600">Initializing map...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom popup styles */}
      <style jsx global>{`
        .mapbox-popup-custom {
          max-width: none !important;
        }
        .mapbox-popup-custom .mapboxgl-popup-content {
          padding: 0;
          background: transparent;
          box-shadow: none;
          border-radius: 12px;
          overflow: hidden;
        }
        .mapbox-popup-custom .mapboxgl-popup-tip {
          display: none;
        }
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
          }
        }
      `}</style>
    </div>
  );
};

// Helper function
function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && isFinite(n);
}

export default MapContainer;
