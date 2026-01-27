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
  userLocation?: [number, number] | null;
  initialCenter?: [number, number];
  initialZoom?: number;
  itineraryStops?: ItineraryStop[];
  show3D?: boolean;
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

const MapContainer: React.FC<MapContainerProps> = ({
  places,
  selectedPlace,
  onPlaceSelect,
  onPlaceDeselect,
  userLocation,
  initialCenter = [100.5018, 13.7563], // Bangkok center
  initialZoom = 11,
  itineraryStops = [],
  show3D = false,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const clusterMarkersRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
  const itineraryMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const popupRootRef = useRef<Root | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const superclusterRef = useRef<Supercluster | null>(null);

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

    return superclusterRef.current.getClusters(
      currentBounds,
      Math.floor(currentZoom)
    ) as SuperclusterFeature[];
  }, [places, currentBounds, currentZoom, placesToFeatures]);

  // Initialize map
  useEffect(() => {
    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    if (!accessToken) {
      setMapError('Mapbox access token is not configured');
      return;
    }

    if (map.current) return;

    try {
      mapboxgl.accessToken = accessToken;
      initSupercluster();

map.current = new mapboxgl.Map({
        container: mapContainer.current!,
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

      // Map event listeners
      map.current.on('load', () => {
        setMapLoaded(true);
        updateBounds();

        // Add 3D building layer if enabled
        if (show3D && map.current) {
          add3DBuildingLayer();
        }
      });

      map.current.on('zoom', () => {
        if (map.current) {
          setCurrentZoom(map.current.getZoom());
        }
      });

      map.current.on('moveend', updateBounds);
      map.current.on('zoomend', updateBounds);

      map.current.on('click', (e) => {
        // Check if click was on a marker
        const features = map.current?.queryRenderedFeatures(e.point, {
          layers: [],
        });

        if (!features?.length) {
          closePopup();
          onPlaceDeselect();
        }
      });

      map.current.on('error', (e) => {
        console.error('Map error:', e);
        setMapError('Failed to load map');
      });

      // Navigation controls
      map.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: true }),
        'top-right'
      );

      // Geolocate control
      const geolocateControl = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      });

      map.current.addControl(geolocateControl, 'top-right');

      // Scale control
      map.current.addControl(
        new mapboxgl.ScaleControl({ maxWidth: 100 }),
        'bottom-left'
      );
    } catch (error) {
      console.error('Map initialization error:', error);
      setMapError('Failed to initialize map');
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [initialCenter, initialZoom, onPlaceDeselect, show3D, initSupercluster]);

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
      map.current.addSource('traffic', {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-traffic-v1',
      });

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
    } else {
      if (map.current.getLayer('traffic-line')) {
        map.current.removeLayer('traffic-line');
      }
      if (map.current.getSource('traffic')) {
        map.current.removeSource('traffic');
      }
    }
  }, [isTrafficEnabled]);

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

  // Close popup
  const closePopup = useCallback(() => {
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
    if (popupRootRef.current) {
      popupRootRef.current.unmount();
      popupRootRef.current = null;
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
          popupRootRef.current.unmount();
          popupRootRef.current = null;
        }
        onPlaceDeselect();
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

  // Create marker element
  const createMarkerElement = useCallback(
    (place: Place, isSelected: boolean = false): HTMLElement => {
      const el = document.createElement('div');
      el.className = `place-marker ${isSelected ? 'selected' : ''}`;

      const color = getMarkerColor(place);
      const icon = getMarkerIcon(place);

      el.style.cssText = `
        width: ${isSelected ? '40px' : '36px'};
        height: ${isSelected ? '40px' : '36px'};
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isSelected ? '18px' : '16px'};
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
        z-index: ${isSelected ? '100' : '10'};
      `;

      el.innerHTML = icon;

      // Hover effects
      el.addEventListener('mouseenter', () => {
        if (!isSelected) {
          el.style.transform = 'scale(1.1)';
          el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
        }
      });

      el.addEventListener('mouseleave', () => {
        if (!isSelected) {
          el.style.transform = 'scale(1)';
          el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        }
      });

      return el;
    },
    [getMarkerColor, getMarkerIcon]
  );

  // Create cluster marker element
  const createClusterElement = useCallback(
    (count: number): HTMLElement => {
      const el = document.createElement('div');
      el.className = 'cluster-marker';

      const size = Math.min(60, Math.max(36, 28 + count * 1.5));
      const color = getClusterColor(count);

      el.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${Math.max(12, Math.min(18, 10 + count * 0.5))}px;
        color: white;
        font-weight: bold;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      `;

      el.innerHTML = `${count}`;

      // Hover effects
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.1)';
        el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
      });

      return el;
    },
    [getClusterColor]
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
        // Cluster marker - TypeScript now knows props has cluster properties
        const clusterProps = props as { cluster: true; cluster_id: number; point_count: number; point_count_abbreviated: string | number };
        const clusterId = clusterProps.cluster_id;
        const count = clusterProps.point_count;
        currentClusterIds.add(clusterId);

        if (!clusterMarkersRef.current.has(clusterId)) {
          const el = createClusterElement(count);

          // Click handler - zoom into cluster
          el.addEventListener('click', (e) => {
            e.stopPropagation();

            if (superclusterRef.current && map.current) {
              const expansionZoom = Math.min(
                superclusterRef.current.getClusterExpansionZoom(clusterId),
                18
              );

map.current.flyTo({
                center: [lng, lat],
                zoom: expansionZoom,
                duration: 800,
                easing: (t) => t * (2 - t), // easeOutQuad
              });
            }
          });

          const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([lng, lat])
            .addTo(map.current!);

          clusterMarkersRef.current.set(clusterId, marker);
        } else {
          // Update position
          clusterMarkersRef.current.get(clusterId)?.setLngLat([lng, lat]);
        }
      } else {
        // Individual place marker
        const place = feature.properties as Place;
        const markerId = place.id;
        currentMarkerIds.add(markerId);

        const isSelected = selectedPlace?.id === place.id;

        if (!markersRef.current.has(markerId)) {
          const el = createMarkerElement(place, isSelected);

          // Click handler
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            showPlacePopup(place);
            onPlaceSelect(place);
          });

          const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([lng, lat])
            .addTo(map.current!);

          markersRef.current.set(markerId, marker);
        } else {
          // Update selection state
          const marker = markersRef.current.get(markerId);
          if (marker) {
            const el = marker.getElement();
            if (isSelected) {
              el.classList.add('selected');
              el.style.transform = 'scale(1.15)';
              el.style.zIndex = '100';
            } else {
              el.classList.remove('selected');
              el.style.transform = 'scale(1)';
              el.style.zIndex = '10';
            }
          }
        }
      }
    });

    // Remove markers that are no longer visible
    markersRef.current.forEach((marker, id) => {
      if (!currentMarkerIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    clusterMarkersRef.current.forEach((marker, id) => {
      if (!currentClusterIds.has(id)) {
        marker.remove();
        clusterMarkersRef.current.delete(id);
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
  ]);

  // Add user location marker
  useEffect(() => {
    if (!map.current || !mapLoaded || !userLocation) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }

    const el = document.createElement('div');
    el.className = 'user-location-marker';
    el.style.cssText = `
      width: 20px;
      height: 20px;
      background-color: #3B82F6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
      animation: pulse 2s infinite;
    `;

    userMarkerRef.current = new mapboxgl.Marker({
      element: el,
      anchor: 'center',
    })
      .setLngLat(userLocation)
      .addTo(map.current);
  }, [userLocation, mapLoaded]);

  // Draw itinerary route
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const ROUTE_SOURCE_ID = 'itinerary-route-source';
    const ROUTE_LAYER_ID = 'itinerary-route-layer';
    const ROUTE_OUTLINE_LAYER_ID = 'itinerary-route-outline-layer';

    const cleanup = () => {
      if (map.current?.getLayer(ROUTE_LAYER_ID)) {
        map.current.removeLayer(ROUTE_LAYER_ID);
      }
      if (map.current?.getLayer(ROUTE_OUTLINE_LAYER_ID)) {
        map.current.removeLayer(ROUTE_OUTLINE_LAYER_ID);
      }
      if (map.current?.getSource(ROUTE_SOURCE_ID)) {
        map.current.removeSource(ROUTE_SOURCE_ID);
      }
    };

    if (itineraryStops.length < 2) {
      cleanup();
      return;
    }

    const fetchAndDrawRoute = async () => {
      const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (!accessToken) return;

      const coords = itineraryStops
        .map((stop) => `${stop.lng},${stop.lat}`)
        .join(';');

      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${accessToken}`;

      try {
        const response = await fetch(url);
        if (!response.ok) return;

        const data = await response.json();
        if (!data.routes?.length) return;

        const routeGeometry = data.routes[0].geometry;

        cleanup();

        map.current?.addSource(ROUTE_SOURCE_ID, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: routeGeometry,
          },
        });

        // Route outline (for better visibility)
        map.current?.addLayer({
          id: ROUTE_OUTLINE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#1D4ED8',
            'line-width': 8,
            'line-opacity': 0.4,
          },
        });

        // Main route line
        map.current?.addLayer({
          id: ROUTE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#3B82F6',
            'line-width': 4,
            'line-opacity': 0.9,
          },
        });

        // Fit map to route bounds
        const coordinates = routeGeometry.coordinates as [number, number][];
        if (coordinates.length > 0) {
          const bounds = coordinates.reduce(
            (bounds, coord) => bounds.extend(coord),
            new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
          );
          map.current?.fitBounds(bounds, { padding: 80, duration: 1000 });
        }
      } catch (error) {
        console.error('Error fetching directions:', error);
      }
    };

    fetchAndDrawRoute();

    return cleanup;
  }, [itineraryStops, mapLoaded]);

  // Add itinerary stop markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    itineraryMarkersRef.current.forEach((marker) => marker.remove());
    itineraryMarkersRef.current = [];

    if (itineraryStops.length === 0) return;

    itineraryStops.forEach((stop, index) => {
      if (!isFiniteNumber(stop.lat) || !isFiniteNumber(stop.lng)) return;

      const el = document.createElement('div');
      el.className = 'itinerary-stop-marker';
      el.style.cssText = `
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #3B82F6, #1D4ED8);
        border: 3px solid white;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        color: white;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 20;
      `;
      el.innerHTML = `${index + 1}`;

      // Hover effects
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.15)';
        el.style.boxShadow = '0 6px 16px rgba(0,0,0,0.5)';
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
        el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
      });

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = `/places/${stop.slug}`;
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([stop.lng, stop.lat])
        .addTo(map.current!);

      itineraryMarkersRef.current.push(marker);
    });
  }, [itineraryStops, mapLoaded]);

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
