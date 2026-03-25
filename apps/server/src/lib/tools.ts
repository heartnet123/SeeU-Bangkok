import { supabase } from './supabase'
import { nameToSlug } from './slug-utils'
import { traceable } from 'langsmith/traceable'

export type LatLng = { lat: number; lng: number }

const RATTANAKOSIN_BOUNDS = {
  minLat: 13.739,
  maxLat: 13.765,
  minLng: 100.489,
  maxLng: 100.510,
} as const

export interface PlaceRow {
  id: string
  name: string
  description?: string | null
  tags?: string[] | null
  lat?: number | null
  lng?: number | null
  address?: string | null
  price?: number | null
  image_url?: string | null
}

export interface PlaceItem {
  id: string
  name: string
  slug: string
  lat?: number
  lng?: number
  tags: string[]
  price?: number
  image_url: string
}

export interface SearchPlacesParams {
  query?: string
  location?: LatLng
  radius_km?: number
  categories?: string[]
  limit?: number
}

function isWithinRattanakosin(location: LatLng): boolean {
  return (
    location.lat >= RATTANAKOSIN_BOUNDS.minLat &&
    location.lat <= RATTANAKOSIN_BOUNDS.maxLat &&
    location.lng >= RATTANAKOSIN_BOUNDS.minLng &&
    location.lng <= RATTANAKOSIN_BOUNDS.maxLng
  )
}

export { RATTANAKOSIN_BOUNDS, isWithinRattanakosin }

function applyRattanakosinBounds<T extends {
  gte: (column: string, value: number) => T
  lte: (column: string, value: number) => T
}>(query: T): T {
  return query
    .gte('lat', RATTANAKOSIN_BOUNDS.minLat)
    .lte('lat', RATTANAKOSIN_BOUNDS.maxLat)
    .gte('lng', RATTANAKOSIN_BOUNDS.minLng)
    .lte('lng', RATTANAKOSIN_BOUNDS.maxLng)
}

export async function search_places(params: SearchPlacesParams): Promise<PlaceItem[]> {
  const { query, categories, limit = 10 } = params

  let q = applyRattanakosinBounds(
    supabase.from('bangkok_unseen').select('*').order('name').limit(limit)
  )

  if (query && query.trim()) {
    const kw = query.trim()
    q = q.or(`name.ilike.%${kw}%,description.ilike.%${kw}%`)
  }

  if (categories && categories.length) {
    // Filter by tags containing any of the categories
    // Supabase array contains: .contains('tags', ['food']) matches array contains all provided, so for ANY we can OR conditions
    const orParts = categories.map((cat) => `tags.cs.{"${cat}"}`)
    q = q.or(orParts.join(','))
  }

  const { data, error } = await q
  if (error) throw error

  return (data || []).map(cleanPlace)
}

export interface NearbyPlacesParams {
  location: LatLng
  radius_km?: number // default ~5
  limit?: number
}

export async function nearby_places(params: NearbyPlacesParams): Promise<PlaceItem[]> {
  const { location, limit = 10 } = params
  if (!isWithinRattanakosin(location)) {
    return []
  }

  const radius_km = params.radius_km ?? 5
  const latRange = radius_km / 111 // ~km per degree
  const lngRange = radius_km / (111 * Math.cos((location.lat * Math.PI) / 180) || 1)

  const minLat = Math.max(location.lat - latRange, RATTANAKOSIN_BOUNDS.minLat)
  const maxLat = Math.min(location.lat + latRange, RATTANAKOSIN_BOUNDS.maxLat)
  const minLng = Math.max(location.lng - lngRange, RATTANAKOSIN_BOUNDS.minLng)
  const maxLng = Math.min(location.lng + lngRange, RATTANAKOSIN_BOUNDS.maxLng)

  const { data, error } = await supabase
    .from('bangkok_unseen')
    .select('*')
    .gte('lat', minLat)
    .lte('lat', maxLat)
    .gte('lng', minLng)
    .lte('lng', maxLng)
    .order('name')
    .limit(limit)

  if (error) throw error
  return (data || []).map(cleanPlace)
}

export type TravelMode = 'walk' | 'bike' | 'public' | 'car' | 'grab'

export interface BuildRouteParams {
  places: PlaceItem[]
  origin?: LatLng
  mode?: TravelMode
}

export interface RouteLeg {
  from: string // slug
  to: string // slug
  distance_km: number
  duration_min?: number
}

export interface BuiltRoute {
  order: string[] // slugs
  legs: RouteLeg[]
  total_km: number
  total_mins?: number
}

interface DirectionsRouteData {
  legs: Array<{
    distance_km: number
    duration_min?: number
  }>
  total_km: number
  total_mins?: number
}

function toMapboxProfile(mode: TravelMode = 'car'): 'driving' | 'walking' | 'cycling' {
  if (mode === 'walk') return 'walking'
  if (mode === 'bike') return 'cycling'
  return 'driving'
}

async function fetchMapboxMatrix(coords: LatLng[]): Promise<{ distances: number[][], durations: number[][] } | null> {
  const token = process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token || coords.length < 2 || coords.length > 25) return null;

  const coordStr = coords.map(c => `${c.lng},${c.lat}`).join(';');
  const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coordStr}?annotations=distance,duration&access_token=${token}`;

  const timeoutMs = Number(process.env.MAPBOX_MATRIX_TIMEOUT_MS || 2200);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 'Ok') return null;
    return {
      distances: data.distances, // in meters
      durations: data.durations  // in seconds
    };
  } catch (e: any) {
    if (e?.name !== 'AbortError') {
      console.error('Mapbox Matrix fetch error:', e);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchMapboxDirectionsRoute(coords: LatLng[], mode: TravelMode = 'car'): Promise<DirectionsRouteData | null> {
  const token = process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  if (!token || coords.length < 2 || coords.length > 25) return null

  const profile = toMapboxProfile(mode)
  const coordStr = coords.map(c => `${c.lng},${c.lat}`).join(';')
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordStr}?alternatives=false&steps=false&overview=full&geometries=geojson&access_token=${token}`

  const timeoutMs = Number(process.env.MAPBOX_DIRECTIONS_TIMEOUT_MS || 2600)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    const data = await res.json()
    const route = Array.isArray(data.routes) ? data.routes[0] : null
    if (data.code !== 'Ok' || !route || !Array.isArray(route.legs)) return null

    return {
      legs: route.legs.map((leg: { distance?: number, duration?: number }) => ({
        distance_km: round1((leg.distance || 0) / 1000),
        duration_min: typeof leg.duration === 'number' ? Math.max(1, Math.ceil(leg.duration / 60)) : undefined
      })),
      total_km: round1((route.distance || 0) / 1000),
      total_mins: typeof route.duration === 'number' ? Math.max(1, Math.ceil(route.duration / 60)) : undefined
    }
  } catch (e: any) {
    if (e?.name !== 'AbortError') {
      console.error('Mapbox Directions fetch error:', e)
    }
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

export const build_route = traceable(
  async (params: BuildRouteParams): Promise<BuiltRoute> => {
    const { places, origin, mode = 'car' } = params
    const pts = places.filter((p) => isFiniteNum(p.lat) && isFiniteNum(p.lng))
    if (pts.length < 2) return { order: pts.map((p) => p.slug), legs: [], total_km: 0 }

    const matrixCoords = origin ? [origin, ...pts.map(p => ({ lat: p.lat!, lng: p.lng! }))] : pts.map(p => ({ lat: p.lat!, lng: p.lng! }))
    const matrixData = await fetchMapboxMatrix(matrixCoords)

    const unvisited = new Set(pts.map((p) => p.slug))
    const bySlug = new Map(pts.map((p) => [p.slug, p]))
    const slugToIdx = new Map<string, number>()
    pts.forEach((p, i) => slugToIdx.set(p.slug, origin ? i + 1 : i))

    const getTravelCost = (fromSlug: string | null, toSlug: string) => {
      const p = bySlug.get(toSlug)!
      if (matrixData) {
        const fromIdx = fromSlug === null ? 0 : slugToIdx.get(fromSlug)!
        const toIdx = slugToIdx.get(toSlug)!
        const dur = matrixData.durations[fromIdx][toIdx]
        const dist = matrixData.distances[fromIdx][toIdx] / 1000
        if (typeof dur === 'number') return { d: dist, dur }
      }
      const fromLoc = fromSlug === null ? origin! : { lat: bySlug.get(fromSlug)!.lat!, lng: bySlug.get(fromSlug)!.lng! }
      const d = haversineKm(fromLoc, { lat: p.lat!, lng: p.lng! })
      return { d, dur: undefined }
    }

    let currentSlug: string
    if (origin) {
      let bestSlug = pts[0].slug
      let bestCost = Infinity
      for (const p of pts) {
        const cost = getTravelCost(null, p.slug)
        const metric = cost.dur !== undefined ? cost.dur : cost.d
        if (metric < bestCost) { bestCost = metric; bestSlug = p.slug; }
      }
      currentSlug = bestSlug
    } else {
      currentSlug = pts[0].slug
    }

    const order: string[] = [currentSlug]
    unvisited.delete(currentSlug)
    const legs: RouteLeg[] = []

    while (unvisited.size) {
      let bestSlug: string | null = null
      let bestDist = 0
      let bestDur: number | undefined
      let bestMetric = Infinity

      for (const s of unvisited) {
        const cost = getTravelCost(currentSlug, s)
        const metric = cost.dur !== undefined ? cost.dur : cost.d
        if (metric < bestMetric) {
          bestMetric = metric
          bestSlug = s
          bestDist = cost.d
          bestDur = cost.dur
        }
      }

      if (!bestSlug) break
      legs.push({
        from: currentSlug,
        to: bestSlug,
        distance_km: round1(bestDist),
        duration_min: bestDur !== undefined ? Math.max(1, Math.ceil(bestDur / 60)) : undefined
      })
      currentSlug = bestSlug
      order.push(currentSlug)
      unvisited.delete(currentSlug)
    }

    const directionsRoute = await fetchMapboxDirectionsRoute(
      order.map((slug) => {
        const place = bySlug.get(slug)!
        return { lat: place.lat!, lng: place.lng! }
      }),
      mode
    )

    if (directionsRoute && directionsRoute.legs.length === Math.max(order.length - 1, 0)) {
      const routedLegs = order.slice(1).map((to, index) => ({
        from: order[index]!,
        to,
        distance_km: directionsRoute.legs[index]!.distance_km,
        duration_min: directionsRoute.legs[index]!.duration_min,
      }))

      return {
        order,
        legs: routedLegs,
        total_km: directionsRoute.total_km,
        total_mins: directionsRoute.total_mins ?? routedLegs.reduce((sum, leg) => sum + (leg.duration_min || 0), 0),
      }
    }

    const total_km = round1(legs.reduce((s, l) => s + l.distance_km, 0))
    const total_mins = legs.reduce((s, l) => s + (l.duration_min || 0), 0)
    return { order, legs, total_km, total_mins }
  },
  { name: 'tools.build_route', run_type: 'tool' }
)

export interface MapViewport {
  center: LatLng
  zoom: number
  bounds: { minLat: number; minLng: number; maxLat: number; maxLng: number }
}

export function map_suggest_viewport(places: PlaceItem[]): MapViewport {
  const pts = places.filter((p) => isFiniteNum(p.lat) && isFiniteNum(p.lng))
  if (!pts.length) return { center: { lat: 13.7563, lng: 100.5018 }, zoom: 11, bounds: { minLat: 13.5, minLng: 100.3, maxLat: 13.9, maxLng: 100.7 } }

  let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity
  for (const p of pts) {
    minLat = Math.min(minLat, p.lat!)
    minLng = Math.min(minLng, p.lng!)
    maxLat = Math.max(maxLat, p.lat!)
    maxLng = Math.max(maxLng, p.lng!)
  }
  const center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 }
  const span = Math.max(maxLat - minLat, maxLng - minLng)
  const zoom = span <= 0.01 ? 15 : span <= 0.03 ? 14 : span <= 0.06 ? 13 : span <= 0.12 ? 12 : 11
  return { center, zoom, bounds: { minLat, minLng, maxLat, maxLng } }
}

// Helpers
function cleanPlace(p: PlaceRow): PlaceItem {
  return {
    id: p.id,
    name: p.name || 'Unknown Place',
    slug: nameToSlug(p.name || 'unknown-place'),
    lat: isFiniteNum(p.lat) ? (p.lat as number) : undefined,
    lng: isFiniteNum(p.lng) ? (p.lng as number) : undefined,
    tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
    price: typeof p.price === 'number' ? p.price : undefined,
    image_url: p.image_url || '',
  }
}

function isFiniteNum(n: any): n is number { return typeof n === 'number' && isFinite(n) }

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return R * c
}

function round1(n: number) { return Math.round(n * 10) / 10 }

export interface PlanItineraryParams {
  place_slugs: string[]
  title?: string
}

export const plan_itinerary = traceable(
  async (params: PlanItineraryParams): Promise<any> => {
    const { place_slugs, title = "Suggested Itinerary" } = params

    // Single fetch for place details and coordinates (reduces DB round-trips)
    const { data: places, error } = await supabase
      .from("bangkok_unseen")
      .select("id, name, description, tags, lat, lng")
      .in("id", place_slugs)

    if (error || !places) throw new Error("Failed to fetch places")

    const scopedPlaces = places.filter((place) =>
      isFiniteNum(place.lat) &&
      isFiniteNum(place.lng) &&
      isWithinRattanakosin({ lat: place.lat, lng: place.lng })
    )

    if (scopedPlaces.length === 0) {
      throw new Error('No places available within the Rattanakosin scope')
    }

    const placesForRoute = scopedPlaces
      .map(p => ({
        id: p.id,
        name: p.name,
        slug: nameToSlug(p.name),
        lat: p.lat,
        lng: p.lng,
        tags: p.tags || [],
        price: 0,
        image_url: "",
      }))
      .filter(p => isFiniteNum(p.lat) && isFiniteNum(p.lng)) as PlaceItem[]

    const route = await build_route({ places: placesForRoute })

    const coordsBySlug = new Map(placesForRoute.map(p => [p.slug, { lat: p.lat!, lng: p.lng! }]))
    const placeBySlug = new Map(scopedPlaces.map(p => [nameToSlug(p.name), p]))

    // Enrich stops
    const stops = route.order.map((slug) => {
      const place = placeBySlug.get(slug)!
      const leg = route.legs.find(l => l.to === slug)
      const coords = coordsBySlug.get(slug)
      return {
        slug,
        name: place.name,
        lat: coords?.lat,
        lng: coords?.lng,
        suggested_time_min: 60, // default
        notes: place.description ? place.description.slice(0, 100) + "..." : "",
        distance_from_prev_km: leg ? leg.distance_km : 0,
        travel_time_from_prev_min: leg?.duration_min || 0
      }
    })

    return {
      title,
      stops,
      total_distance_km: route.total_km,
      total_travel_minutes: route.total_mins || 0,
      total_minutes: stops.length * 60 + (route.total_mins || 0)
    }
  },
  { name: 'tools.plan_itinerary', run_type: 'tool' }
)

